package com.example.shop.service;

import com.example.shop.entity.Notification;
import com.example.shop.repository.NotificationMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {
    private NotificationMapper notificationMapper;
    private UserMapper userMapper;
    private TransactionTemplate transactionTemplate;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        notificationMapper = mock(NotificationMapper.class);
        userMapper = mock(UserMapper.class);
        transactionTemplate = mock(TransactionTemplate.class);
        when(transactionTemplate.execute(org.mockito.ArgumentMatchers.<TransactionCallback<Integer>>any()))
                .thenAnswer(invocation -> invocation.<TransactionCallback<Integer>>getArgument(0).doInTransaction(null));
        service = new NotificationService(notificationMapper, userMapper, transactionTemplate);
    }

    @Test
    void getNotificationsUsesBoundedPageDefaults() {
        service.getNotifications(7L);

        verify(notificationMapper).findByUserIdPage(7L, 20, 0);
    }

    @Test
    void getNotificationsNormalizesPageAndCapsSize() {
        service.getNotifications(7L, 3, 500);

        verify(notificationMapper).findByUserIdPage(7L, 100, 200);
    }

    @Test
    void getNotificationsRepairsInvalidPageInputs() {
        service.getNotifications(7L, -3, 0);

        verify(notificationMapper).findByUserIdPage(7L, 20, 0);
    }

    @Test
    void broadcastUsesActiveCustomerIdsAndBatchesInserts() {
        List<Long> userIds = LongStream.rangeClosed(1, 501).boxed().collect(Collectors.toList());
        when(userMapper.findActiveCustomerIdsAfter(0L, 500)).thenReturn(userIds.subList(0, 500));
        when(userMapper.findActiveCustomerIdsAfter(500L, 500)).thenReturn(userIds.subList(500, 501));
        when(userMapper.findActiveCustomerIdsAfter(501L, 500)).thenReturn(List.of());
        when(notificationMapper.insertBatch(anyList())).thenAnswer(invocation -> invocation.<List<?>>getArgument(0).size());

        int sent = service.broadcastToCustomers("promotion", " Sale ", " Message ", "html");

        assertEquals(501, sent);
        verify(userMapper).findActiveCustomerIdsAfter(0L, 500);
        verify(userMapper).findActiveCustomerIdsAfter(500L, 500);
        verify(userMapper).findActiveCustomerIdsAfter(501L, 500);
        verify(userMapper, never()).findAll();
        verify(transactionTemplate, org.mockito.Mockito.times(2))
                .execute(org.mockito.ArgumentMatchers.<TransactionCallback<Integer>>any());

        verify(notificationMapper).insertBatch(org.mockito.ArgumentMatchers.argThat(batch ->
                batch.size() == 500
                        && batch.get(0).getUserId().equals(1L)
                        && "PROMOTION".equals(batch.get(0).getType())
                        && "HTML".equals(batch.get(0).getContentFormat())));
        verify(notificationMapper).insertBatch(org.mockito.ArgumentMatchers.argThat(batch ->
                batch.size() == 1 && batch.get(0).getUserId().equals(501L)));
    }

    @Test
    void broadcastSkipsInsertWhenNoActiveCustomers() {
        when(userMapper.findActiveCustomerIdsAfter(0L, 500)).thenReturn(List.of());

        assertEquals(0, service.broadcastToCustomers("system", "Title", "Message", "text"));

        verify(notificationMapper, never()).insertBatch(anyList());
    }

    @Test
    void broadcastSanitizesHtmlNotificationBeforeInsert() {
        when(userMapper.findActiveCustomerIdsAfter(0L, 500)).thenReturn(List.of(42L));
        when(userMapper.findActiveCustomerIdsAfter(42L, 500)).thenReturn(List.of());
        when(notificationMapper.insertBatch(anyList())).thenAnswer(invocation -> invocation.<List<?>>getArgument(0).size());

        int sent = service.broadcastToCustomers(
                "promotion",
                " Seasonal sale ",
                "<p onclick=\"alert(1)\" style=\"color:red\">Hi <a href=\"javascript:alert(1)\">bad</a></p>"
                        + "<script>alert(2)</script>"
                        + "<a href=\"/orders\" target=\"_BLANK\">Order</a>"
                        + "<a href=\"data:text/html,<svg>\">data</a>"
                        + "<a href=\"https://user:pass@example.com/path\">cred</a>"
                        + "<img src=\"//tracker.example/pixel.png\">",
                "html");

        assertEquals(1, sent);
        Notification notification = captureOnlyInsertedNotification();
        String savedMessage = notification.getMessage();
        assertEquals("Seasonal sale", notification.getTitle());
        assertEquals("HTML", notification.getContentFormat());
        assertTrue(savedMessage.contains("<p>Hi <a>bad</a></p>"));
        assertTrue(savedMessage.contains("<a href=\"/orders\" target=\"_blank\" rel=\"noopener noreferrer\">Order</a>"));
        assertTrue(savedMessage.contains("<a>data</a>"));
        assertTrue(savedMessage.contains("<a>cred</a>"));
        assertTrue(savedMessage.contains("<img>"));
        assertFalse(savedMessage.contains("onclick"));
        assertFalse(savedMessage.contains("style="));
        assertFalse(savedMessage.contains("javascript:"));
        assertFalse(savedMessage.contains("data:text/html"));
        assertFalse(savedMessage.contains("user:pass"));
        assertFalse(savedMessage.contains("<script"));
        assertFalse(savedMessage.contains("//tracker.example"));
    }

    @Test
    void broadcastSanitizesSlashSeparatedHtmlAttributes() {
        when(userMapper.findActiveCustomerIdsAfter(0L, 500)).thenReturn(List.of(42L));
        when(userMapper.findActiveCustomerIdsAfter(42L, 500)).thenReturn(List.of());
        when(notificationMapper.insertBatch(anyList())).thenAnswer(invocation -> invocation.<List<?>>getArgument(0).size());

        int sent = service.broadcastToCustomers(
                "promotion",
                "Slash separated markup",
                "<a/href=\"javascript:alert(1)\">bad</a><img/src=\"/assets/pixel.png\" onerror=\"alert(1)\">",
                "html");

        assertEquals(1, sent);
        String savedMessage = captureOnlyInsertedNotification().getMessage();
        assertEquals("<a>bad</a><img src=\"/assets/pixel.png\">", savedMessage);
    }

    @Test
    void broadcastKeepsPreviewApprovedPathRelativeHtmlLinks() {
        when(userMapper.findActiveCustomerIdsAfter(0L, 500)).thenReturn(List.of(42L));
        when(userMapper.findActiveCustomerIdsAfter(42L, 500)).thenReturn(List.of());
        when(notificationMapper.insertBatch(anyList())).thenAnswer(invocation -> invocation.<List<?>>getArgument(0).size());

        int sent = service.broadcastToCustomers(
                "promotion",
                "Coupon reminder",
                "<a href=\"coupons/spring\" target=\"_BLANK\">Coupon</a>"
                        + "<a href=\"./profile?tab=orders\">Orders</a>",
                "html");

        assertEquals(1, sent);
        String savedMessage = captureOnlyInsertedNotification().getMessage();
        assertTrue(savedMessage.contains("<a href=\"coupons/spring\" target=\"_blank\" rel=\"noopener noreferrer\">Coupon</a>"));
        assertTrue(savedMessage.contains("<a href=\"./profile?tab=orders\">Orders</a>"));
    }

    @Test
    void broadcastRejectsOversizedNotificationFieldsBeforeBatching() {
        IllegalArgumentException titleError = assertThrows(IllegalArgumentException.class,
                () -> service.broadcastToCustomers("system", "a".repeat(101), "Message", "text"));
        IllegalArgumentException messageError = assertThrows(IllegalArgumentException.class,
                () -> service.broadcastToCustomers("system", "Title", "m".repeat(5001), "text"));

        assertEquals("Title must be 100 characters or fewer", titleError.getMessage());
        assertEquals("Message must be 5000 characters or fewer", messageError.getMessage());
        verify(userMapper, never()).findActiveCustomerIdsAfter(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyInt());
        verify(notificationMapper, never()).insertBatch(anyList());
    }

    @Test
    void tryCreateNotificationReturnsFalseWhenInsertFails() {
        doThrow(new RuntimeException("db unavailable")).when(notificationMapper).insert(org.mockito.ArgumentMatchers.any(Notification.class));

        assertEquals(false, service.tryCreateNotification(7L, "order", "Order paid", "Message"));
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Notification captureOnlyInsertedNotification() {
        ArgumentCaptor<List> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationMapper).insertBatch(captor.capture());
        List<Notification> notifications = captor.getValue();
        assertEquals(1, notifications.size());
        return notifications.get(0);
    }
}
