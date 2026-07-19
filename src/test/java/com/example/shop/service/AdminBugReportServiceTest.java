package com.example.shop.service;

import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportPageResponse;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminBugReportSummaryResponse;
import com.example.shop.entity.AdminBugReport;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBugReportServiceTest {
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final AdminBugReportService service = new AdminBugReportService(jdbcTemplate, runtimeConfig);

    @Test
    void summaryUsesSingleAggregateQueryForStatusSeverityAndScanCounts() {
        when(jdbcTemplate.queryForMap(startsWith("SELECT COUNT(*) AS total_bugs"), any()))
                .thenReturn(summaryCounts());

        AdminBugReportSummaryResponse response = service.summary();

        assertEquals(17, response.getTotalBugs());
        assertEquals(5, response.getOpenCount());
        assertEquals(3, response.getFixingCount());
        assertEquals(2, response.getFixedPendingRegressionCount());
        assertEquals(4, response.getDueForScanCount());
        assertEquals(5, response.getByStatus().get(AdminBugReportService.STATUS_OPEN));
        assertEquals(6, response.getBySeverity().get("HIGH"));
        verify(jdbcTemplate).queryForMap(
                startsWith("SELECT COUNT(*) AS total_bugs"),
                any());
        verify(jdbcTemplate, org.mockito.Mockito.never()).queryForList(anyString());
    }

    @Test
    void searchUsesLightweightListProjectionInsteadOfSelectStar() {
        when(jdbcTemplate.queryForObject(startsWith("SELECT COUNT(*)"), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(), any())).thenReturn(List.of());

        service.search(0, 20, null, null, null, null, false);

        verify(jdbcTemplate).query(
                argThat(sql -> sql.startsWith("SELECT id, title, module, severity")
                        && !sql.contains("SELECT *")
                        && !sql.contains("description")
                        && !sql.contains("reproduction_steps")
                        && !sql.contains("scan_note")),
                any(RowMapper.class),
                eq(20),
                eq(0));
    }

    @Test
    void searchUsesZeroBasedPageIndexForOffsetsAndResponseMetadata() {
        when(jdbcTemplate.queryForObject(startsWith("SELECT COUNT(*)"), eq(Long.class), any(Object[].class)))
                .thenReturn(41L);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(), any())).thenReturn(List.of());

        AdminBugReportPageResponse firstPage = service.search(0, 20, null, null, null, null, false);
        AdminBugReportPageResponse secondPage = service.search(1, 20, null, null, null, null, false);

        assertEquals(0, firstPage.getPage());
        assertEquals(1, secondPage.getPage());
        assertEquals(3, secondPage.getTotalPages());
        verify(jdbcTemplate).query(anyString(), any(RowMapper.class), eq(20), eq(0));
        verify(jdbcTemplate).query(anyString(), any(RowMapper.class), eq(20), eq(20));
    }

    @Test
    void findByIdUsesExplicitDetailProjectionForExpandedRows() {
        AdminBugReport existing = existingBug(42L);
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(42L))).thenReturn(List.of(existing));

        service.findById(42L);

        verify(jdbcTemplate).query(
                argThat(sql -> sql.startsWith("SELECT id, version, title, description")
                        && sql.contains("reproduction_steps")
                        && sql.contains("scan_note")
                        && !sql.contains("SELECT *")),
                any(RowMapper.class),
                eq(42L));
    }

    @Test
    void optimisticLockingUsesVersionColumnForBugMutations() throws Exception {
        String serviceSource = Files.readString(
                Path.of("src/main/java/com/example/shop/service/AdminBugReportService.java"),
                StandardCharsets.UTF_8);
        String schemaConfigSource = Files.readString(
                Path.of("src/main/java/com/example/shop/config/AdminBugReportSchemaConfig.java"),
                StandardCharsets.UTF_8);
        String schemaSource = Files.readString(Path.of("src/main/resources/schema.sql"), StandardCharsets.UTF_8);
        String migrationSource = Files.readString(Path.of("src/main/resources/db/migration/V1__init.sql"), StandardCharsets.UTF_8);

        assertTrue(serviceSource.contains("private static final String BUG_DETAIL_COLUMNS = \"id, version,"));
        assertTrue(serviceSource.contains("version = version + 1, updated_at = NOW() WHERE id = ? AND version = ?"));
        assertFalse(serviceSource.contains("WHERE id = ? AND status = ?"));
        assertTrue(schemaConfigSource.contains("+ \"version BIGINT NOT NULL DEFAULT 0,\""));
        assertTrue(schemaConfigSource.contains("ensureColumn(\"version\", \"BIGINT NOT NULL DEFAULT 0\")"));
        assertTrue(schemaSource.contains("version BIGINT NOT NULL DEFAULT 0"));
        assertTrue(migrationSource.contains("version BIGINT NOT NULL DEFAULT 0"));
    }

    @Test
    void statusUpdatesAppendNewNotesInsteadOfReplacingHistory() {
        AdminBugReport existing = existingBug(42L);
        existing.setScanNote("First note");
        AdminBugReport updated = existingBug(42L);
        updated.setScanNote("First note\n\nSecond note");
        when(jdbcTemplate.query(
                eq("SELECT id, version, title, description, module, severity, priority, status, page_url, environment, reproduction_steps, expected_result, actual_result, attachment_urls, reporter_id, reporter_name, assigned_to, scan_note, fix_summary, regression_note, last_scanned_at, fixed_at, fixed_by, regression_at, regression_by, closed_at, created_at, updated_at FROM admin_bug_reports WHERE id = ?"),
                any(RowMapper.class),
                eq(42L))).thenReturn(List.of(existing), List.of(updated));
        when(jdbcTemplate.update(
                startsWith("UPDATE admin_bug_reports SET status = ?"),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        AdminBugReportStatusRequest request = new AdminBugReportStatusRequest();
        request.setStatus(AdminBugReportService.STATUS_FIXING);
        request.setScanNote("Second note");

        service.updateStatus(42L, request, "codex");

        verify(jdbcTemplate).update(
                startsWith("UPDATE admin_bug_reports SET status = ?"),
                eq(AdminBugReportService.STATUS_FIXING),
                eq("CODEX"),
                eq("First note\n\nSecond note"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                eq(42L),
                eq(existing.getVersion()));
    }

    @Test
    void legacyNoteFieldIsDocumentedScanNoteFallbackOnly() {
        AdminBugReport existing = existingBug(42L);
        existing.setScanNote("Existing scan note");
        existing.setFixSummary("Existing fix");
        AdminBugReport updated = existingBug(42L);
        updated.setScanNote("Existing scan note\n\nLegacy note");
        updated.setFixSummary("Explicit fix note");
        when(jdbcTemplate.query(
                startsWith("SELECT id, version, title, description"),
                any(RowMapper.class),
                eq(42L))).thenReturn(List.of(existing), List.of(updated));
        when(jdbcTemplate.update(
                startsWith("UPDATE admin_bug_reports SET status = ?"),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        AdminBugReportStatusRequest request = new AdminBugReportStatusRequest();
        request.setStatus(AdminBugReportService.STATUS_FIXING);
        request.setNote("Legacy note");
        request.setFixSummary("Explicit fix note");

        service.updateStatus(42L, request, "codex");

        verify(jdbcTemplate).update(
                startsWith("UPDATE admin_bug_reports SET status = ?"),
                eq(AdminBugReportService.STATUS_FIXING),
                eq("CODEX"),
                eq("Existing scan note\n\nLegacy note"),
                eq("Existing fix\n\nExplicit fix note"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                any(),
                eq(42L),
                eq(existing.getVersion()));
    }

    @Test
    void updateThrowsWhenNoRowsAreAffected() {
        AdminBugReport existing = existingBug(42L);
        AdminBugReportRequest request = updateRequest();
        when(jdbcTemplate.query(
                startsWith("SELECT id, version, title, description"),
                any(RowMapper.class),
                eq(42L))).thenReturn(List.of(existing));
        when(jdbcTemplate.update(startsWith("UPDATE admin_bug_reports SET"), any(Object[].class))).thenReturn(0);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.update(42L, request, "codex"));

        assertEquals("Bug report changed, reload and try again", error.getMessage());
    }

    @Test
    void bugMutationsRejectStatusFieldInsteadOfSilentlyIgnoringIt() {
        AdminBugReportRequest createRequest = updateRequest();
        createRequest.setStatus(AdminBugReportService.STATUS_CLOSED);

        IllegalArgumentException createError = assertThrows(IllegalArgumentException.class,
                () -> service.create(createRequest, 7L, "codex"));

        assertEquals("Use the bug status endpoint to change status", createError.getMessage());

        AdminBugReport existing = existingBug(42L);
        AdminBugReportRequest updateRequest = updateRequest();
        updateRequest.setStatus(AdminBugReportService.STATUS_CLOSED);
        when(jdbcTemplate.query(
                startsWith("SELECT id, version, title, description"),
                any(RowMapper.class),
                eq(42L))).thenReturn(List.of(existing));

        IllegalArgumentException updateError = assertThrows(IllegalArgumentException.class,
                () -> service.update(42L, updateRequest, "codex"));

        assertEquals("Use the bug status endpoint to change status", updateError.getMessage());
    }

    @Test
    void bugReferenceUrlsRejectExternalOriginsAndAttachmentOverflow() {
        AdminBugReportRequest externalUrl = updateRequest();
        externalUrl.setPageUrl("https://evil.example/admin/bugs");

        IllegalArgumentException externalError = assertThrows(IllegalArgumentException.class,
                () -> service.create(externalUrl, 7L, "codex"));

        assertEquals("Unsupported bug page URL", externalError.getMessage());

        AdminBugReportRequest tooManyAttachments = updateRequest();
        tooManyAttachments.setAttachmentUrls(IntStream.range(0, 21)
                .mapToObj(index -> "/admin/bugs/attachments/" + index + ".png")
                .collect(Collectors.joining("\n")));

        IllegalArgumentException attachmentError = assertThrows(IllegalArgumentException.class,
                () -> service.create(tooManyAttachments, 7L, "codex"));

        assertEquals("Too many bug attachment URLs", attachmentError.getMessage());
    }

    private AdminBugReport existingBug(Long id) {
        AdminBugReport bug = new AdminBugReport();
        bug.setId(id);
        bug.setVersion(3L);
        bug.setTitle("Old title");
        bug.setDescription("Old description");
        bug.setModule("GENERAL");
        bug.setSeverity("MEDIUM");
        bug.setPriority("P2");
        bug.setStatus(AdminBugReportService.STATUS_OPEN);
        bug.setAssignedTo("CODEX");
        return bug;
    }

    private AdminBugReportRequest updateRequest() {
        AdminBugReportRequest request = new AdminBugReportRequest();
        request.setTitle("Updated title");
        request.setDescription("Updated description");
        request.setModule("GENERAL");
        request.setSeverity("MEDIUM");
        request.setPriority("P2");
        request.setAssignedTo("CODEX");
        return request;
    }

    private Map<String, Object> summaryCounts() {
        return Map.ofEntries(
                Map.entry("total_bugs", 17L),
                Map.entry("open_count", 5L),
                Map.entry("fixing_count", 3L),
                Map.entry("fixed_pending_regression_count", 2L),
                Map.entry("regression_passed_count", 1L),
                Map.entry("regression_failed_count", 2L),
                Map.entry("closed_count", 3L),
                Map.entry("non_issue_count", 1L),
                Map.entry("due_for_scan_count", 4L),
                Map.entry("low_count", 2L),
                Map.entry("medium_count", 5L),
                Map.entry("high_count", 6L),
                Map.entry("critical_count", 4L));
    }
}
