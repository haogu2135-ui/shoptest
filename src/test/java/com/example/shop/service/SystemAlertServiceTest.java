package com.example.shop.service;

import com.example.shop.config.RequestCorrelationFilter;
import com.example.shop.dto.ClientErrorReportRequest;
import com.example.shop.dto.SystemAlertBatchActionResponse;
import com.example.shop.dto.SystemAlertPurgeResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
    void clientErrorReportsAreSanitizedAndRecordedAsFrontendAlerts() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);
        ClientErrorReportRequest report = new ClientErrorReportRequest();
        report.setContext("Checkout.submit");
        report.setName("TypeError");
        report.setMessage("TypeError: payment token=raw-token-12345 password=raw-password");
        report.setPath("/checkout/123?email=buyer@example.com&token=raw");
        report.setUserAgent("Mozilla/5.0 email=owner@example.com");
        report.setSource("frontend");
        report.setOccurredAt("2026-06-10T05:30:00.000Z");
        report.setComponentStack("at Checkout email=owner@example.com");
        report.setStack("TypeError: failed Authorization Bearer abcdefghijklmnop");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/errors");
        request.setAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE, "req-client-1");

        service.recordClientError(report, request);

        ArgumentCaptor<String> fingerprint = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(
                startsWith("INSERT INTO system_alerts"),
                eq("WARNING"),
                eq(SystemAlertService.STATUS_OPEN),
                eq("CLIENT"),
                eq("FRONTEND"),
                eq("Client error: Checkout.submit"),
                eq("TypeError: payment token=****** password=******"),
                fingerprint.capture(),
                metadata.capture());
        assertTrue(fingerprint.getValue().contains("client-error:checkout.submit"));
        assertTrue(fingerprint.getValue().contains("path=/checkout/{id}"));
        assertFalse(fingerprint.getValue().contains("raw-token"));
        assertTrue(metadata.getValue().contains("path=/checkout/{id}"));
        assertTrue(metadata.getValue().contains("requestId=req-client-1"));
        assertTrue(metadata.getValue().contains("email=******"));
        assertTrue(metadata.getValue().contains("Authorization Bearer ******"));
        assertFalse(metadata.getValue().contains("owner@example.com"));
        assertFalse(metadata.getValue().contains("raw-token"));
    }

    @Test
    void disabledClientErrorAlertsSkipDatabaseWrites() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        when(runtimeConfig.getBoolean("alerts.client-error.enabled", true)).thenReturn(false);
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);
        ClientErrorReportRequest report = new ClientErrorReportRequest();
        report.setContext("Cart.load");
        report.setMessage("Failed");

        service.recordClientError(report, new MockHttpServletRequest("POST", "/errors"));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void batchActionsNormalizeIdsAndMaskActorBeforeWriting() {
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

        SystemAlertBatchActionResponse response = service.resolveBatch(List.of(3L, 2L, 2L, -1L, 1L), "admin password=secret");

        assertEquals("RESOLVE", response.getAction());
        assertEquals(5, response.getRequestedCount());
        assertEquals(2, response.getIgnoredCount());
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
    void batchActionsRejectOversizedIdSetsBeforeWriting() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);

        assertThrows(IllegalArgumentException.class,
                () -> service.resolveBatch(List.of(3L, 2L, 2L, -1L, 1L, 4L), "admin"));

        verifyNoInteractions(jdbcTemplate);
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

    @Test
    void searchTreatsBlankSeverityAndCategoryAsUnfiltered() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        RuntimeConfigService runtimeConfig = runtimeConfig();
        SystemAlertService service = service(jdbcTemplate, runtimeConfig);

        service.search("open", " ", "", 25);

        verify(jdbcTemplate).query(
                anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                eq(SystemAlertService.STATUS_OPEN),
                eq(SystemAlertService.STATUS_OPEN),
                eq(null),
                eq(null),
                eq(null),
                eq(null),
                eq(5));
    }

    private RuntimeConfigService runtimeConfig() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getBoolean("alerts.security.enabled", true)).thenReturn(true);
        when(runtimeConfig.getBoolean("alerts.exception.enabled", true)).thenReturn(true);
        when(runtimeConfig.getBoolean("alerts.client-error.enabled", true)).thenReturn(true);
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
