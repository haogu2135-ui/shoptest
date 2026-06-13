package com.example.shop.service;

import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportPageResponse;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminBugReportSummaryResponse;
import com.example.shop.entity.AdminBugReport;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    private final AdminBugReportService service = new AdminBugReportService(jdbcTemplate);

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
        when(jdbcTemplate.queryForObject(startsWith("SELECT COUNT(*)"), eq(Long.class)))
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
        when(jdbcTemplate.queryForObject(startsWith("SELECT COUNT(*)"), eq(Long.class)))
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
                argThat(sql -> sql.startsWith("SELECT id, title, description")
                        && sql.contains("reproduction_steps")
                        && sql.contains("scan_note")
                        && !sql.contains("SELECT *")),
                any(RowMapper.class),
                eq(42L));
    }

    @Test
    void statusUpdatesAppendNewNotesInsteadOfReplacingHistory() {
        AdminBugReport existing = existingBug(42L);
        existing.setScanNote("First note");
        AdminBugReport updated = existingBug(42L);
        updated.setScanNote("First note\n\nSecond note");
        when(jdbcTemplate.query(
                eq("SELECT id, title, description, module, severity, priority, status, page_url, environment, reproduction_steps, expected_result, actual_result, attachment_urls, reporter_id, reporter_name, assigned_to, scan_note, fix_summary, regression_note, last_scanned_at, fixed_at, fixed_by, regression_at, regression_by, closed_at, created_at, updated_at FROM admin_bug_reports WHERE id = ?"),
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
                eq(AdminBugReportService.STATUS_OPEN));
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
                startsWith("SELECT id, title, description"),
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
                eq(AdminBugReportService.STATUS_OPEN));
    }

    @Test
    void updateThrowsWhenNoRowsAreAffected() {
        AdminBugReport existing = existingBug(42L);
        AdminBugReportRequest request = updateRequest();
        when(jdbcTemplate.query(
                startsWith("SELECT id, title, description"),
                any(RowMapper.class),
                eq(42L))).thenReturn(List.of(existing));
        when(jdbcTemplate.update(startsWith("UPDATE admin_bug_reports SET"), any(Object[].class))).thenReturn(0);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.update(42L, request, "codex"));

        assertEquals("Bug report not found", error.getMessage());
    }

    private AdminBugReport existingBug(Long id) {
        AdminBugReport bug = new AdminBugReport();
        bug.setId(id);
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
