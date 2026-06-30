package com.example.shop.config;

import com.example.shop.entity.IpBlacklistEntry;
import com.example.shop.service.IpBlacklistService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import javax.servlet.FilterChain;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpBlacklistFilterTest {

    private final IpBlacklistService ipBlacklistService = mock(IpBlacklistService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final IpBlacklistFilter filter = new IpBlacklistFilter(
            ipBlacklistService,
            new ApiErrorResponseFactory(),
            objectMapper
    );

    @Test
    void blockedResponseDoesNotExposeResolvedIpOrBlockDetails() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin/products");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        IpBlacklistEntry entry = new IpBlacklistEntry();
        entry.setIpAddress("203.0.113.44");
        entry.setBlockedUntil(LocalDateTime.of(2026, 6, 17, 23, 30));

        when(ipBlacklistService.shouldCheckPath(request)).thenReturn(true);
        when(ipBlacklistService.resolveClientIp(request)).thenReturn("203.0.113.44");
        when(ipBlacklistService.findBlockingEntry("203.0.113.44")).thenReturn(Optional.of(entry));

        filter.doFilter(request, response, chain);

        String body = response.getContentAsString();
        assertEquals(HttpStatus.FORBIDDEN.value(), response.getStatus());
        assertEquals("application/json;charset=UTF-8", response.getContentType());
        assertTrue(body.contains("\"error\":\"IP address is temporarily blocked\""));
        assertTrue(body.contains("\"message\":\"IP address is temporarily blocked\""));
        assertFalse(body.contains("203.0.113.44"));
        assertFalse(body.contains("ipAddress"));
        assertFalse(body.contains("blockedUntil"));
        assertFalse(body.contains("2026-06-17"));
        verify(chain, never()).doFilter(any(), any());
    }
}
