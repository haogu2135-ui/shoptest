package com.example.shop.controller;

import com.example.shop.dto.AdminBugReportResponse;
import com.example.shop.entity.AdminBugReport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminBugReportControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminBugReportController.java");

    @Test
    void adminBugReportControllerKeepsPermissionedWorkflowAndAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/bugs\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("bugReportService.search(page, size, status, severity, module, keyword, scanQueueOnly)"));
        assertTrue(source.contains("bugReportService.summary()"));
        assertTrue(source.contains("AdminRoleService.BUGS_WRITE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.BUGS_STATUS_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.BUGS_SCAN_PERMISSION"));
        assertTrue(source.contains("@PostMapping(value = \"/attachments\", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)"));
        assertTrue(source.contains("requirePermission(authentication, AdminRoleService.BUGS_WRITE_PERMISSION, \"BUG_ATTACHMENT_UPLOAD\""));
        assertTrue(source.contains("@GetMapping(\"/attachments/{filename:.+}\")"));
        assertTrue(source.contains("requireReadPermission(authentication, \"BUG_ATTACHMENT_READ\""));
        assertTrue(source.contains("adminRoleService.hasAnyBugPermission(user.getId())"));
        assertTrue(source.contains("auditLogService.record(\"BUG_CREATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BUG_UPDATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BUG_SCAN\", \"SUCCESS\""));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.FORBIDDEN, \"Missing admin read permission\")"));
        assertTrue(source.contains("public AdminBugReportResponse findById("));
        assertTrue(source.contains("public AdminBugReportResponse create("));
        assertTrue(source.contains("public AdminBugReportResponse update("));
        assertTrue(source.contains("public AdminBugReportResponse updateStatus("));
        assertTrue(source.contains("public AdminBugReportResponse markScanned("));
        assertTrue(source.contains("AdminBugReportResponse.from("));
        assertFalse(source.contains("public AdminBugReport findById("));
        assertFalse(source.contains("public AdminBugReport create("));
        assertFalse(source.contains("public AdminBugReport update("));
        assertFalse(source.contains("public AdminBugReport updateStatus("));
        assertFalse(source.contains("public AdminBugReport markScanned("));
        assertFalse(source.contains("new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e)"));
    }

    @Test
    void adminBugReportResponseOmitsInternalWorkflowFields() throws Exception {
        AdminBugReport bug = new AdminBugReport();
        bug.setId(42L);
        bug.setVersion(7L);
        bug.setTitle("Checkout bug");
        bug.setDescription("Checkout failed");
        bug.setReporterId(99L);
        bug.setReporterName("alice");
        bug.setFixedBy("internal-fixer");
        bug.setRegressionBy("internal-regression");

        String json = new ObjectMapper().writeValueAsString(AdminBugReportResponse.from(bug));

        assertTrue(json.contains("\"reporterName\":\"alice\""));
        assertFalse(json.contains("reporterId"));
        assertFalse(json.contains("fixedBy"));
        assertFalse(json.contains("regressionBy"));
        assertFalse(json.contains("version"));
        assertFalse(hasDeclaredField(AdminBugReportResponse.class, "reporterId"));
        assertFalse(hasDeclaredField(AdminBugReportResponse.class, "fixedBy"));
        assertFalse(hasDeclaredField(AdminBugReportResponse.class, "regressionBy"));
        assertFalse(hasDeclaredField(AdminBugReportResponse.class, "version"));
    }

    @Test
    void adminBugReportAuditMetadataHtmlEncodesUserControlledTitle() {
        AdminBugReportController controller = new AdminBugReportController(null, null, null, null);
        AdminBugReport bug = new AdminBugReport();
        bug.setTitle("<img src=x onerror=alert(1)> & \"quote\" 'apostrophe'");
        bug.setStatus("OPEN");
        bug.setSeverity("HIGH");
        bug.setModule("ADMIN");

        String metadata = ReflectionTestUtils.invokeMethod(controller, "metadata", bug);

        assertTrue(metadata.contains(
                "title=&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot; &#39;apostrophe&#39;"));
        assertFalse(metadata.contains("<img"));
        assertFalse(metadata.contains("\"quote\""));
        assertFalse(metadata.contains("'apostrophe'"));
    }

    private boolean hasDeclaredField(Class<?> type, String fieldName) {
        try {
            type.getDeclaredField(fieldName);
            return true;
        } catch (NoSuchFieldException ex) {
            return false;
        }
    }
}
