package com.example.shop.service;

import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.entity.AdminBugReport;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminBugReportServiceTest {
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AdminBugReportService service = new AdminBugReportService(jdbcTemplate);

    @Test
    void updateThrowsWhenNoRowsAreAffected() {
        AdminBugReport existing = existingBug(42L);
        AdminBugReportRequest request = updateRequest();
        when(jdbcTemplate.query(
                eq("SELECT * FROM admin_bug_reports WHERE id = ?"),
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
}
