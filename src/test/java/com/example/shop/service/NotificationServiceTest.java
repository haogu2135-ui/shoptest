package com.example.shop.service;

import com.example.shop.entity.Notification;
import com.example.shop.repository.NotificationMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {
    private NotificationMapper notificationMapper;
    private UserMapper userMapper;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        notificationMapper = mock(NotificationMapper.class);
        userMapper = mock(UserMapper.class);
        service = new NotificationService(notificationMapper, userMapper);
    }

    @Test
    void broadcastUsesActiveCustomerIdsAndBatchesInserts() {
        List<Long> userIds = LongStream.rangeClosed(1, 501).boxed().collect(Collectors.toList());
        when(userMapper.findActiveCustomerIds()).thenReturn(userIds);
        when(notificationMapper.insertBatch(anyList())).thenAnswer(invocation -> invocation.<List<?>>getArgument(0).size());

        int sent = service.broadcastToCustomers("promotion", " Sale ", " Message ", "html");

        assertEquals(501, sent);
        verify(userMapper).findActiveCustomerIds();
        verify(userMapper, never()).findAll();

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
        when(userMapper.findActiveCustomerIds()).thenReturn(List.of());

        assertEquals(0, service.broadcastToCustomers("system", "Title", "Message", "text"));

        verify(notificationMapper, never()).insertBatch(anyList());
    }
}
