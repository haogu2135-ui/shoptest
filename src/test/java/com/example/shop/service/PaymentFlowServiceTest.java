package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.GuestCheckoutItemRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.ProductRepository;
import com.example.shop.entity.User;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class PaymentFlowServiceTest {
    @Test
    void productionPaymentSimulationRequiresHostLevelAllowFlag() {
        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");
        when(runtimeConfig.getBoolean("payment.simulation-allow-production", false)).thenReturn(true);
        when(runtimeConfig.getString("payment.simulation-enabled", "")).thenReturn("true");
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        String previous = System.getProperty("PAYMENT_SIMULATION_ALLOW_PRODUCTION");
        System.clearProperty("PAYMENT_SIMULATION_ALLOW_PRODUCTION");
        try {
            assertFalse(service.isPaymentSimulationEnabled());

            System.setProperty("PAYMENT_SIMULATION_ALLOW_PRODUCTION", "true");

            assertTrue(service.isPaymentSimulationEnabled());
        } finally {
            if (previous == null) {
                System.clearProperty("PAYMENT_SIMULATION_ALLOW_PRODUCTION");
            } else {
                System.setProperty("PAYMENT_SIMULATION_ALLOW_PRODUCTION", previous);
            }
        }
    }

    @Test
    void productionCheckoutRejectsPlaceholderOrUnsafeRedirectChannels() {
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("OXXO");
        channel.setProvider("GENERIC_REDIRECT");
        channel.setEnabled(true);

        PaymentService service = paymentServiceForChannelAvailability(channelConfig);

        channelConfig.setCheckoutBaseUrl("https://pay.example.local/checkout");
        assertFalse(service.isChannelAvailableForCheckout(channel));

        channelConfig.setCheckoutBaseUrl("http://payments.example.com/checkout");
        assertFalse(service.isChannelAvailableForCheckout(channel));

        channelConfig.setCheckoutBaseUrl("https://127.0.0.1/checkout");
        assertFalse(service.isChannelAvailableForCheckout(channel));

        channelConfig.setCheckoutBaseUrl("https://payments.example.com/checkout");
        assertTrue(service.isChannelAvailableForCheckout(channel));
    }

    @Test
    void productionCheckoutRequiresSafeStripeRuntimeConfig() {
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("STRIPE");
        channel.setProvider("STRIPE");
        channel.setEnabled(true);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService(channelConfig, runtimeConfig));

        when(runtimeConfig.getString("stripe.secret-key", "")).thenReturn("sk_live_123");
        when(runtimeConfig.getString("stripe.webhook-secret", "")).thenReturn("");
        when(runtimeConfig.getString("stripe.checkout-success-url", "http://localhost:3000/profile?payment=success")).thenReturn("https://shop.example.com/profile?payment=success");
        when(runtimeConfig.getString("stripe.checkout-cancel-url", "http://localhost:3000/cart?payment=cancelled")).thenReturn("https://shop.example.com/cart?payment=cancelled");
        assertFalse(service.isChannelAvailableForCheckout(channel));

        when(runtimeConfig.getString("stripe.webhook-secret", "")).thenReturn("whsec_live_123");
        assertTrue(service.isChannelAvailableForCheckout(channel));
    }

    @Test
    void productionCheckoutRequiresSafeGenericApiUrls() {
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("SPEI");
        channel.setProvider("GENERIC_API");
        channel.setRefundMode("GENERIC_API");
        channel.setCreateUrl("https://payments.example.com/create");
        channel.setRefundUrl("http://payments.example.com/refund");
        channel.setEnabled(true);

        PaymentService service = paymentServiceForChannelAvailability(channelConfig);

        assertFalse(service.isChannelAvailableForCheckout(channel));

        channel.setRefundUrl("https://payments.example.com/refund");
        assertTrue(service.isChannelAvailableForCheckout(channel));
    }

    @Test
    void genericApiPaymentCreateSendsIdempotencyKey() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("SPEI");
        channel.setProvider("GENERIC_API");
        channel.setCreateUrl("https://payments.example.com/create");
        channel.setEnabled(true);
        channelConfig.setChannels(List.of(channel));

        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605270001");
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(new BigDecimal("88.00"));

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getBoolean("payment.gateway-allow-local", false)).thenReturn(false);
        when(runtimeConfig.getLong("payment.timeout-minutes", 30)).thenReturn(30L);
        when(runtimeConfig.getString("payment.success-url", "http://localhost:3000/profile?payment=success")).thenReturn("https://shop.example.com/profile?payment=success");
        when(runtimeConfig.getString("payment.cancel-url", "http://localhost:3000/cart?payment=cancelled")).thenReturn("https://shop.example.com/cart?payment=cancelled");
        when(runtimeConfig.getBoolean("traffic.circuit-breaker.enabled", true)).thenReturn(false);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService(channelConfig, runtimeConfig));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "circuitBreakerService", new CircuitBreakerService(runtimeConfig));
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(requestTo("https://payments.example.com/create"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Idempotency-Key", "payment-create-42-SPEI"))
                .andExpect(jsonPath("$.idempotencyKey").value("payment-create-42-SPEI"))
                .andRespond(withSuccess(
                        "{\"status\":\"CREATED\",\"paymentUrl\":\"https://payments.example.com/pay/abc\",\"transactionId\":\"gw-txn-42\"}",
                        MediaType.APPLICATION_JSON));

        PaymentCreateRequest request = new PaymentCreateRequest();
        request.setOrderId(42L);
        request.setChannel("SPEI");

        Payment payment = service.createPayment(request);

        assertEquals("gw-txn-42", payment.getTransactionId());
        server.verify();
        verify(paymentRepository).insert(any(Payment.class));
    }

    @Test
    void duplicatePaymentCreateRaceReturnsExistingPayment() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("OXXO");
        channel.setProvider("REDIRECT");
        channel.setEnabled(true);
        channelConfig.setChannels(List.of(channel));
        channelConfig.setCheckoutBaseUrl("https://payments.example.com/checkout");
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605270001");
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(new BigDecimal("88.00"));
        Payment racedPayment = new Payment();
        racedPayment.setId(9L);
        racedPayment.setOrderId(42L);
        racedPayment.setOrderNo(order.getOrderNo());
        racedPayment.setChannel("OXXO");
        racedPayment.setStatus("PENDING");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getBoolean("payment.gateway-allow-local", false)).thenReturn(false);
        when(runtimeConfig.getString("payment.success-url", "http://localhost:3000/profile?payment=success")).thenReturn("https://shop.example.com/profile?payment=success");
        when(runtimeConfig.getString("payment.cancel-url", "http://localhost:3000/cart?payment=cancelled")).thenReturn("https://shop.example.com/cart?payment=cancelled");
        when(runtimeConfig.getLong("payment.timeout-minutes", 30)).thenReturn(30L);
        doThrow(new DataIntegrityViolationException("duplicate order channel")).when(paymentRepository).insert(any(Payment.class));
        when(paymentRepository.findByOrderIdAndChannel(42L, "OXXO")).thenReturn(null, racedPayment);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService(channelConfig, runtimeConfig));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "circuitBreakerService", new CircuitBreakerService(runtimeConfig));
        PaymentCreateRequest request = new PaymentCreateRequest();
        request.setOrderId(42L);
        request.setChannel("OXXO");

        Payment result = service.createPayment(request);

        assertEquals(9L, result.getId());
    }

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
    void expiringOlderPaymentDoesNotCancelOrderWhenAnotherPaymentIsStillActive() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setStatus("PENDING");
        payment.setExpiresAt(LocalDateTime.now().minusMinutes(1));

        when(paymentRepository.findById(9L)).thenReturn(payment);
        when(paymentRepository.markExpired(9L)).thenReturn(1);
        when(paymentRepository.countActivePendingByOrderId(42L)).thenReturn(1L);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);

        service.expireSinglePendingPayment(9L);

        verify(paymentRepository).markExpired(9L);
        verify(orderService, never()).cancelOrder(42L);
        verify(orderService, never()).cancelOrderForPaymentExpiry(42L);
    }

    @Test
    void expiringLastPendingPaymentClaimsOrderBeforeMarkingPaymentExpired() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        CouponService couponService = mock(CouponService.class);
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setStatus("PENDING");
        payment.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        order.setStatus("PENDING_PAYMENT");

        when(paymentRepository.findById(9L)).thenReturn(payment);
        when(paymentRepository.countActivePendingByOrderId(42L)).thenReturn(0L);
        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "CANCELLED")).thenReturn(1);
        when(paymentRepository.markExpired(9L)).thenReturn(1);

        OrderService orderService = new OrderService();
        ReflectionTestUtils.setField(orderService, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(orderService, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(orderService, "couponService", couponService);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);

        service.expireSinglePendingPayment(9L);

        InOrder inOrder = inOrder(orderRepository, paymentRepository);
        inOrder.verify(orderRepository).updateStatusIfCurrent(42L, "PENDING_PAYMENT", "CANCELLED");
        inOrder.verify(paymentRepository).markExpired(9L);
        inOrder.verify(paymentRepository).markPendingCancelledByOrderId(42L);
    }

    @Test
    void unpaidOrderExpirySkipsCancellationWhenANewPendingPaymentIsActive() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Order order = new Order();
        order.setId(42L);
        order.setStatus("PENDING_PAYMENT");
        order.setCreatedAt(LocalDateTime.now().minusMinutes(40));

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getLong("order.unpaid-timeout-minutes", 30)).thenReturn(30L);
        when(paymentRepository.countActivePendingByOrderId(42L)).thenReturn(1L);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        service.cancelSingleExpiredOrder(42L);

        verify(orderRepository, never()).updateStatusIfCurrent(eq(42L), eq("PENDING_PAYMENT"), eq("CANCELLED"));
        verify(paymentRepository, never()).findPendingByOrderId(42L);
    }

    @Test
    void checkoutRejectsUnavailablePaymentChannelBeforeCreatingOrder() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        CartItemMapper cartItemMapper = mock(CartItemMapper.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        CouponService couponService = mock(CouponService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelAvailabilityService availabilityService = mock(PaymentChannelAvailabilityService.class);
        when(runtimeConfig.getInt("order.max-checkout-lines", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.shipping-address-max-chars", 500)).thenReturn(500);
        when(runtimeConfig.getInt("order.payment-method-max-chars", 40)).thenReturn(40);
        when(availabilityService.requireAvailableForCheckout("STRIPE"))
                .thenThrow(new IllegalStateException("Payment channel is not configured for checkout"));

        CheckoutRequest request = new CheckoutRequest();
        request.setUserId(7L);
        request.setCartItemIds(List.of(1L));
        request.setShippingAddress("100 Pet Commerce St");
        request.setPaymentMethod("STRIPE");

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "cartItemMapper", cartItemMapper);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "couponService", couponService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService);

        assertThrows(IllegalStateException.class, () -> service.checkout(request));

        verify(availabilityService).requireAvailableForCheckout("STRIPE");
        verifyNoInteractions(orderRepository, orderItemRepository, cartItemMapper, productRepository, couponService);
    }

    @Test
    void guestCheckoutRejectsUnavailablePaymentChannelBeforeCreatingOrder() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelAvailabilityService availabilityService = mock(PaymentChannelAvailabilityService.class);
        ProductVariantService productVariantService = mock(ProductVariantService.class);
        when(runtimeConfig.getInt("order.max-checkout-lines", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.guest-name-max-chars", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.guest-phone-max-chars", 40)).thenReturn(40);
        when(runtimeConfig.getInt("order.shipping-address-max-chars", 500)).thenReturn(500);
        when(runtimeConfig.getInt("order.payment-method-max-chars", 40)).thenReturn(40);
        when(runtimeConfig.getInt("order.max-quantity-per-line", 99)).thenReturn(99);
        when(productVariantService.normalizeSpecs(null)).thenReturn(null);
        when(availabilityService.requireAvailableForCheckout("STRIPE"))
                .thenThrow(new IllegalStateException("Payment channel is not configured for checkout"));

        GuestCheckoutItemRequest item = new GuestCheckoutItemRequest();
        item.setProductId(3L);
        item.setQuantity(1);
        GuestCheckoutRequest request = new GuestCheckoutRequest();
        request.setGuestEmail("buyer@example.com");
        request.setGuestName("Buyer");
        request.setGuestPhone("555-0100");
        request.setShippingAddress("100 Pet Commerce St");
        request.setPaymentMethod("STRIPE");
        request.setItems(List.of(item));

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService);
        ReflectionTestUtils.setField(service, "productVariantService", productVariantService);

        assertThrows(IllegalStateException.class, () -> service.guestCheckout(request));

        verify(availabilityService).requireAvailableForCheckout("STRIPE");
        verifyNoInteractions(orderRepository, orderItemRepository, productRepository, userRepository);
    }

    private PaymentService paymentServiceForChannelAvailability(PaymentChannelConfig channelConfig) {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");
        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "paymentChannelAvailabilityService", availabilityService(channelConfig, runtimeConfig));
        return service;
    }

    private PaymentChannelAvailabilityService availabilityService(PaymentChannelConfig channelConfig, RuntimeConfigService runtimeConfig) {
        return new PaymentChannelAvailabilityService(channelConfig, runtimeConfig);
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
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
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
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(false);

        assertThrows(IllegalStateException.class, () -> service.handleCallback(request));
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void successfulCallbackAfterLocalPaymentCancellationRequiresReconciliation() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("CANCELLED");
        payment.setAmount(new BigDecimal("88.00"));
        Payment reconcilePayment = new Payment();
        reconcilePayment.setId(9L);
        reconcilePayment.setOrderId(42L);
        reconcilePayment.setOrderNo(payment.getOrderNo());
        reconcilePayment.setChannel(payment.getChannel());
        reconcilePayment.setStatus("RECONCILE_REQUIRED");
        reconcilePayment.setAmount(payment.getAmount());
        reconcilePayment.setTransactionId("provider-txn-1");

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
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
        when(paymentRepository.markReconcileRequired(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any())).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(reconcilePayment);

        Payment result = service.handleCallback(request);

        assertEquals("RECONCILE_REQUIRED", result.getStatus());
        verify(orderService, never()).updateOrderStatus(42L, "PENDING_SHIPMENT");
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void successfulCallbackAfterOrderCancellationWithPendingPaymentRequiresReconciliation() {
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
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("CANCELLED");
        order.setTotalAmount(payment.getAmount());
        Payment reconcilePayment = new Payment();
        reconcilePayment.setId(9L);
        reconcilePayment.setOrderId(42L);
        reconcilePayment.setOrderNo(payment.getOrderNo());
        reconcilePayment.setChannel(payment.getChannel());
        reconcilePayment.setStatus("RECONCILE_REQUIRED");
        reconcilePayment.setAmount(payment.getAmount());
        reconcilePayment.setTransactionId("provider-txn-1");

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
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
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentRepository.markReconcileRequired(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any())).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(reconcilePayment);

        Payment result = service.handleCallback(request);

        assertEquals("RECONCILE_REQUIRED", result.getStatus());
        verify(orderService, never()).updateOrderStatus(42L, "PENDING_SHIPMENT");
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void successfulCallbackClaimsOrderBeforeMarkingPaymentPaid() {
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
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());
        Payment paidPayment = new Payment();
        paidPayment.setId(9L);
        paidPayment.setOrderId(42L);
        paidPayment.setOrderNo(payment.getOrderNo());
        paidPayment.setChannel(payment.getChannel());
        paidPayment.setStatus("PAID");
        paidPayment.setAmount(payment.getAmount());

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
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
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(true);
        when(paymentRepository.markPaidDetailed(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any())).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(paidPayment);

        Payment result = service.handleCallback(request);

        assertEquals("PAID", result.getStatus());
        InOrder inOrder = inOrder(orderService, paymentRepository);
        inOrder.verify(orderService).updateOrderStatus(42L, "PENDING_SHIPMENT");
        inOrder.verify(paymentRepository).markPaidDetailed(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any());
    }

    @Test
    void successfulCallbackDoesNotMarkPaymentWhenPendingOrderClaimFails() {
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
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
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
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(false);

        assertThrows(IllegalStateException.class, () -> service.handleCallback(request));
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void successfulCallbackUsesOrderRepositoryCasBeforeMarkingPaymentPaid() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService orderRuntimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));
        Payment paidPayment = new Payment();
        paidPayment.setId(9L);
        paidPayment.setOrderId(42L);
        paidPayment.setOrderNo(payment.getOrderNo());
        paidPayment.setChannel(payment.getChannel());
        paidPayment.setStatus("PAID");
        paidPayment.setAmount(payment.getAmount());
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());

        OrderService orderService = new OrderService();
        ReflectionTestUtils.setField(orderService, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(orderService, "runtimeConfig", orderRuntimeConfig);

        PaymentService service = new PaymentService();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
        when(runtimeConfig.getLong("payment.callback-max-skew-seconds", 300)).thenReturn(300L);
        when(orderRuntimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
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
        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT")).thenReturn(1);
        when(paymentRepository.markPaidDetailed(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any())).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(paidPayment);

        Payment result = service.handleCallback(request);

        assertEquals("PAID", result.getStatus());
        InOrder inOrder = inOrder(orderRepository, paymentRepository);
        inOrder.verify(orderRepository).updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT");
        inOrder.verify(paymentRepository).markPaidDetailed(eq(9L), eq("provider-txn-1"), eq("provider-ref-1"), any());
    }

    @Test
    void simulateCallbackDoesNotMarkPaymentWhenOrderClaimFails() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());

        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.simulation-enabled", "")).thenReturn("");
        when(runtimeConfig.getString("payment.callback-secret", "")).thenReturn("local-callback-secret-1234567890");
        when(runtimeConfig.getLong("payment.callback-max-skew-seconds", 300)).thenReturn(300L);
        when(paymentRepository.findById(9L)).thenReturn(payment);
        when(paymentRepository.findByOrderNoAndChannel(payment.getOrderNo(), payment.getChannel())).thenReturn(payment);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(false);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        assertThrows(IllegalStateException.class, () -> service.simulateCallback(9L));
        verify(paymentRepository, never()).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void simulatePaidClaimsOrderBeforeMarkingPaymentPaid() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());
        Payment paidPayment = new Payment();
        paidPayment.setId(9L);
        paidPayment.setOrderId(42L);
        paidPayment.setOrderNo(payment.getOrderNo());
        paidPayment.setChannel(payment.getChannel());
        paidPayment.setStatus("PAID");
        paidPayment.setAmount(payment.getAmount());

        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.simulation-enabled", "")).thenReturn("");
        when(paymentRepository.findById(9L)).thenReturn(payment, paidPayment);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(true);
        when(paymentRepository.markPaidDetailed(eq(9L), any(), any(), any())).thenReturn(1);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        Payment result = service.simulatePaid(9L);

        assertEquals("PAID", result.getStatus());
        InOrder inOrder = inOrder(orderService, paymentRepository);
        inOrder.verify(orderService).updateOrderStatus(42L, "PENDING_SHIPMENT");
        inOrder.verify(paymentRepository).markPaidDetailed(eq(9L), any(), any(), any());
    }

    @Test
    void simulatePaidDoesNotMarkPaymentWhenOrderClaimFails() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        OrderService orderService = mock(OrderService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605180001");
        payment.setChannel("OXXO");
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo(payment.getOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(payment.getAmount());

        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("payment.simulation-enabled", "")).thenReturn("");
        when(paymentRepository.findById(9L)).thenReturn(payment);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "PENDING_SHIPMENT")).thenReturn(false);

        PaymentService service = new PaymentService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "orderService", orderService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        assertThrows(IllegalStateException.class, () -> service.simulatePaid(9L));
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
    void reconcileRequiredPaymentCanBeRefundedWithManualReference() {
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
        payment.setStatus("RECONCILE_REQUIRED");
        payment.setAmount(new BigDecimal("88.00"));
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setOrderNo(order.getOrderNo());
        refundedPayment.setChannel("OXXO");
        refundedPayment.setStatus("REFUNDED");
        refundedPayment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(null);
        when(paymentRepository.findLatestReconcileRequiredByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.markRefunding(9L)).thenReturn(1);
        when(paymentRepository.markRefunded(9L, "BANK-REF-20260518")).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(refundedPayment);

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        Payment result = service.refundPaidPayment(order, "provider paid after local cancellation", "BANK-REF-20260518");

        assertEquals("REFUNDED", result.getStatus());
        verify(paymentRepository).markRefunding(9L);
        verify(paymentRepository).markRefunded(9L, "BANK-REF-20260518");
    }

    @Test
    void reconcileRequiredRefundFailureRestoresReviewStatus() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo(order.getOrderNo());
        payment.setChannel("STRIPE");
        payment.setStatus("RECONCILE_REQUIRED");
        payment.setTransactionId("pi_paid_after_cancel");
        payment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(null);
        when(paymentRepository.findLatestReconcileRequiredByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.markRefunding(9L)).thenReturn(1);
        when(runtimeConfig.getString("stripe.secret-key", "")).thenReturn("");

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        assertThrows(
                IllegalStateException.class,
                () -> service.refundPaidPayment(order, "provider paid after local cancellation", "BANK-REF-20260518")
        );
        verify(paymentRepository).revertRefunding(9L, "RECONCILE_REQUIRED");
        verify(paymentRepository, never()).markRefunded(eq(9L), any());
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

    @Test
    void refundingPaymentCanBeRecoveredWithSameManualReference() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        PaymentChannelConfig channelConfig = new PaymentChannelConfig();
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        Payment refundingPayment = new Payment();
        refundingPayment.setId(9L);
        refundingPayment.setOrderId(42L);
        refundingPayment.setOrderNo(order.getOrderNo());
        refundingPayment.setChannel("OXXO");
        refundingPayment.setStatus("REFUNDING");
        refundingPayment.setAmount(new BigDecimal("88.00"));
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setOrderNo(order.getOrderNo());
        refundedPayment.setChannel("OXXO");
        refundedPayment.setStatus("REFUNDED");
        refundedPayment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(null);
        when(paymentRepository.findLatestRefundedByOrderId(42L)).thenReturn(null);
        when(paymentRepository.findLatestByOrderId(42L)).thenReturn(refundingPayment);
        when(paymentRepository.markRefunded(9L, "BANK-REF-20260518")).thenReturn(1);
        when(paymentRepository.findById(9L)).thenReturn(refundedPayment);

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        Payment result = service.refundPaidPayment(order, "customer return", "BANK-REF-20260518");

        assertEquals("REFUNDED", result.getStatus());
        verify(paymentRepository, never()).markRefunding(9L);
        verify(paymentRepository).markRefunded(9L, "BANK-REF-20260518");
    }

    @Test
    void concurrentRefundClaimCanRecoverRefundingPayment() {
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
        Payment refundingPayment = new Payment();
        refundingPayment.setId(9L);
        refundingPayment.setOrderId(42L);
        refundingPayment.setOrderNo(order.getOrderNo());
        refundingPayment.setChannel("OXXO");
        refundingPayment.setStatus("REFUNDING");
        refundingPayment.setAmount(new BigDecimal("88.00"));
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setOrderNo(order.getOrderNo());
        refundedPayment.setChannel("OXXO");
        refundedPayment.setStatus("REFUNDED");
        refundedPayment.setAmount(new BigDecimal("88.00"));

        when(paymentRepository.findLatestPaidByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.markRefunding(9L)).thenReturn(0);
        when(paymentRepository.findById(9L)).thenReturn(refundingPayment, refundingPayment, refundedPayment);
        when(paymentRepository.markRefunded(9L, "MANUAL-42-9")).thenReturn(1);

        RefundService service = new RefundService();
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "paymentChannelConfig", channelConfig);

        Payment result = service.refundPaidPayment(order, "customer return");

        assertEquals("REFUNDED", result.getStatus());
        verify(paymentRepository).markRefunded(9L, "MANUAL-42-9");
    }

    @Test
    void directRefundClaimsOrderBeforeCallingExternalRefund() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        RefundService refundService = mock(RefundService.class);
        CouponService couponService = mock(CouponService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        order.setStatus("SHIPPED");
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setOrderNo(order.getOrderNo());
        refundedPayment.setChannel("STRIPE");
        refundedPayment.setStatus("REFUNDED");
        refundedPayment.setAmount(new BigDecimal("88.00"));

        when(runtimeConfig.getInt("order.return-reason-max-chars", 500)).thenReturn(500);
        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.markRefunded(42L, "SHIPPED", "customer return")).thenReturn(1);
        when(refundService.refundPaidPayment(order, "customer return", "BANK-REF-20260518")).thenReturn(refundedPayment);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "refundService", refundService);
        ReflectionTestUtils.setField(service, "couponService", couponService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        Payment result = service.refundOrder(42L, "customer return", false, "BANK-REF-20260518");

        assertEquals("REFUNDED", result.getStatus());
        InOrder inOrder = inOrder(orderRepository, refundService);
        inOrder.verify(orderRepository).markRefunded(42L, "SHIPPED", "customer return");
        inOrder.verify(refundService).refundPaidPayment(order, "customer return", "BANK-REF-20260518");
    }

    @Test
    void cancelledOrderWithReconcileRequiredPaymentCanBeRefunded() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        RefundService refundService = mock(RefundService.class);
        CouponService couponService = mock(CouponService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        order.setStatus("CANCELLED");
        Payment reconcilePayment = new Payment();
        reconcilePayment.setId(9L);
        reconcilePayment.setOrderId(42L);
        reconcilePayment.setOrderNo(order.getOrderNo());
        reconcilePayment.setChannel("STRIPE");
        reconcilePayment.setStatus("RECONCILE_REQUIRED");
        reconcilePayment.setAmount(new BigDecimal("88.00"));
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setOrderNo(order.getOrderNo());
        refundedPayment.setChannel("STRIPE");
        refundedPayment.setStatus("REFUNDED");
        refundedPayment.setAmount(new BigDecimal("88.00"));

        when(runtimeConfig.getInt("order.return-reason-max-chars", 500)).thenReturn(500);
        when(orderRepository.findById(42L)).thenReturn(order);
        when(paymentRepository.findLatestReconcileRequiredByOrderId(42L)).thenReturn(reconcilePayment);
        when(orderRepository.markRefunded(42L, "CANCELLED", "provider paid after local cancellation")).thenReturn(1);
        when(refundService.refundPaidPayment(order, "provider paid after local cancellation", "BANK-REF-20260518")).thenReturn(refundedPayment);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "refundService", refundService);
        ReflectionTestUtils.setField(service, "couponService", couponService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        Payment result = service.refundOrder(42L, "provider paid after local cancellation", false, "BANK-REF-20260518");

        assertEquals("REFUNDED", result.getStatus());
        InOrder inOrder = inOrder(orderRepository, refundService);
        inOrder.verify(orderRepository).markRefunded(42L, "CANCELLED", "provider paid after local cancellation");
        inOrder.verify(refundService).refundPaidPayment(order, "provider paid after local cancellation", "BANK-REF-20260518");
    }

    @Test
    void cancelledOrderWithoutReconcileRequiredPaymentIsNotRefundable() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        RefundService refundService = mock(RefundService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605180001");
        order.setStatus("CANCELLED");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(paymentRepository.findLatestReconcileRequiredByOrderId(42L)).thenReturn(null);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "refundService", refundService);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);

        assertThrows(IllegalStateException.class, () -> service.refundOrder(42L, "customer return", false));
        verify(orderRepository, never()).markRefunded(eq(42L), any(), any());
        verifyNoInteractions(refundService);
    }

    @Test
    void completeReturnCanRecoverOrderAlreadyMarkedRefunding() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
        RefundService refundService = mock(RefundService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setStatus("RETURN_REFUNDING");
        order.setReturnReason("customer return");
        Payment refundedPayment = new Payment();
        refundedPayment.setId(9L);
        refundedPayment.setOrderId(42L);
        refundedPayment.setStatus("REFUNDED");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(refundService.refundPaidPayment(order, "customer return")).thenReturn(refundedPayment);
        when(orderRepository.completeReturnAndRefundIfCurrent(42L, "RETURN_REFUNDING")).thenReturn(1);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "refundService", refundService);
        ReflectionTestUtils.setField(service, "couponService", mock(CouponService.class));

        service.completeReturn(42L);

        verify(orderRepository, never()).markReturnRefundingIfCurrent(eq(42L), any(), any());
        verify(refundService).refundPaidPayment(order, "customer return");
        verify(orderRepository).completeReturnAndRefundIfCurrent(42L, "RETURN_REFUNDING");
    }

    @Test
    void returnedOrderCanTransitionToRefundedForLegacyRecovery() {
        OrderService service = new OrderService();

        service.assertNextStatus("RETURNED", "REFUNDED");
    }

    @Test
    void manualPaymentConfirmationCreatesCustomerNotification() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        NotificationService notificationService = mock(NotificationService.class);
        OrderEmailNotificationService orderEmailNotificationService = mock(OrderEmailNotificationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(new BigDecimal("88.00"));
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo(order.getOrderNo());
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));

        when(orderRepository.findById(42L)).thenReturn(order);
        when(paymentRepository.findPendingByOrderId(42L)).thenReturn(payment);
        when(paymentRepository.findById(9L)).thenReturn(payment);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT")).thenReturn(1);
        when(paymentRepository.update(payment)).thenReturn(1);
        User user = new User();
        user.setId(7L);
        user.setEmail("Mia@Example.com");
        user.setStatus("ACTIVE");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "orderEmailNotificationService", orderEmailNotificationService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);

        service.confirmPayment(42L, "MANUAL-TXN");

        InOrder inOrder = inOrder(orderRepository, paymentRepository);
        inOrder.verify(orderRepository).updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT");
        inOrder.verify(paymentRepository).update(payment);
        verify(notificationService).tryCreateNotification(
                eq(7L),
                eq("ORDER"),
                eq("Payment received"),
                contains("SO202605260001")
        );
        verify(orderEmailNotificationService).trySendOrderStatusEmail(
                eq("mia@example.com"),
                eq("Payment received"),
                contains("SO202605260001")
        );
    }

    @Test
    void manualPaymentConfirmationDoesNotWritePaymentWhenOrderClaimFails() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(new BigDecimal("88.00"));
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo(order.getOrderNo());
        payment.setStatus("PENDING");
        payment.setAmount(new BigDecimal("88.00"));

        when(orderRepository.findById(42L)).thenReturn(order);
        when(paymentRepository.findPendingByOrderId(42L)).thenReturn(payment);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT")).thenReturn(0);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);

        assertThrows(IllegalStateException.class, () -> service.confirmPayment(42L, "MANUAL-TXN"));
        verify(paymentRepository, never()).update(any(Payment.class));
        verify(paymentRepository, never()).insert(any(Payment.class));
    }

    @Test
    void manualPaymentConfirmationInsertsPaymentAfterOrderClaim() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setStatus("PENDING_PAYMENT");
        order.setTotalAmount(new BigDecimal("88.00"));

        when(orderRepository.findById(42L)).thenReturn(order);
        when(orderRepository.updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT")).thenReturn(1);
        when(paymentRepository.insert(any(Payment.class))).thenAnswer(invocation -> {
            Payment inserted = invocation.getArgument(0);
            inserted.setId(10L);
            return 1;
        });

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);

        Payment result = service.confirmPayment(42L, "MANUAL-TXN");

        assertEquals("PAID", result.getStatus());
        InOrder inOrder = inOrder(orderRepository, paymentRepository);
        inOrder.verify(orderRepository).updateStatusIfCurrent(42L, "PENDING_PAYMENT", "PENDING_SHIPMENT");
        inOrder.verify(paymentRepository).insert(any(Payment.class));
    }

    @Test
    void guestOrderStatusNotificationUsesEmailInsteadOfStationNotification() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        OrderEmailNotificationService orderEmailNotificationService = mock(OrderEmailNotificationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("SHIPPED");
        order.setShippingAddress("[Guest] Mia / 555-0100 / Mia@Example.com / 123 Calle Uno");
        User guest = new User();
        guest.setId(7L);
        guest.setEmail("Mia@Example.com");
        guest.setStatus("GUEST");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.updateStatusIfCurrent(42L, "SHIPPED", "COMPLETED")).thenReturn(1);
        when(userRepository.findById(7L)).thenReturn(Optional.of(guest));

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "orderEmailNotificationService", orderEmailNotificationService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);

        service.updateOrderStatus(42L, "COMPLETED");

        verify(notificationService, never()).tryCreateNotification(any(), any(), any(), any());
        verify(orderEmailNotificationService).trySendOrderStatusEmail(
                eq("mia@example.com"),
                eq("Order completed"),
                contains("SO202605260001")
        );
    }

    @Test
    void guestOrderStatusEmailFallsBackToShippingAddressWhenGuestUserLookupMisses() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        OrderEmailNotificationService orderEmailNotificationService = mock(OrderEmailNotificationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("SHIPPED");
        order.setShippingAddress("[Guest] Mia / 555-0100 / Mia@Example.com / 123 Calle Uno");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.updateStatusIfCurrent(42L, "SHIPPED", "COMPLETED")).thenReturn(1);
        when(userRepository.findById(7L)).thenReturn(Optional.empty());

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "orderEmailNotificationService", orderEmailNotificationService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);

        service.updateOrderStatus(42L, "COMPLETED");

        verify(notificationService, never()).tryCreateNotification(any(), any(), any(), any());
        verify(orderEmailNotificationService).trySendOrderStatusEmail(
                eq("mia@example.com"),
                eq("Order completed"),
                contains("SO202605260001")
        );
    }

    @Test
    void guestOrderStatusNotificationIsSkipped() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setStatus("SHIPPED");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.updateStatusIfCurrent(42L, "SHIPPED", "COMPLETED")).thenReturn(1);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);

        service.updateOrderStatus(42L, "COMPLETED");

        verify(notificationService, never()).tryCreateNotification(any(), any(), any(), any());
    }

    @Test
    void notificationFailureDoesNotBlockShipmentUpdate() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("PENDING_SHIPMENT");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getInt("order.tracking-number-max-chars", 120)).thenReturn(120);
        when(orderRepository.updateShipping(42L, "PENDING_SHIPMENT", "SHIPPED", "TRACK123", null, null)).thenReturn(1);
        when(notificationService.tryCreateNotification(any(), any(), any(), any())).thenReturn(false);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);

        service.shipOrder(42L, "TRACK123");

        verify(orderRepository).updateShipping(42L, "PENDING_SHIPMENT", "SHIPPED", "TRACK123", null, null);
        verify(notificationService).tryCreateNotification(eq(7L), eq("ORDER"), eq("Order shipped"), contains("TRACK123"));
    }

    @Test
    void shipOrderDoesNotOverwriteOrderWhenStatusChangedConcurrently() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("PENDING_SHIPMENT");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getInt("order.tracking-number-max-chars", 120)).thenReturn(120);
        when(orderRepository.updateShipping(42L, "PENDING_SHIPMENT", "SHIPPED", "TRACK123", null, null)).thenReturn(0);

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);

        assertFalse(service.shipOrder(42L, "TRACK123"));

        verify(orderRepository).updateShipping(42L, "PENDING_SHIPMENT", "SHIPPED", "TRACK123", null, null);
        verify(notificationService, never()).tryCreateNotification(any(), any(), any(), any());
    }

    @Test
    void customerNotificationRunsAfterCommit() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        NotificationService notificationService = mock(NotificationService.class);
        OrderEmailNotificationService orderEmailNotificationService = mock(OrderEmailNotificationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7L);
        order.setStatus("PENDING_SHIPMENT");
        User user = new User();
        user.setId(7L);
        user.setEmail("mia@example.com");
        user.setStatus("ACTIVE");

        when(orderRepository.findById(42L)).thenReturn(order);
        when(runtimeConfig.getInt("order.tracking-number-max-chars", 120)).thenReturn(120);
        when(orderRepository.updateShipping(42L, "PENDING_SHIPMENT", "SHIPPED", "TRACK123", null, null)).thenReturn(1);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "orderEmailNotificationService", orderEmailNotificationService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);

        TransactionSynchronizationManager.initSynchronization();
        try {
            service.shipOrder(42L, "TRACK123");

            verify(notificationService, never()).tryCreateNotification(any(), any(), any(), any());
            verify(orderEmailNotificationService, never()).trySendOrderStatusEmail(any(), any(), any());

            List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
            synchronizations.forEach(TransactionSynchronization::afterCommit);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

        verify(notificationService).tryCreateNotification(eq(7L), eq("ORDER"), eq("Order shipped"), contains("TRACK123"));
        verify(orderEmailNotificationService).trySendOrderStatusEmail(eq("mia@example.com"), eq("Order shipped"), contains("TRACK123"));
    }
}
