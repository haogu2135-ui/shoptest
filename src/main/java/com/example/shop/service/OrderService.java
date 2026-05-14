package com.example.shop.service;

import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.CouponQuoteRequest;
import com.example.shop.dto.CouponQuoteResponse;
import com.example.shop.dto.GuestCheckoutItemRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.OrderTrackResponse;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.entity.Product;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.entity.User;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.OrderRepository;
import com.example.shop.repository.OrderItemRepository;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderService {
    private static final String RETURN_REFUNDING = "RETURN_REFUNDING";


    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private OrderItemRepository orderItemRepository;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private CartItemMapper cartItemMapper;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CouponService couponService;
    @Autowired
    private ProductVariantService productVariantService;
    @Autowired
    private LogisticsCarrierService logisticsCarrierService;
    @Autowired
    private RefundService refundService;
    @Lazy
    @Autowired
    private OrderService self;

    @Value("${order.unpaid-timeout-minutes:30}")
    private long unpaidTimeoutMinutes;

    @Value("${order.default-shipping-fee:30.00}")
    private BigDecimal defaultShippingFee;

    @Value("${order.free-shipping-threshold:899.00}")
    private BigDecimal freeShippingThreshold;

    @Value("${order.return-window-days:7}")
    private long returnWindowDays;

    /**
     * 创建新订单
     */
    @Transactional
    public Order createOrder(Order order) {
        order.setOrderNo(nextOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.insert(order);
        return order;
    }

    @Transactional
    public Order checkout(CheckoutRequest request) {
        List<CartItem> selectedItems = prepareCheckoutItems(request.getUserId(), request.getCartItemIds(), true);
        CouponQuoteResponse quote = couponService.quote(request.getUserId(), selectedItems, request.getUserCouponId());
        BigDecimal originalAmount = quote.getSubtotal();
        BigDecimal shippingFee = calculateShippingFee(selectedItems);
        quote.setShippingFee(shippingFee);
        Long effectiveUserCouponId = quote.getSelectedUserCouponId();
        BigDecimal discountAmount = BigDecimal.ZERO;
        BigDecimal payableAmount = originalAmount.add(shippingFee);

        Order order = new Order();
        order.setOrderNo(nextOrderNo());
        order.setUserId(request.getUserId());
        order.setOriginalAmount(originalAmount);
        order.setDiscountAmount(discountAmount);
        order.setShippingFee(shippingFee);
        order.setTotalAmount(payableAmount);
        order.setStatus("PENDING_PAYMENT");
        order.setShippingAddress(request.getShippingAddress());
        order.setPaymentMethod(request.getPaymentMethod());
        order.setUserCouponId(effectiveUserCouponId);
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.insert(order);

        if (effectiveUserCouponId != null && quote.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
            CouponService.AppliedCoupon appliedCoupon = couponService.useCoupon(
                    request.getUserId(), effectiveUserCouponId, originalAmount, order.getId());
            order.setCouponId(appliedCoupon.getCouponId());
            order.setCouponName(appliedCoupon.getCouponName());
            order.setDiscountAmount(appliedCoupon.getDiscountAmount());
            order.setTotalAmount(originalAmount.subtract(appliedCoupon.getDiscountAmount()).max(BigDecimal.ZERO).add(shippingFee));
            orderRepository.update(order);
        }

        for (CartItem item : selectedItems) {
            OrderItem orderItem = new OrderItem();
            orderItem.setOrderId(order.getId());
            orderItem.setProductId(item.getProductId());
            orderItem.setQuantity(item.getQuantity());
            orderItem.setPrice(item.getPrice());
            orderItem.setProductNameSnapshot(item.getProductName());
            orderItem.setImageUrlSnapshot(item.getImageUrl());
            orderItem.setSelectedSpecs(item.getSelectedSpecs());
            orderItem.setCreatedAt(LocalDateTime.now());
            orderItemRepository.insert(orderItem);
        }

        cartItemMapper.deleteByIds(request.getCartItemIds());
        return order;
    }

    @Transactional
    public Order guestCheckout(GuestCheckoutRequest request) {
        Long guestUserId = getOrCreateGuestUser(request);
        List<CartItem> selectedItems = prepareGuestCheckoutItems(guestUserId, request.getItems(), true);
        BigDecimal originalAmount = selectedItems.stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal shippingFee = calculateShippingFee(selectedItems);

        Order order = new Order();
        order.setOrderNo(nextOrderNo());
        order.setUserId(guestUserId);
        order.setOriginalAmount(originalAmount);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setShippingFee(shippingFee);
        order.setTotalAmount(originalAmount.add(shippingFee));
        order.setStatus("PENDING_PAYMENT");
        order.setShippingAddress("[Guest] " + request.getGuestName() + " / " + request.getGuestPhone() + " / " + request.getGuestEmail() + " / " + request.getShippingAddress());
        order.setPaymentMethod(request.getPaymentMethod());
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.insert(order);

        for (CartItem item : selectedItems) {
            OrderItem orderItem = new OrderItem();
            orderItem.setOrderId(order.getId());
            orderItem.setProductId(item.getProductId());
            orderItem.setQuantity(item.getQuantity());
            orderItem.setPrice(item.getPrice());
            orderItem.setProductNameSnapshot(item.getProductName());
            orderItem.setImageUrlSnapshot(item.getImageUrl());
            orderItem.setSelectedSpecs(item.getSelectedSpecs());
            orderItem.setCreatedAt(LocalDateTime.now());
            orderItemRepository.insert(orderItem);
        }
        return order;
    }

    public CouponQuoteResponse quoteCheckout(CouponQuoteRequest request) {
        List<CartItem> selectedItems = prepareCheckoutItems(request.getUserId(), request.getCartItemIds(), false);
        CouponQuoteResponse quote = couponService.quote(request.getUserId(), selectedItems, request.getUserCouponId());
        BigDecimal shippingFee = calculateShippingFee(selectedItems);
        quote.setShippingFee(shippingFee);
        quote.setPayableAmount(quote.getSubtotal().subtract(quote.getDiscountAmount()).max(BigDecimal.ZERO).add(shippingFee));
        return quote;
    }

    private List<CartItem> prepareCheckoutItems(Long userId, List<Long> cartItemIds, boolean reserveStock) {
        List<CartItem> selectedItems = cartItemMapper.findByIds(cartItemIds);
        if (selectedItems.size() != cartItemIds.size()) {
            throw new IllegalArgumentException("Some selected cart items do not exist");
        }
        if (selectedItems.stream().anyMatch(item -> !userId.equals(item.getUserId()))) {
            throw new IllegalArgumentException("Selected cart items do not belong to this user");
        }
        for (CartItem item : selectedItems) {
            Optional<Product> productOpt = productRepository.findById(item.getProductId());
            if (!productOpt.isPresent()) {
                throw new IllegalArgumentException("Product not found: " + item.getProductId());
            }
            Product product = productOpt.get();
            if (!"ACTIVE".equals(product.getStatus())) {
                throw new IllegalArgumentException("Product is not available: " + product.getName());
            }
            if (item.getQuantity() == null || item.getQuantity() <= 0) {
                throw new IllegalArgumentException("Invalid quantity");
            }
            productVariantService.validateSelection(product, item.getSelectedSpecs());
            Integer availableStock = productVariantService.resolveStock(product, item.getSelectedSpecs());
            if (availableStock == null || availableStock < item.getQuantity()) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
            }
            if (reserveStock) {
                productVariantService.decreaseVariantStock(product, item.getSelectedSpecs(), item.getQuantity());
                if (product.getStock() == null || product.getStock() < item.getQuantity()) {
                    throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
                }
                product.setStock(product.getStock() - item.getQuantity());
                productRepository.save(product);
            }
            BigDecimal effectivePrice = productVariantService.resolvePrice(product, item.getSelectedSpecs());
            item.setPrice(effectivePrice);
        }
        return selectedItems;
    }

    private List<CartItem> prepareGuestCheckoutItems(Long userId, List<GuestCheckoutItemRequest> items, boolean reserveStock) {
        return items.stream().map(requestItem -> {
            Optional<Product> productOpt = productRepository.findById(requestItem.getProductId());
            if (!productOpt.isPresent()) {
                throw new IllegalArgumentException("Product not found: " + requestItem.getProductId());
            }
            Product product = productOpt.get();
            if (!"ACTIVE".equals(product.getStatus())) {
                throw new IllegalArgumentException("Product is not available: " + product.getName());
            }
            if (requestItem.getQuantity() == null || requestItem.getQuantity() <= 0) {
                throw new IllegalArgumentException("Invalid quantity");
            }
            String normalizedSpecs = productVariantService.normalizeSpecs(requestItem.getSelectedSpecs());
            productVariantService.validateSelection(product, normalizedSpecs);
            Integer availableStock = productVariantService.resolveStock(product, normalizedSpecs);
            if (availableStock == null || availableStock < requestItem.getQuantity()) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
            }
            if (reserveStock) {
                productVariantService.decreaseVariantStock(product, normalizedSpecs, requestItem.getQuantity());
                if (product.getStock() == null || product.getStock() < requestItem.getQuantity()) {
                    throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
                }
                product.setStock(product.getStock() - requestItem.getQuantity());
                productRepository.save(product);
            }
            CartItem item = new CartItem();
            item.setUserId(userId);
            item.setProductId(product.getId());
            item.setQuantity(requestItem.getQuantity());
            item.setPrice(productVariantService.resolvePrice(product, normalizedSpecs));
            item.setSelectedSpecs(normalizedSpecs);
            item.setProductName(product.getName());
            item.setImageUrl(product.getImageUrl());
            item.setStock(product.getStock());
            item.setProductStatus(product.getStatus());
            return item;
        }).collect(Collectors.toList());
    }

    private Long getOrCreateGuestUser(GuestCheckoutRequest request) {
        String email = request.getGuestEmail().trim().toLowerCase();
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User user = existing.get();
            if (!"GUEST".equals(user.getStatus())) {
                throw new IllegalArgumentException("This email is already registered. Please sign in before checkout.");
            }
            return user.getId();
        }
        User user = new User();
        String usernameSeed = "guest_" + email.replaceAll("[^a-z0-9]+", "_");
        if (usernameSeed.length() > 36) {
            usernameSeed = usernameSeed.substring(0, 36);
        }
        user.setUsername(usernameSeed + "_" + UUID.randomUUID().toString().substring(0, 8));
        user.setEmail(email);
        user.setPhone(null);
        user.setPassword(UUID.randomUUID().toString());
        user.setRole("USER");
        user.setStatus("GUEST");
        user.setAddress(request.getShippingAddress());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user).getId();
    }

    private BigDecimal calculateShippingFee(List<CartItem> items) {
        if (items == null || items.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal subtotal = items.stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (freeShippingThreshold != null
                && freeShippingThreshold.compareTo(BigDecimal.ZERO) > 0
                && subtotal.compareTo(freeShippingThreshold) >= 0) {
            return BigDecimal.ZERO;
        }
        boolean allItemsFreeShipping = true;
        for (CartItem item : items) {
            Product product = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + item.getProductId()));
            BigDecimal lineAmount = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            boolean freeBySwitch = Boolean.TRUE.equals(product.getFreeShipping());
            boolean freeByThreshold = product.getFreeShippingThreshold() != null
                    && product.getFreeShippingThreshold().compareTo(BigDecimal.ZERO) > 0
                    && lineAmount.compareTo(product.getFreeShippingThreshold()) >= 0;
            if (!freeBySwitch && !freeByThreshold) {
                allItemsFreeShipping = false;
                break;
            }
        }
        return allItemsFreeShipping ? BigDecimal.ZERO : defaultShippingFee;
    }

    /**
     * 获取所有订单
     */
    public List<Order> getAllOrders() {
        return orderRepository.findAll().stream()
                .map(this::enrichReturnInfo)
                .collect(Collectors.toList());
    }

    /**
     * 根据ID获取订单
     */
    public Order getOrderById(Long id) {
        return enrichReturnInfo(orderRepository.findById(id));
    }

    public OrderTrackResponse trackOrder(String orderNo, String email) {
        if (orderNo == null || orderNo.trim().isEmpty()) {
            throw new IllegalArgumentException("Order number is required");
        }
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        Order order = orderRepository.findByOrderNoAndEmail(orderNo.trim(), email.trim().toLowerCase());
        if (order == null) {
            throw new IllegalArgumentException("Order not found");
        }
        enrichReturnInfo(order);
        return new OrderTrackResponse(order, orderItemRepository.findByOrderId(order.getId()));
    }

    /**
     * 更新订单信息
     */
    @Transactional
    public boolean updateOrder(Order order) {
        return orderRepository.update(order) > 0;
    }

    /**
     * 删除订单
     */
    @Transactional
    public boolean deleteOrder(Long id) {
        return orderRepository.deleteById(id) > 0;
    }

    /**
     * 根据用户ID获取订单列表
     */
    public List<Order> getOrdersByUserId(Long userId) {
        return orderRepository.findByUserId(userId).stream()
                .map(this::enrichReturnInfo)
                .collect(Collectors.toList());
    }

    @Transactional
    public boolean updateOrderStatus(Long id, String status) {
        Order order = getOrderById(id);
        if (order == null) {
            return false;
        }
        assertNextStatus(order.getStatus(), status);
        return orderRepository.updateStatus(id, status) > 0;
    }

    @Transactional
    public boolean cancelOrder(Long id) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        assertNextStatus(order.getStatus(), "CANCELLED");
        int updated = orderRepository.updateStatusIfCurrent(id, order.getStatus(), "CANCELLED");
        if (updated == 0) {
            return false;
        }
        List<OrderItem> items = orderItemRepository.findByOrderId(id);
        for (OrderItem item : items) {
            restoreStock(item);
        }
        if ("PENDING_PAYMENT".equals(order.getStatus())) {
            couponService.releaseUsedCoupon(order.getUserCouponId());
        }
        return true;
    }

    @Scheduled(fixedDelayString = "${order.expiry-scan-ms:60000}")
    public void cancelExpiredUnpaidOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(unpaidTimeoutMinutes);
        for (Order order : orderRepository.findPendingPaymentBefore(cutoff)) {
            try {
                self.cancelSingleExpiredOrder(order.getId());
            } catch (RuntimeException ignored) {
                // Keep scheduler healthy; a raced order status should not break the full scan cycle.
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void cancelSingleExpiredOrder(Long orderId) {
        Order order = orderRepository.findById(orderId);
        if (order == null || !"PENDING_PAYMENT".equals(order.getStatus())) {
            return;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(unpaidTimeoutMinutes);
        if (order.getCreatedAt() == null || !order.getCreatedAt().isBefore(cutoff)) {
            return;
        }
        Payment pendingPayment = paymentRepository.findPendingByOrderId(order.getId());
        if (pendingPayment != null
                && pendingPayment.getExpiresAt() != null
                && pendingPayment.getExpiresAt().isAfter(LocalDateTime.now())) {
            return;
        }
        cancelOrder(order.getId());
    }

    @Transactional
    public boolean requestReturn(Long id, Long userId, String reason) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (userId != null && !userId.equals(order.getUserId())) {
            throw new IllegalStateException("Order does not belong to this user");
        }
        if (!"COMPLETED".equals(order.getStatus())) {
            throw new IllegalStateException("Only completed orders can request return");
        }
        LocalDateTime deadline = calculateReturnDeadline(order);
        if (deadline == null || LocalDateTime.now().isAfter(deadline)) {
            throw new IllegalStateException("Return window has expired");
        }
        String cleanedReason = reason == null ? "" : reason.trim();
        if (cleanedReason.length() > 500) {
            throw new IllegalArgumentException("Return reason must be 500 characters or less");
        }
        return orderRepository.requestReturnIfCurrent(id, "COMPLETED", cleanedReason) > 0;
    }

    @Transactional
    public boolean approveReturn(Long id) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (!"RETURN_REQUESTED".equals(order.getStatus())) {
            throw new IllegalStateException("Only return-requested orders can be approved");
        }
        return orderRepository.approveReturnIfCurrent(id, "RETURN_REQUESTED") > 0;
    }

    @Transactional
    public boolean rejectReturn(Long id) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (!"RETURN_REQUESTED".equals(order.getStatus())) {
            throw new IllegalStateException("Only return-requested orders can be rejected");
        }
        return orderRepository.rejectReturnIfCurrent(id, "RETURN_REQUESTED") > 0;
    }

    @Transactional
    public boolean submitReturnShipment(Long id, Long userId, String returnTrackingNumber) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (userId != null && !userId.equals(order.getUserId())) {
            throw new IllegalStateException("Order does not belong to this user");
        }
        if (!"RETURN_APPROVED".equals(order.getStatus())) {
            throw new IllegalStateException("Only approved return orders can submit return shipment");
        }
        if (returnTrackingNumber == null || returnTrackingNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Return tracking number is required");
        }
        return orderRepository.updateReturnTracking(id, "RETURN_SHIPPED", returnTrackingNumber.trim()) > 0;
    }

    @Transactional
    public boolean completeReturn(Long id) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (!"RETURN_SHIPPED".equals(order.getStatus())) {
            throw new IllegalStateException("Only return-shipped orders can be completed");
        }
        int claimed = orderRepository.markReturnRefundingIfCurrent(id, "RETURN_SHIPPED", RETURN_REFUNDING);
        if (claimed == 0) {
            Order latest = orderRepository.findById(id);
            if (latest != null && "RETURNED".equals(latest.getStatus())) {
                return true;
            }
            return false;
        }
        refundService.refundPaidPayment(order);
        int updated = orderRepository.completeReturnAndRefundIfCurrent(id, RETURN_REFUNDING);
        if (updated == 0) {
            Order latest = orderRepository.findById(id);
            if (latest != null && "RETURNED".equals(latest.getStatus())) {
                return true;
            }
            throw new IllegalStateException("Return refund finalization failed");
        }
        List<OrderItem> items = orderItemRepository.findByOrderId(id);
        for (OrderItem item : items) {
            restoreStock(item);
        }
        return true;
    }

    private void restoreStock(OrderItem item) {
        Optional<Product> productOpt = productRepository.findById(item.getProductId());
        if (!productOpt.isPresent()) {
            return;
        }
        Product product = productOpt.get();
        productVariantService.increaseVariantStock(product, item.getSelectedSpecs(), item.getQuantity());
        product.setStock((product.getStock() == null ? 0 : product.getStock()) + item.getQuantity());
        productRepository.save(product);
    }

    @Transactional
    public boolean shipOrder(Long id, String trackingNumber) {
        return shipOrder(id, trackingNumber, null);
    }

    @Transactional
    public boolean shipOrder(Long id, String trackingNumber, String trackingCarrierCode) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (trackingNumber == null || trackingNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Tracking number is required");
        }
        String carrierCode = trackingCarrierCode == null ? null : trackingCarrierCode.trim();
        String carrierName = null;
        if (carrierCode != null && !carrierCode.isEmpty()) {
            final String requestedCarrierCode = carrierCode;
            LogisticsCarrier carrier = logisticsCarrierService.findAll(false).stream()
                    .filter(item -> item.getTrackingCode() != null && item.getTrackingCode().equalsIgnoreCase(requestedCarrierCode))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Carrier is not configured"));
            if (!"ACTIVE".equals(carrier.getStatus())) {
                throw new IllegalArgumentException("Carrier is disabled");
            }
            carrierCode = carrier.getTrackingCode();
            carrierName = carrier.getName();
        }
        assertNextStatus(order.getStatus(), "SHIPPED");
        return orderRepository.updateShipping(id, "SHIPPED", trackingNumber.trim(), carrierCode, carrierName) > 0;
    }

    public void assertNextStatus(String currentStatus, String nextStatus) {
        Map<String, String> next = Map.of(
                "PENDING_PAYMENT", "PENDING_SHIPMENT",
                "PENDING_SHIPMENT", "SHIPPED",
                "SHIPPED", "COMPLETED",
                "COMPLETED", "RETURN_REQUESTED",
                "RETURN_REQUESTED", "RETURN_APPROVED",
                "RETURN_APPROVED", "RETURN_SHIPPED",
                "RETURN_SHIPPED", "RETURNED"
        );
        if ("CANCELLED".equals(nextStatus)
                && ("PENDING_PAYMENT".equals(currentStatus) || "PENDING_SHIPMENT".equals(currentStatus))) {
            return;
        }
        if (!nextStatus.equals(next.get(currentStatus))) {
            throw new IllegalStateException("Invalid order status transition: " + currentStatus + " -> " + nextStatus);
        }
    }

    private String nextOrderNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "SO" + date + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    public long count() {
        return orderRepository.findAll().size();
    }

    public BigDecimal getTotalRevenue() {
        return orderRepository.findAll().stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Map<String, Long> getStatusBreakdown() {
        return orderRepository.findAll().stream()
                .collect(Collectors.groupingBy(Order::getStatus, LinkedHashMap::new, Collectors.counting()));
    }

    private Order enrichReturnInfo(Order order) {
        if (order == null) {
            return null;
        }
        LocalDateTime deadline = calculateReturnDeadline(order);
        order.setReturnDeadline(deadline);
        order.setReturnable("COMPLETED".equals(order.getStatus())
                && deadline != null
                && !LocalDateTime.now().isAfter(deadline));
        return order;
    }

    private LocalDateTime calculateReturnDeadline(Order order) {
        if (order == null || returnWindowDays <= 0) {
            return null;
        }
        LocalDateTime completedAt = resolveCompletedAt(order);
        return completedAt == null ? null : completedAt.plusDays(returnWindowDays);
    }

    private LocalDateTime resolveCompletedAt(Order order) {
        if (order.getCompletedAt() != null) {
            return order.getCompletedAt();
        }
        return order.getUpdatedAt() != null ? order.getUpdatedAt() : order.getCreatedAt();
    }
}
