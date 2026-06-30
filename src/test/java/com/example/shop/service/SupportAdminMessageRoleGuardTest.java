package com.example.shop.service;

import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportAdminMessageRoleGuardTest {
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
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(1000);
        when(runtimeConfig.getBoolean("support.message.rate-limit-enabled", true)).thenReturn(false);
        service = new SupportService(supportSessionMapper, supportMessageMapper, runtimeConfig);
    }

    @Test
    void genericMessageEntrypointRejectsForgedAdminRoleBeforeAssigningSession() {
        SupportSession session = openUnassignedSession();
        when(supportSessionMapper.findById(55L)).thenReturn(session);

        assertThrows(IllegalStateException.class, () -> service.sendMessage(55L, 7L, "ADMIN", "hello"));

        verify(supportSessionMapper, never()).assignAdmin(55L, 7L);
        verify(supportMessageMapper, never()).insert(any(SupportMessage.class));
    }

    @Test
    void adminMessageEntrypointRejectsNonAdminSenderRoleBeforeAssigningSession() {
        assertThrows(IllegalStateException.class, () -> service.sendAdminMessage(7L, 55L, "hello", "USER"));

        verify(supportSessionMapper, never()).findById(55L);
        verify(supportSessionMapper, never()).assignAdmin(55L, 7L);
        verify(supportMessageMapper, never()).insert(any(SupportMessage.class));
    }

    @Test
    void adminMessageEntrypointRejectsUnassignedSessionWithoutExplicitAssignmentApproval() {
        SupportSession session = openUnassignedSession();
        when(supportSessionMapper.findById(55L)).thenReturn(session);

        assertThrows(IllegalStateException.class, () -> service.sendAdminMessage(7L, 55L, "hello", "ADMIN"));

        verify(supportSessionMapper, never()).assignAdmin(55L, 7L);
        verify(supportMessageMapper, never()).insert(any(SupportMessage.class));
    }

    @Test
    void adminMessageEntrypointAssignsOnlyWhenCallerApprovesAssignment() {
        SupportSession session = openUnassignedSession();
        when(supportSessionMapper.findById(55L)).thenReturn(session);

        SupportMessage message = service.sendAdminMessage(7L, 55L, "hello", "ADMIN", true);

        assertEquals("ADMIN", message.getSenderRole());
        verify(supportSessionMapper).assignAdmin(55L, 7L);
        verify(supportMessageMapper).insert(any(SupportMessage.class));
    }

    @Test
    void superAdminRoleCanUseAdminMessageEntrypointButStoredRoleStaysAdmin() {
        SupportSession session = openUnassignedSession();
        when(supportSessionMapper.findById(55L)).thenReturn(session);

        SupportMessage message = service.sendAdminMessage(7L, 55L, "hello", "SUPER_ADMIN", true);

        assertEquals("ADMIN", message.getSenderRole());
        verify(supportSessionMapper).assignAdmin(55L, 7L);
        verify(supportMessageMapper).insert(any(SupportMessage.class));
    }

    private SupportSession openUnassignedSession() {
        SupportSession session = new SupportSession();
        session.setId(55L);
        session.setUserId(9L);
        session.setStatus("OPEN");
        session.setAssignedAdminId(null);
        return session;
    }
}
