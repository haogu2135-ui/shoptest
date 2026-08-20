package com.example.shop.service;

import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentWebhookEvidenceServiceTest {
    @Test
    void webhookEvidenceQueriesAndControllerWritesRemainBoundToPersistentAuditLogs() throws Exception {
        String mapper = Files.readString(Path.of("src/main/resources/mapper/SecurityAuditLogMapper.xml"));
        String controller = Files.readString(Path.of("src/main/java/com/example/shop/controller/PaymentController.java"));

        assertTrue(mapper.contains("id=\"countWebhookSuccess\""));
        assertTrue(mapper.contains("id=\"findLatestWebhookSuccess\""));
        assertTrue(mapper.contains("id=\"countProviderLikeWebhookSuccess\""));
        assertTrue(mapper.contains("metadata LIKE '%sourceClass=PROVIDER_LIKE%'"));
        assertTrue(controller.contains("webhookEvidenceService.sourceMetadata(request)"));
        assertFalse(controller.contains("webhookEvidenceService.recordSuccess"));
    }

    @Test
    void snapshotsPersistentAuditEvidenceAcrossBothProviders() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
        PaymentWebhookEvidenceService service = new PaymentWebhookEvidenceService(mapper, clientIpResolver);
        SecurityAuditLog stripe = successLog(
                LocalDateTime.of(2026, 8, 20, 7, 0),
                "sourceClass=PROVIDER_LIKE,userAgentClass=STRIPE",
                "Stripe/1.0");
        SecurityAuditLog mercado = successLog(
                LocalDateTime.of(2026, 8, 20, 7, 5),
                "sourceClass=SIGNED_LOCAL,userAgentClass=OTHER",
                "curl/8");
        when(mapper.countWebhookSuccess("STRIPE_WEBHOOK")).thenReturn(3L);
        when(mapper.countWebhookSuccess("MERCADO_PAGO_WEBHOOK")).thenReturn(2L);
        when(mapper.findLatestWebhookSuccess("STRIPE_WEBHOOK")).thenReturn(stripe);
        when(mapper.findLatestWebhookSuccess("MERCADO_PAGO_WEBHOOK")).thenReturn(mercado);
        when(mapper.countProviderLikeWebhookSuccess()).thenReturn(1L);

        Map<String, Object> snapshot = service.snapshot();
        Map<?, ?> stripeSnapshot = (Map<?, ?>) snapshot.get("stripe");
        Map<?, ?> mercadoSnapshot = (Map<?, ?>) snapshot.get("mercadoPago");

        assertEquals(3L, stripeSnapshot.get("successCount"));
        assertEquals("PROVIDER_LIKE", stripeSnapshot.get("lastSourceClass"));
        assertEquals("STRIPE", stripeSnapshot.get("lastUserAgentClass"));
        assertEquals(2L, mercadoSnapshot.get("successCount"));
        assertEquals("SIGNED_LOCAL", mercadoSnapshot.get("lastSourceClass"));
        assertEquals(true, snapshot.get("anyProviderLikeSuccess"));
        assertEquals(true, snapshot.get("available"));
        assertEquals("PERSISTENT_AUDIT_LOG", snapshot.get("evidenceStore"));
    }

    @Test
    void classifiesPrivateAndLoopbackSourcesAsLocalWithoutTrustingForwardedHeadersDirectly() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
        PaymentWebhookEvidenceService service = new PaymentWebhookEvidenceService(mapper, clientIpResolver);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("User-Agent", "curl/8");

        when(clientIpResolver.resolve(request)).thenReturn("192.168.10.4");
        when(clientIpResolver.normalizeIpAddress("192.168.10.4")).thenReturn("192.168.10.4");
        assertTrue(service.sourceMetadata(request).contains("sourceClass=SIGNED_LOCAL"));

        when(clientIpResolver.resolve(request)).thenReturn("8.8.8.8");
        when(clientIpResolver.normalizeIpAddress("8.8.8.8")).thenReturn("8.8.8.8");
        assertTrue(service.sourceMetadata(request).contains("sourceClass=PROVIDER_LIKE"));

        request.removeHeader("User-Agent");
        request.addHeader("User-Agent", "Stripe/1.0 (+https://stripe.com/docs/webhooks)");
        when(clientIpResolver.resolve(request)).thenReturn("127.0.0.1");
        when(clientIpResolver.normalizeIpAddress("127.0.0.1")).thenReturn("127.0.0.1");
        assertTrue(service.sourceMetadata(request).contains("sourceClass=SIGNED_LOCAL"));
        assertTrue(service.sourceMetadata(request).contains("userAgentClass=STRIPE"));
    }

    @Test
    void reportsPersistentStoreUnavailableInsteadOfClaimingZeroEvidence() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        when(mapper.countWebhookSuccess("STRIPE_WEBHOOK")).thenThrow(new IllegalStateException("db unavailable"));
        PaymentWebhookEvidenceService service = new PaymentWebhookEvidenceService(mapper, mock(ClientIpResolver.class));

        Map<String, Object> snapshot = service.snapshot();

        assertEquals(false, snapshot.get("available"));
        assertEquals("UNAVAILABLE", snapshot.get("evidenceStore"));
        assertFalse((Boolean) snapshot.get("anyProviderLikeSuccess"));
        assertEquals(0L, ((Map<?, ?>) snapshot.get("stripe")).get("successCount"));
    }

    private SecurityAuditLog successLog(LocalDateTime createdAt, String metadata, String userAgent) {
        SecurityAuditLog log = new SecurityAuditLog();
        log.setCreatedAt(createdAt);
        log.setMetadata(metadata);
        log.setUserAgent(userAgent);
        return log;
    }
}
