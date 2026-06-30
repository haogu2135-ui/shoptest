package com.example.shop.service;

import com.example.shop.dto.SecurityAuditPurgeResponse;
import com.example.shop.dto.SecurityAuditSummaryResponse;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SecurityAuditLogServiceTest {
    @Test
    void currentAuditLogMappingUsesSecurityAuditLogsTableInsteadOfLegacyAdminAuditEntity() throws Exception {
        String entity = Files.readString(Path.of("src/main/java/com/example/shop/entity/SecurityAuditLog.java"));
        String mapper = Files.readString(Path.of("src/main/resources/mapper/SecurityAuditLogMapper.xml"));

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/entity/AdminAuditLog.java")));
        assertTrue(entity.contains("public class SecurityAuditLog"));
        assertFalse(entity.contains("@Entity"));
        assertFalse(entity.contains("@Table(name = \"admin_audit_log\")"));
        assertTrue(mapper.contains("type=\"com.example.shop.entity.SecurityAuditLog\""));
        assertTrue(mapper.contains("INSERT INTO security_audit_logs"));
        assertTrue(mapper.contains("FROM security_audit_logs"));
    }

    @Test
    void normalizesControlCharactersBeforeWritingAuditLog() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
        SecurityAuditLogService service = new SecurityAuditLogService(mapper, mock(JdbcTemplate.class), clientIpResolver, mock(RuntimeConfigService.class));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("User-Agent", "Mozilla\nInjected");
        request.addHeader("X-Forwarded-For", " 1.2.3.4\r\nX: bad, 5.6.7.8");
        when(clientIpResolver.resolve(request)).thenReturn("1.2.3.4");

        service.record(
                "ORDER_EXPORT\n",
                "SUCCESS",
                1L,
                "admin\tuser",
                "ROLE_ADMIN",
                "ORDER",
                "42\n",
                request,
                "Exported\r\norders with token=secret-token-123",
                "status=PENDING\nquick=SLA password=super-secret");

        ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
        verify(mapper).insert(captor.capture());
        SecurityAuditLog log = captor.getValue();

        assertEquals("ORDER_EXPORT", log.getAction());
        assertEquals("admin user", log.getActorUsername());
        assertEquals("1.2.3.4", log.getIpAddress());
        assertEquals("Mozilla Injected", log.getUserAgent());
        assertEquals("Exported orders with token=******", log.getMessage());
        assertEquals("status=PENDING quick=SLA password=******", log.getMetadata());
        assertFalse(log.getResourceId().contains("\n"));
    }

    @Test
    void auditPersistenceFailuresRemainErrorVisibleWithStackTrace() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/service/SecurityAuditLogService.java"));

        assertTrue(source.contains("catch (RuntimeException e)"));
        assertTrue(source.contains("log.error(\"Security audit log write failed."));
        assertTrue(source.contains("resourceId={}\","));
        assertTrue(source.contains("resourceId, e);"));
        assertFalse(source.contains("log.warn(\"Security audit log write failed."));
    }

    @Test
    void clampsSearchLimitAndTimeRangeAndMasksReturnedRows() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        RuntimeConfigService runtimeConfig = auditRuntimeConfig();
        SecurityAuditLogService service = new SecurityAuditLogService(
                mapper,
                mock(JdbcTemplate.class),
                mock(ClientIpResolver.class),
                runtimeConfig);
        SecurityAuditLog row = new SecurityAuditLog();
        row.setResourceId("payment?token=raw-secret-token");
        row.setMessage("Webhook failed with Authorization Bearer abcdefghijklmnop");
        row.setMetadata("password=raw-password");
        when(mapper.search(
                any(),
                any(),
                any(),
                any(),
                any(LocalDateTime.class),
                any(LocalDateTime.class),
                eq(3))).thenReturn(List.of(row));

        LocalDateTime start = LocalDateTime.of(2026, 5, 24, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 5, 24, 15, 0);
        List<SecurityAuditLog> rows = service.search("order_export", "success", "admin%_", "order", start, end, 50);

        ArgumentCaptor<LocalDateTime> startCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(mapper).search(
                eq("ORDER_EXPORT"),
                eq("SUCCESS"),
                eq("admin!%!_"),
                eq("ORDER"),
                startCaptor.capture(),
                endCaptor.capture(),
                eq(3));
        assertEquals(end.minusHours(2), startCaptor.getValue());
        assertEquals(end, endCaptor.getValue());
        assertTrue(rows.get(0).getResourceId().contains("token=******"));
        assertEquals("Webhook failed with Authorization Bearer ******", rows.get(0).getMessage());
        assertEquals("password=******", rows.get(0).getMetadata());
    }

    @Test
    void exportUsesDedicatedExportLimit() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        RuntimeConfigService runtimeConfig = auditRuntimeConfig();
        SecurityAuditLogService service = new SecurityAuditLogService(
                mapper,
                mock(JdbcTemplate.class),
                mock(ClientIpResolver.class),
                runtimeConfig);
        when(mapper.search(any(), any(), any(), any(), any(LocalDateTime.class), any(LocalDateTime.class), eq(4)))
                .thenReturn(List.of());

        service.export(null, null, null, null, LocalDateTime.now().minusHours(1), LocalDateTime.now());

        verify(mapper).search(any(), any(), any(), any(), any(LocalDateTime.class), any(LocalDateTime.class), eq(4));
    }

    @Test
    void summaryClampsTimeRangeAndTopLimit() {
        CapturingSummaryJdbcTemplate jdbcTemplate = new CapturingSummaryJdbcTemplate();
        SecurityAuditLogService service = new SecurityAuditLogService(
                mock(SecurityAuditLogMapper.class),
                jdbcTemplate,
                mock(ClientIpResolver.class),
                auditRuntimeConfig());
        LocalDateTime end = LocalDateTime.of(2026, 5, 24, 15, 0);
        LocalDateTime start = end.minusDays(2);
        LocalDateTime clampedStart = end.minusHours(2);

        SecurityAuditSummaryResponse response = service.summary(null, null, null, null, start, end, 999);

        assertEquals(clampedStart.toString(), response.getStartAt());
        assertEquals(end.toString(), response.getEndAt());
        assertEquals(12L, response.getTotalCount());
        assertEquals(9L, response.getSuccessCount());
        assertEquals(3L, response.getFailureCount());
        assertEquals(2, response.getMaxRangeHours());
        assertEquals(1, response.getDefaultRangeHours());
        assertEquals(3, response.getMaxSearchRows());
        assertEquals(4, response.getMaxExportRows());
        assertEquals("ORDER_EXPORT", response.getTopActions().get(0).getName());
        assertEquals(7L, response.getTopActions().get(0).getCount());
        assertEquals(4, jdbcTemplate.groupParams.size());
        jdbcTemplate.groupParams.forEach(params -> {
            assertEquals(3, params.length);
            assertEquals(clampedStart, params[0]);
            assertEquals(end, params[1]);
            assertEquals(50, params[2]);
        });
    }

    @Test
    void summaryAppliesActiveListFiltersToCountsAndGroups() {
        CapturingSummaryJdbcTemplate jdbcTemplate = new CapturingSummaryJdbcTemplate();
        SecurityAuditLogService service = new SecurityAuditLogService(
                mock(SecurityAuditLogMapper.class),
                jdbcTemplate,
                mock(ClientIpResolver.class),
                auditRuntimeConfig());
        LocalDateTime end = LocalDateTime.of(2026, 5, 24, 15, 0);
        LocalDateTime start = end.minusMinutes(30);

        service.summary(" refund_complete ", " failure ", " admin ", " payment ", start, end, 6);

        assertEquals(3, jdbcTemplate.countParams.size());
        jdbcTemplate.countParams.forEach(params -> {
            assertEquals(6, params.length);
            assertEquals("REFUND_COMPLETE", params[0]);
            assertEquals("FAILURE", params[1]);
            assertEquals("%admin%", params[2]);
            assertEquals("PAYMENT", params[3]);
            assertEquals(start, params[4]);
            assertEquals(end, params[5]);
        });
        assertEquals(4, jdbcTemplate.groupParams.size());
        jdbcTemplate.groupParams.forEach(params -> {
            assertEquals(7, params.length);
            assertEquals("REFUND_COMPLETE", params[0]);
            assertEquals("FAILURE", params[1]);
            assertEquals("%admin%", params[2]);
            assertEquals("PAYMENT", params[3]);
            assertEquals(start, params[4]);
            assertEquals(end, params[5]);
            assertEquals(6, params[6]);
        });
    }

    @Test
    void purgeClampsRetentionDaysAndReportsDeletedRows() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        SecurityAuditLogService service = new SecurityAuditLogService(
                mock(SecurityAuditLogMapper.class),
                jdbcTemplate,
                mock(ClientIpResolver.class),
                auditRuntimeConfig());
        when(jdbcTemplate.update(eq("DELETE FROM security_audit_logs WHERE created_at < ?"), any(LocalDateTime.class)))
                .thenReturn(5);

        SecurityAuditPurgeResponse response = service.purge(99999);

        ArgumentCaptor<LocalDateTime> purgedBeforeCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(jdbcTemplate).update(eq("DELETE FROM security_audit_logs WHERE created_at < ?"), purgedBeforeCaptor.capture());
        assertEquals(3650, response.getRetentionDays());
        assertEquals(5, response.getDeletedCount());
        assertEquals(purgedBeforeCaptor.getValue().toString(), response.getPurgedBefore());
    }

    private RuntimeConfigService auditRuntimeConfig() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("admin.audit-logs.max-range-hours", 168)).thenReturn(2);
        when(runtimeConfig.getInt("admin.audit-logs.default-range-hours", 24)).thenReturn(1);
        when(runtimeConfig.getInt("admin.audit-logs.search-max-rows", 1000)).thenReturn(3);
        when(runtimeConfig.getInt("admin.audit-logs.export-max-rows", 5000)).thenReturn(4);
        return runtimeConfig;
    }

    private static class CapturingSummaryJdbcTemplate extends JdbcTemplate {
        private final Queue<Long> counts = new ArrayDeque<>(List.of(12L, 9L, 3L));
        private final List<Object[]> countParams = new ArrayList<>();
        private final List<Object[]> groupParams = new ArrayList<>();

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countParams.add(args);
            return requiredType.cast(counts.remove());
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            groupParams.add(args);
            return List.of(Map.of("name", "ORDER_EXPORT", "total", 7L));
        }
    }
}
