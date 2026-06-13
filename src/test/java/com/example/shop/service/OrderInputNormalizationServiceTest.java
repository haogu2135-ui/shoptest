package com.example.shop.service;

import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.GuestCheckoutItemRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.entity.User;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderInputNormalizationServiceTest {
    private OrderRepository orderRepository;
    private OrderItemRepository orderItemRepository;
    private OrderService service;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        orderItemRepository = mock(OrderItemRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "orderItemRepository", orderItemRepository);
        ReflectionTestUtils.setField(service, "paymentRepository", mock(PaymentRepository.class));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(runtimeConfig.getInt("order.return-reason-max-chars", 500)).thenReturn(80);
        when(runtimeConfig.getInt("order.tracking-number-max-chars", 120)).thenReturn(32);
    }

    @Test
    void normalizesReturnReasonBeforeSaving() {
        Order order = order(9L, 3L, "COMPLETED");
        order.setCompletedAt(LocalDateTime.now());
        when(orderRepository.findById(9L)).thenReturn(order);

        service.requestReturn(9L, 3L, "  Too\tlarge\nfor\u0000my dog.  ");

        verify(orderRepository).requestReturnIfCurrent(9L, "COMPLETED", "Too large for my dog.");
    }

    @Test
    void rejectsOverlongReturnReasonBeforeSaving() {
        Order order = order(9L, 3L, "COMPLETED");
        order.setCompletedAt(LocalDateTime.now());
        when(orderRepository.findById(9L)).thenReturn(order);

        assertThrows(IllegalArgumentException.class, () -> service.requestReturn(9L, 3L, "x".repeat(81)));
    }

    @Test
    void normalizesReturnTrackingNumberBeforeSaving() {
        Order order = order(9L, 3L, "RETURN_APPROVED");
        when(orderRepository.findById(9L)).thenReturn(order);

        service.submitReturnShipment(9L, 3L, "  RX\t123\n456  ");

        verify(orderRepository).updateReturnTrackingIfCurrent(9L, "RETURN_APPROVED", "RETURN_SHIPPED", "RX 123 456");
    }

    @Test
    void rejectsOverlongTrackingNumberBeforeSaving() {
        Order order = order(9L, 3L, "RETURN_APPROVED");
        when(orderRepository.findById(9L)).thenReturn(order);

        assertThrows(IllegalArgumentException.class, () -> service.submitReturnShipment(9L, 3L, "T".repeat(33)));
    }

    @Test
    void directOrderCreationIsDisabledBeforePersistingClientSuppliedAmounts() {
        Order order = order(null, 3L, null);

        assertThrows(IllegalStateException.class, () -> service.createOrder(order));

        verify(orderRepository, never()).insert(order);
    }

    @Test
    void guestAccessRejectsRegisteredOrderEvenWhenEmailAndOrderNumberMatch() {
        Order order = order(9L, 3L, "SHIPPED");
        order.setOrderNo("SO202605260001");
        order.setContactEmail("mia@example.com");
        order.setCustomerType("REGISTERED");
        order.setGuestOrder(false);
        order.setShippingAddress("Mia / 555-0100 / 1 Main St");

        assertFalse(service.guestOrderAccessMatches(order, "MIA@example.com", "SO202605260001"));
    }

    @Test
    void orderEmailMatchEscapesLikeWildcardsForLegacyGuestFallback() {
        Order order = order(9L, 3L, "SHIPPED");
        order.setOrderNo("SO202605260001");
        Order matched = order(9L, 3L, "SHIPPED");
        when(orderRepository.findByOrderNoAndEmail(
                "SO202605260001",
                "buyer%_!pet\\shop@example.com",
                "buyer!%!_!!pet!\\shop@example.com"))
                .thenReturn(matched);

        assertTrue(service.orderEmailMatches(order, " buyer%_!pet\\shop@example.com "));

        verify(orderRepository).findByOrderNoAndEmail(
                "SO202605260001",
                "buyer%_!pet\\shop@example.com",
                "buyer!%!_!!pet!\\shop@example.com");
    }

    @Test
    void guestCheckoutRequestRejectsMoreThanEightyItemsBeforeServiceLogic() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        GuestCheckoutRequest request = guestCheckoutRequest(81);

        Set<ConstraintViolation<GuestCheckoutRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
                .anyMatch(violation -> "items".contentEquals(violation.getPropertyPath().toString())));
    }

    @Test
    void guestCheckoutRequestAllowsEightyItems() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        GuestCheckoutRequest request = guestCheckoutRequest(80);

        Set<ConstraintViolation<GuestCheckoutRequest>> violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void checkoutRequestRejectsOverlongRecipientFieldsBeforeServiceLogic() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        CheckoutRequest request = checkoutRequest();
        request.setRecipientName("N".repeat(121));
        request.setRecipientPhone("5".repeat(41));

        Set<ConstraintViolation<CheckoutRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
                .anyMatch(violation -> "recipientName".contentEquals(violation.getPropertyPath().toString())));
        assertTrue(violations.stream()
                .anyMatch(violation -> "recipientPhone".contentEquals(violation.getPropertyPath().toString())));
    }

    @Test
    void checkoutRequestRejectsBlankOrMalformedContactFieldsBeforeServiceLogic() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        CheckoutRequest request = checkoutRequest();
        request.setRecipientName(" ");
        request.setRecipientPhone("not-a-phone");
        request.setContactEmail("not-an-email");

        Set<ConstraintViolation<CheckoutRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
                .anyMatch(violation -> "recipientName".contentEquals(violation.getPropertyPath().toString())));
        assertTrue(violations.stream()
                .anyMatch(violation -> "recipientPhone".contentEquals(violation.getPropertyPath().toString())));
        assertTrue(violations.stream()
                .anyMatch(violation -> "contactEmail".contentEquals(violation.getPropertyPath().toString())));
    }

    @Test
    void checkoutRequestAllowsValidRecipientAndOptionalContactEmail() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        CheckoutRequest request = checkoutRequest();
        request.setRecipientName("N".repeat(120));
        request.setRecipientPhone("+1 (555) 010-0000");
        request.setContactEmail(null);

        Set<ConstraintViolation<CheckoutRequest>> violations = validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void guestCheckoutRejectsMissingResolvedLineAmountBeforeOrderInsert() {
        ProductRepository productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        ProductVariantService productVariantService = mock(ProductVariantService.class);
        GuestCheckoutRequest request = guestCheckoutRequest(1);
        Product product = new Product();
        product.setId(500L);
        product.setName("Harness");
        product.setStatus("ACTIVE");
        product.setStock(10);
        product.setPrice(new BigDecimal("19.99"));

        when(runtimeConfig.getInt("order.max-checkout-lines", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.guest-name-max-chars", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.guest-phone-max-chars", 40)).thenReturn(40);
        when(runtimeConfig.getInt("order.shipping-address-max-chars", 500)).thenReturn(500);
        when(runtimeConfig.getInt("order.payment-method-max-chars", 40)).thenReturn(40);
        when(runtimeConfig.getInt("order.max-quantity-per-line", 99)).thenReturn(99);
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(88L);
            return user;
        });
        when(productRepository.findAllByIdForUpdate(List.of(500L))).thenReturn(List.of(product));
        when(productVariantService.normalizeSpecs(null)).thenReturn(null);
        when(productVariantService.resolveStock(product, null)).thenReturn(10);
        when(productVariantService.resolvePrice(product, null)).thenReturn(null);

        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "productVariantService", productVariantService);

        assertThrows(IllegalStateException.class, () -> service.guestCheckout(request));

        verify(orderRepository, never()).insert(any(Order.class));
        verify(orderItemRepository, never()).insert(any(OrderItem.class));
        verify(orderItemRepository, never()).insertBatch(anyList());
    }

    @Test
    void checkoutLineAmountRoundsEachLineHalfUpToCents() {
        CartItem item = new CartItem();
        item.setId(12L);
        item.setPrice(new BigDecimal("10.005"));
        item.setQuantity(1);

        BigDecimal amount = ReflectionTestUtils.invokeMethod(service, "requireLineAmount", item);

        assertEquals(new BigDecimal("10.01"), amount);
    }

    @Test
    void orderInsertRetriesWhenGeneratedOrderNumberCollides() {
        Order order = order(null, 3L, "PENDING_PAYMENT");
        order.setOriginalAmount(new BigDecimal("20.00"));
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setShippingFee(BigDecimal.ZERO);
        order.setTotalAmount(new BigDecimal("20.00"));
        order.setShippingAddress("100 Pet Commerce St");
        order.setPaymentMethod("STRIPE");
        when(orderRepository.insert(any(Order.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry for key 'uk_orders_order_no'"))
                .thenAnswer(invocation -> {
                    Order inserted = invocation.getArgument(0);
                    inserted.setId(99L);
                    return 1;
                });

        ReflectionTestUtils.invokeMethod(service, "insertOrderWithGeneratedOrderNo", order);

        verify(orderRepository, times(2)).insert(order);
        assertEquals(99L, order.getId());
        assertTrue(order.getOrderNo().startsWith("SO"));
        assertTrue(order.getOrderNo().length() <= 32);
    }

    @Test
    void orderInsertDoesNotRetryUnrelatedIntegrityFailure() {
        Order order = order(null, 3L, "PENDING_PAYMENT");
        doThrow(new DataIntegrityViolationException("foreign key user_id")).when(orderRepository).insert(any(Order.class));

        assertThrows(DataIntegrityViolationException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "insertOrderWithGeneratedOrderNo", order));

        verify(orderRepository, times(1)).insert(order);
    }

    @Test
    void customerAndAdminOrderReadEntryPointsAreReadOnlyTransactions() throws Exception {
        assertReadOnlyTransactional("getAllOrders");
        assertReadOnlyTransactional("getDashboardOrderStats", LocalDateTime.class, int.class, int.class);
        assertReadOnlyTransactional("searchAdminOrders", String.class, String.class, String.class, int.class, int.class);
        assertReadOnlyTransactional("countAdminOrders", String.class, String.class, String.class);
        assertReadOnlyTransactional("countAdminOrderSummary", String.class);
        assertReadOnlyTransactional("getOrderById", Long.class);
        assertReadOnlyTransactional("getTrackableOrderForInternalUse", String.class, String.class);
        assertReadOnlyTransactional("trackOrder", String.class, String.class);
        assertReadOnlyTransactional("getOrdersByUserId", Long.class);
        assertReadOnlyTransactional("getOrdersByUserId", Long.class, int.class, int.class);
        assertReadOnlyTransactional("countOrdersByUserId", Long.class);
    }

    private GuestCheckoutRequest guestCheckoutRequest(int itemCount) {
        GuestCheckoutRequest request = new GuestCheckoutRequest();
        request.setGuestEmail("buyer@example.com");
        request.setGuestName("Buyer");
        request.setGuestPhone("555-0100");
        request.setShippingAddress("100 Pet Commerce St");
        request.setPaymentMethod("STRIPE");
        List<GuestCheckoutItemRequest> items = new ArrayList<>();
        for (int index = 0; index < itemCount; index += 1) {
            GuestCheckoutItemRequest item = new GuestCheckoutItemRequest();
            item.setProductId(500L);
            item.setQuantity(1);
            items.add(item);
        }
        request.setItems(items);
        return request;
    }

    private CheckoutRequest checkoutRequest() {
        CheckoutRequest request = new CheckoutRequest();
        request.setUserId(3L);
        request.setCartItemIds(List.of(12L));
        request.setShippingAddress("Buyer / 555-0100 / 100 Pet Commerce St");
        request.setRecipientName("Buyer");
        request.setRecipientPhone("555-0100");
        request.setPaymentMethod("STRIPE");
        return request;
    }

    private Order order(Long id, Long userId, String status) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(userId);
        order.setStatus(status);
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        return order;
    }

    private void assertReadOnlyTransactional(String methodName, Class<?>... parameterTypes) throws Exception {
        Method method = OrderService.class.getDeclaredMethod(methodName, parameterTypes);
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertTrue(transactional != null && transactional.readOnly(), methodName + " should be read-only transactional");
    }
}
