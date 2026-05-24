package com.example.shop.service;

import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportServiceTest {
    private SupportMessageMapper supportMessageMapper;
    private SupportService service;

    @BeforeEach
    void setUp() {
        SupportSessionMapper supportSessionMapper = mock(SupportSessionMapper.class);
        supportMessageMapper = mock(SupportMessageMapper.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("support.websocket.max-message-chars", 1000)).thenReturn(1000);
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(80);
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
}
