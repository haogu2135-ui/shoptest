package com.example.shop.service;

import com.example.shop.dto.SystemAlertBatchActionResponse;
import com.example.shop.dto.SystemAlertPurgeResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemAlertServiceTest {

    @Test
    void masksSensitiveValuesAndNormalizesFingerprintBeforeWriting() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);

        service.recordSecurityEvent(
                "ERROR",
                "payment/webhook",
                "Stripe webhook failed",
                "Webhook rejected token=raw-token-12345 password=raw-password",
                "payment:SO20260524123456789:" + "abcdef0123456789abcdef0123456789",
                "Authorization Bearer abcdefghijklmnop; callback-secret=raw-callback-secret");

        verify(jdbcTemplate).update(
                startsWith("INSERT INTO system_alerts"),
                eq("ERROR"),
                eq(SystemAlertService.STATUS_OPEN),
                eq("SECURITY"),
                eq("PAYMENT_WEBHOOK"),
                eq("Stripe webhook failed"),
                eq("Webhook rejected token=****** password=******"),
                eq("payment:{orderno}:{id}"),
                eq("Authorization Bearer ******; callback-secret=******"));
    }

    @Test
    void batchActionsClampIdsAndExposeIgnoredCount() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);
        when(jdbcTemplate.update(
                startsWith("UPDATE system_alerts SET status = ?, resolved_at"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any())).thenReturn(2);

        SystemAlertBatchActionResponse response = service.resolveBatch(List.of(3L, 2L, 2L, -1L, 1L, 4L), "admin password=secret");

        assertEquals("RESOLVE", response.getAction());
        assertEquals(6, response.getRequestedCount());
        assertEquals(3, response.getIgnoredCount());
        assertEquals(3, response.getMaxBatchSize());
        assertEquals(List.of(3L, 2L, 1L), response.getIds());
        assertEquals(2, response.getUpdatedCount());
        verify(jdbcTemplate).update(
                startsWith("UPDATE system_alerts SET status = ?, resolved_at"),
                eq(SystemAlertService.STATUS_RESOLVED),
                eq("admin password=******"),
                eq(3L),
                eq(2L),
                eq(1L),
                eq(SystemAlertService.STATUS_RESOLVED));
    }

    @Test
    void searchAndPurgeRespectConfiguredLimits() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);
        when(jdbcTemplate.update(anyString(), eq(SystemAlertService.STATUS_RESOLVED), any(LocalDateTime.class)))
                .thenReturn(7);

        service.search("open", "critical", "database", 99);
        SystemAlertPurgeResponse purge = service.purgeResolved(999);

        verify(jdbcTemplate).query(
                anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                eq(SystemAlertService.STATUS_OPEN),
                eq(SystemAlertService.STATUS_OPEN),
                eq("CRITICAL"),
                eq("CRITICAL"),
                eq("DATABASE"),
                eq("DATABASE"),
                eq(5));
        assertEquals(10, purge.getRetentionDays());
        assertEquals(7, purge.getDeletedCount());
        assertTrue(purge.getPurgedBefore().contains("T"));
    }

    private RuntimeConfigService runtimeConfig() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getBoolean("alerts.security.enabled", true)).thenReturn(true);
        when(runtimeConfig.getBoolean("alerts.exception.enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("alerts.admin.search-max-rows", 1000)).thenReturn(5);
        when(runtimeConfig.getInt("alerts.admin.batch-action-max-size", 200)).thenReturn(3);
        when(runtimeConfig.getInt("alerts.admin.retention-max-days", 3650)).thenReturn(10);
        return runtimeConfig;
    }

    @SuppressWarnings("unchecked")
    private SystemAlertService service(JdbcTemplate jdbcTemplate, RuntimeConfigService runtimeConfig) {
        return new SystemAlertService(
                jdbcTemplate,
                runtimeConfig,
                mock(ObjectProvider.class),
                mock(ObjectProvider.class),
                mock(ObjectProvider.class),
                mock(ObjectProvider.class),
                mock(ObjectProvider.class));
    }
}
