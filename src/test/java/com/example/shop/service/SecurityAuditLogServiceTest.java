package com.example.shop.service;

import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SecurityAuditLogServiceTest {
    @Test
    void normalizesControlCharactersBeforeWritingAuditLog() {
        SecurityAuditLogMapper mapper = mock(SecurityAuditLogMapper.class);
        SecurityAuditLogService service = new SecurityAuditLogService(mapper);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("User-Agent", "Mozilla\nInjected");
        request.addHeader("X-Forwarded-For", " 1.2.3.4\r\nX: bad, 5.6.7.8");

        service.record(
                "ORDER_EXPORT\n",
                "SUCCESS",
                1L,
                "admin\tuser",
                "ROLE_ADMIN",
                "ORDER",
                "42\n",
                request,
                "Exported\r\norders",
                "status=PENDING\nquick=SLA");

        ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
        verify(mapper).insert(captor.capture());
        SecurityAuditLog log = captor.getValue();

        assertEquals("ORDER_EXPORT", log.getAction());
        assertEquals("admin user", log.getActorUsername());
        assertEquals("1.2.3.4 X: bad", log.getIpAddress());
        assertEquals("Mozilla Injected", log.getUserAgent());
        assertEquals("Exported orders", log.getMessage());
        assertEquals("status=PENDING quick=SLA", log.getMetadata());
        assertFalse(log.getResourceId().contains("\n"));
    }
}
