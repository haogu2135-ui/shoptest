package com.example.shop.service;

import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SupportWebSocketTicketServiceTest {
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final SupportWebSocketTicketService service = new SupportWebSocketTicketService(runtimeConfig, jwtService);

    @BeforeEach
    void setUp() {
        when(runtimeConfig.getLong("support.websocket.ticket-ttl-ms", 60_000L)).thenReturn(10_000L);
    }

    @Test
    void issuedTicketIsOpaqueSingleUseAndCarriesTokenJti() {
        when(jwtService.extractJti("jwt-token")).thenReturn("jti-1");

        SupportWebSocketTicketService.Ticket issued = service.issue(user(), "Bearer jwt-token");
        SupportWebSocketTicketService.Ticket consumed = service.consume(issued.getValue());

        assertNotNull(issued.getValue());
        assertTrue(issued.getValue().length() >= 32);
        assertEquals(12L, consumed.getUserId());
        assertEquals("jti-1", consumed.getTokenJti());
        assertTrue(consumed.expiresInMillis(System.currentTimeMillis()) > 0);
        assertNull(service.consume(issued.getValue()));
        assertEquals(0, service.pendingTicketCount());
    }

    @Test
    void blankOrUnknownTicketCannotAuthenticate() {
        assertNull(service.consume(null));
        assertNull(service.consume("   "));
        assertNull(service.consume("missing-ticket"));
    }

    private UserDetailsImpl user() {
        return new UserDetailsImpl(
                12L,
                "mia",
                "mia@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }
}
