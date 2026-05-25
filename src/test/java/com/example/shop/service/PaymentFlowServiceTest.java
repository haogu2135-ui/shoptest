package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentFlowServiceTest {
    @Test
    void cancellingPendingPaymentOrderClosesPendingPaymentRecords() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setStatus("PENDING_PAYMENT");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "CANCELLED")).thenReturn(1);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "cartItemMapper", mock(CartItemMapper.class));
        ReflectionTestUtils.setField(service, "couponService", mock(CouponService.class));

        service.cancelOrder(42L);

        verify(paymentRepository).markPendingCancelledByOrderId(42L);
    }

    @Test
    void successfulCallbackCannotPayCancelledOrder() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));

        Order cancelledOrder = new Order();
        cancelledOrder.setId(42L);
        cancelledOrder.setStatus("CANCELLED");

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "dev-payment-secret")).thenReturn("dev-payment-secret");
        when(runtimeConfig.getLong("payment.callback-max-skew-seconds", 300)).thenReturn(300L);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setOrderNo(payment.getOrderNo());
        request.setChannel(payment.getChannel());
        request.setTransactionId("provider-txn-1");
        request.setProviderReference("provider-ref-1");
        request.setStatus("SUCCESS");
        request.setAmount(payment.getAmount());
        request.setCallbackTimestamp(Instant.now().getEpochSecond());
        request.setSignature(service.expectedSignature(request));

        when(paymentRepository.findByOrderNoAndChannel(payment.getOrderNo(), payment.getChannel())).thenReturn(payment);
        when(orderService.getOrderById(42L)).thenReturn(cancelledOrder);

        assertThrows(IllegalStateException.class, () -> service.handleCallback(request));
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void manualRefundUsesProvidedReference() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo(order.getOrderNo());
        payment.setChannel("OXXO");
        payment.setStatus("PAID");
        payment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.markRefunding(9L)).thenReturn(1);
        when(paymentRepository.markRefunded(9L, "BANK-REF-20260518")).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(payment);

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        service.refundPaidPayment(order, "customer return", "BANK-REF-20260518");

        verify(paymentRepository).markRefunded(9L, "BANK-REF-20260518");
    }

    @Test
    void manualRefundRejectsTooLongReference() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Order order = new Order();
        order.setId(42L);
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setChannel("OXXO");
        payment.setStatus("PAID");
        payment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.markRefunding(9L)).thenReturn(1);

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.refundPaidPayment(order, "customer return", "x".repeat(129))
        );
        verify(paymentRepository, never()).markRefunding(9L);
        verify(paymentRepository, never()).markRefunded(eq(9L), any());
    }
}
