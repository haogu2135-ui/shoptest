package com.example.shop.service;

import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.CouponQuoteRequest;
import com.example.shop.dto.CouponQuoteResponse;
import com.example.shop.dto.GuestCheckoutItemRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.OrderCustomerResponse;
import com.example.shop.dto.OrderItemCustomerResponse;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OrderService {
    private static final String RETURN_REFUNDING = "RETURN_REFUNDING";
    private static final Set<String> RECONCILIATION_REFUNDABLE_STATUSES = Set.of("PENDING_PAYMENT", "CANCELLED");

    private static final List<String> DASHBOARD_REVENUE_STATUSES = List.of(
            "PENDING_SHIPMENT",
            "SHIPPED",
            "COMPLETED",
            "RETURN_REQUESTED",
            "RETURN_APPROVED",
            "RETURN_SHIPPED",
            RETURN_REFUNDING);

    private static final List<String> ADMIN_ORDER_SUMMARY_KEYS = List.of(
            "NEEDS_ACTION",
            "SLA_OVERDUE",
            "SLA_DUE_SOON",
            "MISSING_TRACKING",
            "PENDING_SHIPMENT",
            "RETURN_REQUESTED",
            "RETURN_SHIPPED",
            "AFTER_SALES",
            "REFUNDING",
            "REFUNDED");

    private static final String GUEST_USERNAME_PREFIX = "guest_";
    private static final int GUEST_USERNAME_MAX_LENGTH = 50;
    private static final int GUEST_USERNAME_TOKEN_LENGTH = 32;
    private static final int GUEST_USERNAME_SEED_MAX_LENGTH =
            GUEST_USERNAME_MAX_LENGTH - GUEST_USERNAME_TOKEN_LENGTH - 1;

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
    @Autowired
    private RuntimeConfigService runtimeConfig;
    @Autowired(required = false)
    private PaymentChannelAvailabilityService paymentChannelAvailabilityService;
    @Autowired(required = false)
    private NotificationService notificationService;
    @Autowired(required = false)
    private OrderEmailNotificationService orderEmailNotificationService;
    @Lazy
    @Autowired
    private OrderService self;

    /**
     * 创建新订单
     */
    @Transactional
    public Order createOrder(Order order) {
        throw new IllegalStateException("Direct order creation is disabled; use checkout flows");
    }

    private void normalizeDirectOrder(Order order) {
        if (order == null) {
            throw new IllegalArgumentException("Order payload is required");
        }
        if (order.getUserId() == null || order.getUserId() <= 0) {
            throw new IllegalArgumentException("userId is required");
        }
        LocalDateTime now = LocalDateTime.now();
        if (order.getTotalAmount() == null && order.getOriginalAmount() == null) {
            throw new IllegalArgumentException("Order amount is required; use /orders/checkout/me for cart checkout");
        }
        order.setOrderNo(nextOrderNo());
        order.setStatus("PENDING_PAYMENT");
        order.setOriginalAmount(normalizeMoney(defaultAmount(order.getOriginalAmount(), order.getTotalAmount())));
        order.setDiscountAmount(normalizeMoney(defaultAmount(order.getDiscountAmount(), BigDecimal.ZERO)));
        order.setShippingFee(normalizeMoney(defaultAmount(order.getShippingFee(), BigDecimal.ZERO)));
        if (order.getTotalAmount() == null) {
            BigDecimal calculatedTotal = order.getOriginalAmount()
                    .subtract(order.getDiscountAmount())
                    .max(BigDecimal.ZERO)
                    .add(order.getShippingFee());
            order.setTotalAmount(normalizeMoney(calculatedTotal));
        } else {
            order.setTotalAmount(normalizeMoney(order.getTotalAmount()));
        }
        if (order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("totalAmount must be greater than 0");
        }
        if (trimToNull(order.getShippingAddress()) == null) {
            throw new IllegalArgumentException("Shipping address is required");
        }
        order.setShippingAddress(order.getShippingAddress().trim());
        order.setPaymentMethod(trimToNull(order.getPaymentMethod()) == null ? "MANUAL" : order.getPaymentMethod().trim());
        order.setCreatedAt(order.getCreatedAt() == null ? now : order.getCreatedAt());
        order.setUpdatedAt(now);
    }

    private BigDecimal defaultAmount(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        BigDecimal normalized = value == null ? BigDecimal.ZERO : value;
        return normalized.setScale(2, RoundingMode.HALF_UP);
    }

    @Transactional
    public Order checkout(CheckoutRequest request) {
        normalizeCheckoutRequest(request);
        requirePaymentChannelAvailable(request.getPaymentMethod());
        List<CartItem> selectedItems = prepareCheckoutItems(request.getUserId(), request.getCartItemIds(), true);
        CouponQuoteResponse quote = couponService.quote(request.getUserId(), selectedItems, request.getUserCouponId());
        BigDecimal originalAmount = quote.getSubtotal();
        Map<Long, Product> productById = loadProductsForCartItems(selectedItems);
        BigDecimal shippingFee = calculateShippingFee(selectedItems, productById);
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
        order.setRecipientName(request.getRecipientName());
        order.setRecipientPhone(request.getRecipientPhone());
        order.setContactEmail(firstNonBlank(request.getContactEmail(), accountEmailForUser(request.getUserId())));
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
        normalizeGuestCheckoutRequest(request);
        requirePaymentChannelAvailable(request.getPaymentMethod());
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
        order.setRecipientName(request.getGuestName());
        order.setRecipientPhone(request.getGuestPhone());
        order.setContactEmail(request.getGuestEmail());
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
        request.setCartItemIds(normalizeCheckoutItemIds(request.getCartItemIds()));
        List<CartItem> selectedItems = prepareCheckoutItems(request.getUserId(), request.getCartItemIds(), false);
        CouponQuoteResponse quote = couponService.quote(request.getUserId(), selectedItems, request.getUserCouponId());
        Map<Long, Product> productById = loadProductsForCartItems(selectedItems);
        BigDecimal shippingFee = calculateShippingFee(selectedItems, productById);
        quote.setShippingFee(shippingFee);
        quote.setPayableAmount(quote.getSubtotal().subtract(quote.getDiscountAmount()).max(BigDecimal.ZERO).add(shippingFee));
        return quote;
    }

    private List<CartItem> prepareCheckoutItems(Long userId, List<Long> cartItemIds, boolean reserveStock) {
        cartItemIds = normalizeCheckoutItemIds(cartItemIds);
        List<CartItem> selectedItems = cartItemMapper.findByIds(cartItemIds);
        assertCheckoutItemOwnership(userId, cartItemIds, selectedItems);
        Map<Long, Product> productById = loadProductsForCartItems(selectedItems, reserveStock);
        if (reserveStock) {
            selectedItems = cartItemMapper.findByIdsForUpdate(cartItemIds);
            assertCheckoutItemOwnership(userId, cartItemIds, selectedItems);
        }
        for (CartItem item : selectedItems) {
            Product product = productById.get(item.getProductId());
            if (product == null) {
                throw new IllegalArgumentException("Product not found: " + item.getProductId());
            }
            if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
                throw new IllegalArgumentException("Product is not available: " + product.getName());
            }
            normalizeQuantity(item.getQuantity());
            productVariantService.validateSelection(product, item.getSelectedSpecs());
            Integer availableStock = productVariantService.resolveStock(product, item.getSelectedSpecs());
            if (availableStock == null || availableStock < item.getQuantity()) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
            }
            if (reserveStock) {
                reserveProductStock(product, item.getSelectedSpecs(), item.getQuantity());
            }
            BigDecimal effectivePrice = productVariantService.resolvePrice(product, item.getSelectedSpecs());
            item.setProductName(product.getName());
            item.setImageUrl(resolveProductImageUrl(product));
            item.setPrice(effectivePrice);
        }
        return selectedItems;
    }

    private void assertCheckoutItemOwnership(Long userId, List<Long> cartItemIds, List<CartItem> selectedItems) {
        if (selectedItems.size() != cartItemIds.size()) {
            throw new IllegalArgumentException("Some selected cart items do not exist");
        }
        if (selectedItems.stream().anyMatch(item -> !userId.equals(item.getUserId()))) {
            throw new IllegalArgumentException("Selected cart items do not belong to this user");
        }
    }

    private List<CartItem> prepareGuestCheckoutItems(Long userId, List<GuestCheckoutItemRequest> items, boolean reserveStock) {
        List<Long> productIds = items.stream()
                .map(GuestCheckoutItemRequest::getProductId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
        Map<Long, Product> productById = (reserveStock
                ? productRepository.findAllByIdForUpdate(productIds)
                : productRepository.findAllById(productIds)).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        return items.stream().map(requestItem -> {
            Product product = productById.get(requestItem.getProductId());
            if (product == null) {
                throw new IllegalArgumentException("Product not found: " + requestItem.getProductId());
            }
            if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
                throw new IllegalArgumentException("Product is not available: " + product.getName());
            }
            int normalizedQuantity = normalizeQuantity(requestItem.getQuantity());
            String normalizedSpecs = productVariantService.normalizeSpecs(requestItem.getSelectedSpecs());
            productVariantService.validateSelection(product, normalizedSpecs);
            Integer availableStock = productVariantService.resolveStock(product, normalizedSpecs);
            if (availableStock == null || availableStock < normalizedQuantity) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
            }
            if (reserveStock) {
                reserveProductStock(product, normalizedSpecs, normalizedQuantity);
            }
            CartItem item = new CartItem();
            item.setUserId(userId);
            item.setProductId(product.getId());
            item.setQuantity(normalizedQuantity);
            item.setPrice(productVariantService.resolvePrice(product, normalizedSpecs));
            item.setSelectedSpecs(normalizedSpecs);
            item.setProductName(product.getName());
            item.setImageUrl(resolveProductImageUrl(product));
            item.setStock(product.getStock());
            item.setProductStatus(product.getStatus());
            return item;
        }).collect(Collectors.toList());
    }

    private String resolveProductImageUrl(Product product) {
        if (product == null) {
            return null;
        }
        if (product.getImageUrl() != null && !product.getImageUrl().trim().isEmpty()) {
            return product.getImageUrl().trim();
        }
        for (String image : product.getImagesList()) {
            if (image != null && !image.trim().isEmpty()) {
                return image.trim();
            }
        }
        return null;
    }

    private void reserveProductStock(Product product, String selectedSpecs, int quantity) {
        if (product.getStock() != null) {
            if (product.getStock() < quantity) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
            }
            product.setStock(product.getStock() - quantity);
        }
        boolean reservedVariantStock = productVariantService.decreaseVariantStock(product, selectedSpecs, quantity);
        if (product.getStock() == null && !reservedVariantStock) {
            throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
        }
        productRepository.save(product);
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
        user.setUsername(generateGuestUsername(email));
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

    private String generateGuestUsername(String email) {
        String usernameSeed = GUEST_USERNAME_PREFIX + email.replaceAll("[^a-z0-9]+", "_");
        if (usernameSeed.length() > GUEST_USERNAME_SEED_MAX_LENGTH) {
            usernameSeed = usernameSeed.substring(0, GUEST_USERNAME_SEED_MAX_LENGTH);
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        return usernameSeed + "_" + token;
    }

    private BigDecimal calculateShippingFee(List<CartItem> items) {
        return calculateShippingFee(items, loadProductsForCartItems(items));
    }

    private BigDecimal calculateShippingFee(List<CartItem> items, Map<Long, Product> productById) {
        if (items == null || items.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal subtotal = items.stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal threshold = runtimeConfig.getBigDecimal("order.free-shipping-threshold", new BigDecimal("899.00"));
        if (threshold != null
                && threshold.compareTo(BigDecimal.ZERO) > 0
                && subtotal.compareTo(threshold) >= 0) {
            return BigDecimal.ZERO;
        }
        boolean allItemsFreeShipping = true;
        for (CartItem item : items) {
            Product product = productById.get(item.getProductId());
            if (product == null) {
                throw new IllegalArgumentException("Product not found: " + item.getProductId());
            }
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
        return allItemsFreeShipping ? BigDecimal.ZERO : runtimeConfig.getBigDecimal("order.default-shipping-fee", new BigDecimal("30.00"));
    }

    private Map<Long, Product> loadProductsForCartItems(List<CartItem> items) {
        return loadProductsForCartItems(items, false);
    }

    private Map<Long, Product> loadProductsForCartItems(List<CartItem> items, boolean forUpdate) {
        if (items == null || items.isEmpty()) {
            return Map.of();
        }
        List<Long> productIds = items.stream()
                .map(CartItem::getProductId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
        return (forUpdate
                ? productRepository.findAllByIdForUpdate(productIds)
                : productRepository.findAllById(productIds)).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
    }

    private void normalizeCheckoutRequest(CheckoutRequest request) {
        request.setCartItemIds(normalizeCheckoutItemIds(request.getCartItemIds()));
        request.setShippingAddress(normalizeRequiredText(request.getShippingAddress(), "Shipping address", runtimeConfig.getInt("order.shipping-address-max-chars", 500)));
        request.setRecipientName(firstNonBlank(
                normalizeOptionalText(request.getRecipientName(), "Recipient name", runtimeConfig.getInt("order.recipient-name-max-chars", 120)),
                parsedAddressPart(request.getShippingAddress(), 0)));
        request.setRecipientPhone(firstNonBlank(
                normalizeOptionalText(request.getRecipientPhone(), "Recipient phone", runtimeConfig.getInt("order.recipient-phone-max-chars", 60)),
                parsedAddressPart(request.getShippingAddress(), 1)));
        request.setContactEmail(normalizeOptionalEmail(request.getContactEmail(), "Contact email", runtimeConfig.getInt("order.contact-email-max-chars", 160)));
        request.setPaymentMethod(normalizeRequiredText(request.getPaymentMethod(), "Payment method", runtimeConfig.getInt("order.payment-method-max-chars", 40)));
    }

    private void normalizeGuestCheckoutRequest(GuestCheckoutRequest request) {
        request.setGuestEmail(normalizeRequiredText(request.getGuestEmail(), "Guest email", 120).toLowerCase());
        request.setGuestName(normalizeRequiredText(request.getGuestName(), "Guest name", runtimeConfig.getInt("order.guest-name-max-chars", 80)));
        request.setGuestPhone(normalizeRequiredText(request.getGuestPhone(), "Guest phone", runtimeConfig.getInt("order.guest-phone-max-chars", 40)));
        request.setShippingAddress(normalizeRequiredText(request.getShippingAddress(), "Shipping address", runtimeConfig.getInt("order.shipping-address-max-chars", 500)));
        request.setPaymentMethod(normalizeRequiredText(request.getPaymentMethod(), "Payment method", runtimeConfig.getInt("order.payment-method-max-chars", 40)));
        request.setItems(normalizeGuestItems(request.getItems()));
    }

    private void requirePaymentChannelAvailable(String paymentMethod) {
        if (paymentChannelAvailabilityService != null) {
            paymentChannelAvailabilityService.requireAvailableForCheckout(paymentMethod);
        }
    }

    private List<Long> normalizeCheckoutItemIds(List<Long> cartItemIds) {
        if (cartItemIds == null || cartItemIds.isEmpty()) {
            throw new IllegalArgumentException("No checkout items selected");
        }
        List<Long> positiveIds = cartItemIds.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
        if (positiveIds.size() != cartItemIds.size()) {
            throw new IllegalArgumentException("Invalid checkout items selected");
        }
        int checkoutLineLimit = Math.max(1, runtimeConfig.getInt("order.max-checkout-lines", 80));
        if (positiveIds.size() > checkoutLineLimit
                || new HashSet<>(positiveIds).size() != positiveIds.size()) {
            throw new IllegalArgumentException("Too many checkout items selected");
        }
        List<Long> normalized = positiveIds.stream()
                .limit(checkoutLineLimit)
                .collect(Collectors.toList());
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("No checkout items selected");
        }
        return normalized;
    }

    private List<GuestCheckoutItemRequest> normalizeGuestItems(List<GuestCheckoutItemRequest> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("No checkout items selected");
        }
        if (items.size() > Math.max(1, runtimeConfig.getInt("order.max-checkout-lines", 80))) {
            throw new IllegalArgumentException("Too many checkout items selected");
        }
        List<GuestCheckoutItemRequest> normalized = new ArrayList<>();
        for (GuestCheckoutItemRequest item : items) {
            if (item == null || item.getProductId() == null || item.getProductId() <= 0) {
                throw new IllegalArgumentException("Invalid product");
            }
            item.setQuantity(normalizeQuantity(item.getQuantity()));
            item.setSelectedSpecs(productVariantService.normalizeSpecs(item.getSelectedSpecs()));
            normalized.add(item);
        }
        return normalized;
    }

    private int normalizeQuantity(Integer quantity) {
        int normalized = quantity == null ? 0 : quantity;
        if (normalized <= 0 || normalized > Math.max(1, runtimeConfig.getInt("order.max-quantity-per-line", 99))) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        return normalized;
    }

    private String normalizeRequiredText(String value, String field, int maxLength) {
        String normalized = normalizeText(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        if (normalized.length() > Math.max(1, maxLength)) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value, String field, int maxLength) {
        String normalized = normalizeText(value);
        if (normalized.length() > Math.max(1, maxLength)) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private String normalizeOptionalEmail(String value, String field, int maxLength) {
        String normalized = normalizeOptionalText(value, field, maxLength);
        if (normalized.isEmpty()) {
            return null;
        }
        String email = normalizeEmail(normalized);
        if (email == null) {
            throw new IllegalArgumentException(field + " is invalid");
        }
        return email;
    }

    private String parsedAddressPart(String shippingAddress, int index) {
        String[] parts = normalizeText(shippingAddress).split("\\s*/\\s*", 3);
        if (parts.length <= index) {
            return "";
        }
        return normalizeText(parts[index]);
    }

    private String normalizeText(String value) {
        return String.valueOf(value == null ? "" : value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    /**
     * 获取所有订单
     */
    public List<Order> getAllOrders() {
        int legacyListLimit = Math.max(1, Math.min(runtimeConfig.getInt("admin.orders.legacy-list-max-rows", 100), 5000));
        return orderRepository.searchAdminOrders(null, null, null, 0, legacyListLimit).stream()
                .map(this::enrichReturnInfo)
                .collect(Collectors.toList());
    }

    public LocalDateTime currentDatabaseTime() {
        LocalDateTime now = orderRepository.currentDatabaseTime();
        return now != null ? now : LocalDateTime.now();
    }

    public List<String> dashboardRevenueStatuses() {
        return DASHBOARD_REVENUE_STATUSES;
    }

    public Map<String, Object> getDashboardOrderStats(LocalDateTime now, int trendDays, int recentLimit) {
        LocalDateTime basis = now != null ? now : currentDatabaseTime();
        Map<String, Object> row = orderRepository.dashboardOrderStats(basis);
        long totalOrders = mapLong(row, "totalOrders");
        long paidOrders = mapLong(row, "paidOrders");
        long refundedOrders = mapLong(row, "refundedOrders");
        BigDecimal netRevenue = mapBigDecimal(row, "netRevenue");
        BigDecimal refundedAmount = mapBigDecimal(row, "refundedAmount");
        BigDecimal grossPaidRevenue = netRevenue.add(refundedAmount);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalOrders", totalOrders);
        stats.put("totalRevenue", grossPaidRevenue);
        stats.put("grossPaidRevenue", grossPaidRevenue);
        stats.put("refundedOrders", refundedOrders);
        stats.put("refundedAmount", refundedAmount);
        stats.put("netRevenue", netRevenue);
        stats.put("grossOrderAmount", mapBigDecimal(row, "grossOrderAmount"));
        stats.put("paidOrders", paidOrders);
        stats.put("cancelledOrders", mapLong(row, "cancelledOrders"));
        stats.put("pendingPaymentOrders", mapLong(row, "pendingPaymentOrders"));
        stats.put("pendingShipmentOrders", mapLong(row, "pendingShipmentOrders"));
        stats.put("shippedOrders", mapLong(row, "shippedOrders"));
        stats.put("ordersWithTracking", mapLong(row, "ordersWithTracking"));
        stats.put("ordersWithoutTracking", mapLong(row, "ordersWithoutTracking"));
        stats.put("completedOrders", mapLong(row, "completedOrders"));
        stats.put("averageOrderValue", paidOrders == 0
                ? BigDecimal.ZERO
                : netRevenue.divide(BigDecimal.valueOf(paidOrders), 2, RoundingMode.HALF_UP));
        stats.put("conversionRate", totalOrders == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(paidOrders * 100L).divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP));
        stats.put("refundRate", grossPaidRevenue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : refundedAmount.multiply(BigDecimal.valueOf(100L)).divide(grossPaidRevenue, 2, RoundingMode.HALF_UP));

        Map<String, Object> slaRisks = new LinkedHashMap<>();
        slaRisks.put("stalePendingPayment", mapLong(row, "stalePendingPayment"));
        slaRisks.put("delayedShipment", mapLong(row, "delayedShipment"));
        slaRisks.put("returnAwaitingShipment", mapLong(row, "returnAwaitingShipment"));
        slaRisks.put("refundDue", mapLong(row, "refundDue"));
        stats.put("operationsSlaRisks", slaRisks);
        stats.put("operationsSlaRiskTotal", slaRisks.values().stream()
                .filter(Number.class::isInstance)
                .map(Number.class::cast)
                .mapToLong(Number::longValue)
                .sum());
        stats.put("orderStatusBreakdown", getStatusBreakdown());
        stats.put("recentOrders", findRecentAdminOrders(recentLimit));
        stats.put("salesTrend", dashboardSalesTrend(basis.toLocalDate(), trendDays));
        stats.put("paymentMethodBreakdown", dashboardPaymentMethodBreakdown());
        return stats;
    }

    private List<Order> findRecentAdminOrders(int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 5 : limit, 20));
        return orderRepository.findRecentAdminOrders(safeLimit).stream()
                .map(this::enrichReturnInfo)
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> dashboardSalesTrend(LocalDate today, int days) {
        int safeDays = Math.max(1, Math.min(days <= 0 ? 7 : days, 31));
        LocalDate end = today != null ? today : LocalDate.now();
        LocalDate start = end.minusDays(safeDays - 1L);
        Map<String, Map<String, Object>> rowsByDate = new LinkedHashMap<>();
        for (Map<String, Object> row : orderRepository.dashboardSalesTrend(start.atStartOfDay())) {
            String date = mapDateString(mapValue(row, "trendDate"));
            if (date != null) {
                rowsByDate.put(date, row);
            }
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int offset = 0; offset < safeDays; offset++) {
            String date = start.plusDays(offset).toString();
            Map<String, Object> row = rowsByDate.get(date);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", date);
            item.put("orders", mapLong(row, "orderCount"));
            item.put("revenue", mapBigDecimal(row, "revenue"));
            trend.add(item);
        }
        return trend;
    }

    private Map<String, Long> dashboardPaymentMethodBreakdown() {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        for (Map<String, Object> row : orderRepository.dashboardPaymentMethodBreakdown()) {
            Object paymentMethod = mapValue(row, "paymentMethod");
            if (paymentMethod != null) {
                breakdown.put(String.valueOf(paymentMethod), mapLong(row, "orderCount"));
            }
        }
        return breakdown;
    }

    public List<Order> searchAdminOrders(String status, String search, String quick, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 5000));
        int safePage = Math.max(1, page);
        int offset = (safePage - 1) * safeSize;
        return orderRepository.searchAdminOrders(blankToNull(status), searchLikeTerm(search), blankToNull(quick), offset, safeSize)
                .stream()
                .map(this::enrichReturnInfo)
                .collect(Collectors.toList());
    }

    public int countAdminOrders(String status, String search, String quick) {
        return orderRepository.countAdminOrders(blankToNull(status), searchLikeTerm(search), blankToNull(quick));
    }

    public Map<String, Long> countAdminOrderSummary(String search) {
        Map<String, Object> row = orderRepository.countAdminOrderSummary(searchLikeTerm(search));
        Map<String, Long> summary = new LinkedHashMap<>();
        for (String key : ADMIN_ORDER_SUMMARY_KEYS) {
            summary.put(key, mapLong(row, key));
        }
        return summary;
    }

    private long mapLong(Map<String, Object> row, String key) {
        Object value = mapValue(row, key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private BigDecimal mapBigDecimal(Map<String, Object> row, String key) {
        Object value = mapValue(row, key);
        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        }
        if (value instanceof Number || value instanceof CharSequence) {
            try {
                return new BigDecimal(String.valueOf(value));
            } catch (NumberFormatException e) {
                return BigDecimal.ZERO;
            }
        }
        return BigDecimal.ZERO;
    }

    private Object mapValue(Map<String, Object> row, String key) {
        if (row == null || key == null) {
            return null;
        }
        Object value = row.get(key);
        if (value == null) {
            value = row.get(key.toLowerCase(Locale.ROOT));
        }
        if (value == null) {
            value = row.get(key.toUpperCase(Locale.ROOT));
        }
        return value;
    }

    private String mapDateString(Object value) {
        if (value instanceof LocalDate) {
            return value.toString();
        }
        if (value instanceof java.sql.Date) {
            return ((java.sql.Date) value).toLocalDate().toString();
        }
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return text.length() >= 10 ? text.substring(0, 10) : text;
    }

    private String blankToNull(String value) {
        String normalized = normalizeText(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private String searchLikeTerm(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return null;
        }
        return escapeLikeLiteral(normalized);
    }

    private String escapeLikeLiteral(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '!' || ch == '%' || ch == '_' || ch == '\\') {
                escaped.append('!');
            }
            escaped.append(ch);
        }
        return escaped.toString();
    }

    /**
     * 根据ID获取订单
     */
    public Order getOrderById(Long id) {
        return enrichReturnInfo(orderRepository.findById(id));
    }

    public Order getTrackableOrderForInternalUse(String orderNo, String email) {
        return enrichReturnInfo(findTrackableOrder(orderNo, email));
    }

    public OrderTrackResponse trackOrder(String orderNo, String email) {
        Order order = enrichReturnInfo(findTrackableOrder(orderNo, email));
        if (!isGuestOrder(order)) {
            return new OrderTrackResponse(
                    OrderCustomerResponse.from(buildRestrictedAccountOrderTrackingSummary(order)),
                    Collections.emptyList(),
                    true,
                    "ACCOUNT_LOGIN_REQUIRED");
        }
        return new OrderTrackResponse(
                OrderCustomerResponse.from(order),
                orderItemRepository.findByOrderId(order.getId()).stream()
                        .map(OrderItemCustomerResponse::from)
                        .collect(Collectors.toList()),
                false,
                null);
    }

    private Order findTrackableOrder(String orderNo, String email) {
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
        return order;
    }

    private Order buildRestrictedAccountOrderTrackingSummary(Order order) {
        Order summary = new Order();
        summary.setId(order.getId());
        summary.setOrderNo(order.getOrderNo());
        summary.setStatus(order.getStatus());
        summary.setGuestOrder(false);
        summary.setCreatedAt(order.getCreatedAt());
        summary.setShippedAt(order.getShippedAt());
        summary.setCompletedAt(order.getCompletedAt());
        return summary;
    }

    public boolean orderEmailMatches(Order order, String email) {
        if (order == null || order.getId() == null || order.getOrderNo() == null
                || email == null || email.trim().isEmpty()) {
            return false;
        }
        Order matched = orderRepository.findByOrderNoAndEmail(order.getOrderNo(), email.trim().toLowerCase());
        return matched != null && order.getId().equals(matched.getId());
    }

    public boolean guestOrderAccessMatches(Order order, String email, String orderNo) {
        if (order == null || !orderNoMatches(order, orderNo) || !isGuestOrder(order)) {
            return false;
        }
        return guestOrderEmailMatches(order, email);
    }

    public boolean isGuestOrder(Order order) {
        if (order == null) {
            return false;
        }
        return order.getShippingAddress() != null && order.getShippingAddress().startsWith("[Guest]");
    }

    public boolean guestOrderEmailMatches(Order order, String email) {
        String guestEmail = order == null ? null : firstNonBlank(
                normalizeEmail(order.getContactEmail()),
                extractGuestEmail(order.getShippingAddress()));
        String normalizedEmail = normalizeEmail(email);
        return guestEmail != null && guestEmail.equals(normalizedEmail);
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
        boolean updated = orderRepository.updateStatusIfCurrent(id, order.getStatus(), status) > 0;
        if (updated) {
            notifyOrderStatusChanged(order, status, null);
        }
        return updated;
    }

    @Transactional
    public Payment confirmPayment(Long id, String transactionId) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            throw new IllegalArgumentException("Order not found");
        }
        Payment paidPayment = paymentRepository.findLatestPaidByOrderId(id);
        if (paidPayment != null) {
            if ("PENDING_PAYMENT".equals(order.getStatus())) {
                if (orderRepository.updateStatusIfCurrent(id, "PENDING_PAYMENT", "PENDING_SHIPMENT") > 0) {
                    notifyPaymentConfirmed(order, paidPayment);
                }
            }
            return paidPayment;
        }
        if (!"PENDING_PAYMENT".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending-payment orders can be confirmed as paid");
        }

        LocalDateTime now = LocalDateTime.now();
        String confirmedTransactionId = trimToNull(transactionId);
        if (confirmedTransactionId == null) {
            confirmedTransactionId = newManualTransactionId(order);
        }
        Payment payment = paymentRepository.findPendingByOrderId(id);
        if (payment == null) {
            payment = paymentRepository.findLatestByOrderId(id);
        }

        int updated = orderRepository.updateStatusIfCurrent(id, "PENDING_PAYMENT", "PENDING_SHIPMENT");
        if (updated == 0) {
            throw new IllegalStateException("Order payment confirmation failed");
        }

        if (payment != null && !"PAID".equals(payment.getStatus()) && !"REFUNDED".equals(payment.getStatus())) {
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(resolveManualPaymentChannel(order, payment));
            payment.setStatus("PAID");
            payment.setTransactionId(confirmedTransactionId);
            payment.setProviderReference(confirmedTransactionId);
            payment.setPaymentUrl(null);
            payment.setExpiresAt(null);
            payment.setPaidAt(now);
            payment.setCallbackAt(now);
            payment.setUpdatedAt(now);
            if (paymentRepository.update(payment) == 0) {
                throw new IllegalStateException("Payment confirmation update failed");
            }
        } else {
            payment = new Payment();
            payment.setOrderId(order.getId());
            payment.setOrderNo(order.getOrderNo());
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(resolveManualPaymentChannel(order, null));
            payment.setStatus("PAID");
            payment.setTransactionId(confirmedTransactionId);
            payment.setProviderReference(confirmedTransactionId);
            payment.setPaidAt(now);
            payment.setCallbackAt(now);
            payment.setCreatedAt(now);
            payment.setUpdatedAt(now);
            if (paymentRepository.insert(payment) == 0) {
                throw new IllegalStateException("Payment confirmation insert failed");
            }
        }
        Payment latest = paymentRepository.findById(payment.getId());
        notifyPaymentConfirmed(order, latest != null ? latest : payment);
        return latest != null ? latest : payment;
    }

    @Transactional
    public boolean cancelOrder(Long id) {
        return cancelPendingPaymentOrder(id, true);
    }

    @Transactional
    public boolean cancelOrderForPaymentExpiry(Long id) {
        return cancelPendingPaymentOrder(id, false);
    }

    private boolean cancelPendingPaymentOrder(Long id, boolean closePendingPayments) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (!"PENDING_PAYMENT".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending-payment orders can be cancelled directly. Use refund flow for paid orders.");
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
        if (closePendingPayments) {
            paymentRepository.markPendingCancelledByOrderId(id);
        }
        if ("PENDING_PAYMENT".equals(order.getStatus())) {
            releaseOrderCoupon(order);
        }
        notifyCustomer(
                order,
                "Order cancelled",
                "Order " + safeOrderNo(order) + " has been cancelled."
        );
        return true;
    }

    @Scheduled(fixedDelayString = "${order.expiry-scan-ms:60000}")
    public void cancelExpiredUnpaidOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(runtimeConfig.getLong("order.unpaid-timeout-minutes", 30));
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
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(runtimeConfig.getLong("order.unpaid-timeout-minutes", 30));
        if (order.getCreatedAt() == null || !order.getCreatedAt().isBefore(cutoff)) {
            return;
        }
        if (paymentRepository.countActivePendingByOrderId(order.getId()) > 0) {
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
        String cleanedReason = normalizeOptionalText(reason, "Return reason", runtimeConfig.getInt("order.return-reason-max-chars", 500));
        boolean updated = orderRepository.requestReturnIfCurrent(id, "COMPLETED", cleanedReason) > 0;
        if (updated) {
            notifyCustomer(
                    order,
                    "Return request received",
                    "Return request for order " + safeOrderNo(order) + " has been submitted for review."
            );
        }
        return updated;
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
        boolean updated = orderRepository.approveReturnIfCurrent(id, "RETURN_REQUESTED") > 0;
        if (updated) {
            notifyCustomer(
                    order,
                    "Return approved",
                    "Return request for order " + safeOrderNo(order) + " has been approved. Please send the return shipment and submit the tracking number."
            );
        }
        return updated;
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
        boolean updated = orderRepository.rejectReturnIfCurrent(id, "RETURN_REQUESTED") > 0;
        if (updated) {
            notifyCustomer(
                    order,
                    "Return request closed",
                    "Return request for order " + safeOrderNo(order) + " was not approved. The order is now back to completed status."
            );
        }
        return updated;
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
        String cleanedTrackingNumber = normalizeRequiredText(returnTrackingNumber, "Return tracking number", runtimeConfig.getInt("order.tracking-number-max-chars", 120));
        boolean updated = orderRepository.updateReturnTrackingIfCurrent(id, "RETURN_APPROVED", "RETURN_SHIPPED", cleanedTrackingNumber) > 0;
        if (updated) {
            notifyCustomer(
                    order,
                    "Return shipment submitted",
                    "Return tracking number " + cleanedTrackingNumber + " was saved for order " + safeOrderNo(order) + "."
            );
        }
        return updated;
    }

    @Transactional
    public boolean completeReturn(Long id) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            return false;
        }
        if (RETURN_REFUNDING.equals(order.getStatus())) {
            refundService.refundPaidPayment(order, order.getReturnReason());
            return finalizeCompletedReturnRefund(order);
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
        refundService.refundPaidPayment(order, order.getReturnReason());
        return finalizeCompletedReturnRefund(order);
    }

    private boolean finalizeCompletedReturnRefund(Order order) {
        Long id = order.getId();
        int updated = orderRepository.completeReturnAndRefundIfCurrent(id, RETURN_REFUNDING);
        if (updated == 0) {
            Order latest = orderRepository.findById(id);
            if (latest != null && "RETURNED".equals(latest.getStatus())) {
                releaseOrderCoupon(order);
                return true;
            }
            throw new IllegalStateException("Return refund finalization failed");
        }
        List<OrderItem> items = orderItemRepository.findByOrderId(id);
        for (OrderItem item : items) {
            restoreStock(item);
        }
        releaseOrderCoupon(order);
        notifyCustomer(
                order,
                "Return completed",
                "Return refund for order " + safeOrderNo(order) + " has been completed."
        );
        return true;
    }

    @Transactional
    public Payment refundOrder(Long id, String reason, boolean restock) {
        return refundOrder(id, reason, restock, null);
    }

    @Transactional
    public Payment refundOrder(Long id, String reason, boolean restock, String manualRefundReference) {
        Order order = orderRepository.findById(id);
        if (order == null) {
            throw new IllegalArgumentException("Order not found");
        }
        Set<String> refundableStatuses = Set.of(
                "PENDING_SHIPMENT",
                "SHIPPED",
                "COMPLETED",
                "RETURN_REQUESTED",
                "RETURN_APPROVED",
                "RETURN_SHIPPED"
        );
        if ("REFUNDED".equals(order.getStatus()) || "RETURNED".equals(order.getStatus())) {
            Payment refunded = paymentRepository.findLatestRefundedByOrderId(order.getId());
            if (refunded != null) {
                releaseOrderCoupon(order);
                return refunded;
            }
            throw new IllegalStateException("Order is marked refunded but no refunded payment was found");
        }
        boolean reconciliationRefund = isReconciliationRefund(order);
        if (!refundableStatuses.contains(order.getStatus()) && !reconciliationRefund) {
            throw new IllegalStateException("Order is not refundable in current status: " + order.getStatus());
        }
        String cleanedReason = normalizeOptionalText(reason, "Refund reason", runtimeConfig.getInt("order.return-reason-max-chars", 500));

        int updated = orderRepository.markRefunded(order.getId(), order.getStatus(), cleanedReason);
        if (updated == 0) {
            Order latest = orderRepository.findById(order.getId());
            if (latest != null && ("REFUNDED".equals(latest.getStatus()) || "RETURNED".equals(latest.getStatus()))) {
                releaseOrderCoupon(order);
                Payment refunded = paymentRepository.findLatestRefundedByOrderId(order.getId());
                if (refunded != null) {
                    return refunded;
                }
            }
            throw new IllegalStateException("Order refund finalization failed");
        }
        Payment refundedPayment = refundService.refundPaidPayment(order, cleanedReason, manualRefundReference);
        boolean shouldRestock = restock || "PENDING_SHIPMENT".equals(order.getStatus());
        if (shouldRestock) {
            List<OrderItem> items = orderItemRepository.findByOrderId(id);
            for (OrderItem item : items) {
                restoreStock(item);
            }
        }
        releaseOrderCoupon(order);
        notifyCustomer(
                order,
                "Order refunded",
                "Refund for order " + safeOrderNo(order) + " has been completed."
        );
        return refundedPayment;
    }

    private boolean isReconciliationRefund(Order order) {
        return order != null
                && RECONCILIATION_REFUNDABLE_STATUSES.contains(order.getStatus())
                && paymentRepository.findLatestReconcileRequiredByOrderId(order.getId()) != null;
    }

    private void releaseOrderCoupon(Order order) {
        if (order != null) {
            couponService.releaseUsedCoupon(order.getUserCouponId());
        }
    }

    private void restoreStock(OrderItem item) {
        Optional<Product> productOpt = productRepository.findById(item.getProductId());
        if (!productOpt.isPresent()) {
            return;
        }
        Product product = productOpt.get();
        boolean restoredVariantStock = productVariantService.increaseVariantStock(product, item.getSelectedSpecs(), item.getQuantity());
        if (product.getStock() != null) {
            product.setStock(product.getStock() + item.getQuantity());
        } else if (!restoredVariantStock) {
            product.setStock(item.getQuantity());
        }
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
        String cleanedTrackingNumber = normalizeRequiredText(trackingNumber, "Tracking number", runtimeConfig.getInt("order.tracking-number-max-chars", 120));
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
        boolean updated = orderRepository.updateShipping(id, order.getStatus(), "SHIPPED", cleanedTrackingNumber, carrierCode, carrierName) > 0;
        if (updated) {
            String carrierLabel = trimToNull(carrierName) == null ? "" : " via " + carrierName;
            notifyCustomer(
                    order,
                    "Order shipped",
                    "Order " + safeOrderNo(order) + " has shipped" + carrierLabel + ". Tracking number: " + cleanedTrackingNumber + "."
            );
        }
        return updated;
    }

    private void notifyOrderStatusChanged(Order order, String nextStatus, Payment payment) {
        if ("PENDING_SHIPMENT".equals(nextStatus)) {
            notifyPaymentConfirmed(order, payment);
            return;
        }
        if ("SHIPPED".equals(nextStatus)) {
            notifyCustomer(
                    order,
                    "Order shipped",
                    "Order " + safeOrderNo(order) + " has shipped."
            );
            return;
        }
        if ("COMPLETED".equals(nextStatus)) {
            notifyCustomer(
                    order,
                    "Order completed",
                    "Order " + safeOrderNo(order) + " has been completed. You can request a return from order tracking while the return window is open."
            );
        }
    }

    private void notifyPaymentConfirmed(Order order, Payment payment) {
        String amountText = payment != null && payment.getAmount() != null
                ? " Amount: " + payment.getAmount().stripTrailingZeros().toPlainString() + "."
                : "";
        notifyCustomer(
                order,
                "Payment received",
                "Payment for order " + safeOrderNo(order) + " has been received." + amountText + " We will prepare shipment next."
        );
    }

    private void notifyCustomer(Order order, String title, String message) {
        if (order == null || isBlank(title) || isBlank(message)) {
            return;
        }
        Long userId = order.getUserId();
        String shippingAddress = order.getShippingAddress();
        String contactEmail = order.getContactEmail();
        String orderNo = safeOrderNo(order);
        runAfterCommit(() -> dispatchCustomerNotification(userId, shippingAddress, contactEmail, orderNo, title.trim(), message.trim()));
    }

    private void dispatchCustomerNotification(Long userId, String shippingAddress, String contactEmail, String orderNo, String title, String message) {
        try {
            CustomerContact contact = resolveCustomerContact(userId, shippingAddress, contactEmail);
            if (notificationService != null && userId != null && !contact.guestUser) {
                notificationService.tryCreateNotification(userId, "ORDER", title, message);
            }
            if (orderEmailNotificationService != null && contact.email != null) {
                orderEmailNotificationService.trySendOrderStatusEmail(contact.email, title, message);
            }
        } catch (RuntimeException e) {
            log.warn("Customer notification dispatch failed for order {}", orderNo, e);
        }
    }

    private CustomerContact resolveCustomerContact(Long userId, String shippingAddress, String contactEmail) {
        String email = normalizeEmail(contactEmail);
        boolean guestUser = shippingAddress != null && shippingAddress.startsWith("[Guest]");
        if (userId != null && userRepository != null) {
            try {
                Optional<User> user = userRepository.findById(userId);
                if (user.isPresent()) {
                    email = firstNonBlank(email, normalizeEmail(user.get().getEmail()));
                    guestUser = "GUEST".equalsIgnoreCase(trimToNull(user.get().getStatus()));
                }
            } catch (RuntimeException e) {
                log.warn("Customer lookup failed while resolving order notification contact: userId={}", userId, e);
            }
        }
        if (email == null) {
            email = extractGuestEmail(shippingAddress);
            guestUser = guestUser || email != null;
        }
        return new CustomerContact(email, guestUser);
    }

    private String extractGuestEmail(String shippingAddress) {
        if (shippingAddress == null || !shippingAddress.startsWith("[Guest]")) {
            return null;
        }
        String[] parts = shippingAddress.split(" / ");
        for (String part : parts) {
            String email = normalizeEmail(part);
            if (email != null) {
                return email;
            }
        }
        return null;
    }

    private String accountEmailForUser(Long userId) {
        if (userId == null || userRepository == null) {
            return null;
        }
        try {
            return userRepository.findById(userId)
                    .map(User::getEmail)
                    .map(this::normalizeEmail)
                    .orElse(null);
        } catch (RuntimeException e) {
            log.warn("Customer lookup failed while resolving checkout contact email: userId={}", userId, e);
            return null;
        }
    }

    private String normalizeEmail(String email) {
        String normalized = trimToNull(email);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        return normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") ? normalized : null;
    }

    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
            return;
        }
        action.run();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static class CustomerContact {
        private final String email;
        private final boolean guestUser;

        private CustomerContact(String email, boolean guestUser) {
            this.email = email;
            this.guestUser = guestUser;
        }
    }

    private String safeOrderNo(Order order) {
        if (order == null || trimToNull(order.getOrderNo()) == null) {
            return "";
        }
        return order.getOrderNo().trim();
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
        if ("CANCELLED".equals(nextStatus) && "PENDING_PAYMENT".equals(currentStatus)) {
            return;
        }
        if ("REFUNDED".equals(nextStatus)
                && Set.of("PENDING_SHIPMENT", "SHIPPED", "COMPLETED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_SHIPPED", "RETURNED")
                .contains(currentStatus)) {
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

    private String newManualTransactionId(Order order) {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "MANUAL-" + order.getId() + "-" + date;
    }

    private String resolveManualPaymentChannel(Order order, Payment payment) {
        String existingChannel = payment == null ? null : trimToNull(payment.getChannel());
        if (existingChannel != null) {
            return existingChannel;
        }
        String orderPaymentMethod = trimToNull(order.getPaymentMethod());
        return orderPaymentMethod == null ? "MANUAL" : orderPaymentMethod;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = trimToNull(value);
            if (trimmed != null) {
                return trimmed;
            }
        }
        return null;
    }

    public long count() {
        return orderRepository.countAll();
    }

    public BigDecimal getTotalRevenue() {
        BigDecimal total = orderRepository.sumTotalAmount();
        return total == null ? BigDecimal.ZERO : total;
    }

    public Map<String, Long> getStatusBreakdown() {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        for (Map<String, Object> row : orderRepository.countByStatusGroup()) {
            Object status = mapValue(row, "status");
            if (status != null) {
                breakdown.put(String.valueOf(status), mapLong(row, "count"));
            }
        }
        return breakdown;
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
        order.setGuestOrder(isGuestOrder(order));
        return order;
    }

    private boolean orderNoMatches(Order order, String orderNo) {
        return orderNo != null
                && order != null
                && order.getOrderNo() != null
                && order.getOrderNo().trim().equalsIgnoreCase(orderNo.trim());
    }

    private LocalDateTime calculateReturnDeadline(Order order) {
        long windowDays = runtimeConfig.getLong("order.return-window-days", 7);
        if (order == null || windowDays <= 0) {
            return null;
        }
        LocalDateTime completedAt = resolveCompletedAt(order);
        return completedAt == null ? null : completedAt.plusDays(windowDays);
    }

    private LocalDateTime resolveCompletedAt(Order order) {
        if (order.getCompletedAt() != null) {
            return order.getCompletedAt();
        }
        return order.getUpdatedAt() != null ? order.getUpdatedAt() : order.getCreatedAt();
    }
}
