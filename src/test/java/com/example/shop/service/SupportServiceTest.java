package com.example.shop.service;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportServiceTest {
    private SupportSessionMapper supportSessionMapper;
    private SupportMessageMapper supportMessageMapper;
    private RuntimeConfigService runtimeConfig;
    private SupportService service;

    @BeforeEach
    void setUp() {
        supportSessionMapper = mock(SupportSessionMapper.class);
        supportMessageMapper = mock(SupportMessageMapper.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("support.websocket.max-message-chars", 1000)).thenReturn(1000);
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(80);
        when(runtimeConfig.getInt("support.admin.stale-minutes", 30)).thenReturn(45);
        service = new SupportService(supportSessionMapper, supportMessageMapper, runtimeConfig);

        SupportSession session = new SupportSession();
        session.setId(12L);
        session.setUserId(5L);
        session.setStatus("OPEN");
        when(supportSessionMapper.findById(12L)).thenReturn(session);
        when(supportMessageMapper.findBySessionId(12L)).thenAnswer(invocation -> List.of());
    }

    @Test
    void normalizesSupportMessageBeforeSaving() {
        SupportMessage sent = service.sendMessage(12L, 5L, "USER", "  Need\thelp\nwith\u0000delivery.  ");

        assertEquals("Need help with delivery.", sent.getContent());
        verify(supportMessageMapper).insert(any(SupportMessage.class));
    }

    @Test
    void rejectsOverlongSupportMessageBeforeSaving() {
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(12L, 5L, "USER", "x".repeat(81)));
    }

    @Test
    void rejectsBlankSupportMessageAfterNormalization() {
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(12L, 5L, "USER", "\u0000 \t\n"));
    }

    @Test
    void adminSummaryCalculatesResponseScoreAndClampsStaleWindow() {
        when(runtimeConfig.getInt("support.admin.stale-minutes", 30)).thenReturn(2);
        when(supportSessionMapper.adminSummary(eq(7L), any(LocalDateTime.class))).thenReturn(Map.of(
                "total_sessions", 10L,
                "open_sessions", 6L,
                "closed_sessions", 4L,
                "unread_sessions", 3L,
                "unread_messages", 8L,
                "unassigned_open_sessions", 2L,
                "my_open_sessions", 1L,
                "stale_open_sessions", 1L
        ));

        SupportAdminSummaryResponse summary = service.adminSummary(7L);

        assertEquals(10L, summary.getTotalSessions());
        assertEquals(6L, summary.getOpenSessions());
        assertEquals(4L, summary.getClosedSessions());
        assertEquals(3L, summary.getUnreadSessions());
        assertEquals(8L, summary.getUnreadMessages());
        assertEquals(2L, summary.getUnassignedOpenSessions());
        assertEquals(1L, summary.getMyOpenSessions());
        assertEquals(1L, summary.getStaleOpenSessions());
        assertEquals(5, summary.getStaleMinutes());
        assertEquals(36, summary.getResponseScore());
        verify(supportSessionMapper).adminSummary(eq(7L), any(LocalDateTime.class));
    }
}
