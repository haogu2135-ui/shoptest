package com.example.shop.controller;

import com.example.shop.dto.AdminOrderResponse;
import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.GuestOrderAccessRequest;
import com.example.shop.dto.OrderCustomerResponse;
import com.example.shop.dto.OrderItemCustomerResponse;
import com.example.shop.dto.OrderTrackRequest;
import com.example.shop.dto.OrderTrackResponse;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {
    private static final int HARD_LEGACY_ADMIN_ORDER_LIST_LIMIT = 500;
    private static final int DEFAULT_CUSTOMER_ORDER_PAGE = 0;
    private static final int DEFAULT_CUSTOMER_ORDER_PAGE_SIZE = 20;
    private static final int HARD_CUSTOMER_ORDER_PAGE_SIZE_LIMIT = 100;

    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final SecurityAuditLogService auditLogService;
    private final IpBlacklistService ipBlacklistService;
    @Autowired(required = false)
    private AdminRoleService adminRoleService;
    @Autowired(required = false)
    private RuntimeConfigService runtimeConfig;

    @PostMapping
    public ResponseEntity<?> createOrder(Authentication authentication) {
        SecurityUtils.requireUser(authentication);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Legacy order creation is disabled; use /orders/checkout/me or /orders/checkout/guest");
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@Valid @RequestBody(required = false) CheckoutRequest request,
                                      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                      Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checkout payload is required");
        }
        if (request.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        SecurityUtils.assertSelf(authentication, request.getUserId());
        return ResponseEntity.ok(OrderCustomerResponse.from(orderService.checkout(request, idempotencyKey)));
    }

    @PostMapping("/checkout/me")
    public ResponseEntity<?> checkoutMine(@Valid @RequestBody(required = false) CheckoutRequest request,
                                          @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                          Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checkout payload is required");
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        request.setUserId(userDetails.getId());
        return ResponseEntity.ok(OrderCustomerResponse.from(orderService.checkout(request, idempotencyKey)));
    }

    @PostMapping("/checkout/guest")
    public ResponseEntity<?> guestCheckout(@Valid @RequestBody(required = false) GuestCheckoutRequest request,
                                           @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest checkout payload is required");
        }
        return ResponseEntity.ok(OrderCustomerResponse.from(orderService.guestCheckout(request, idempotencyKey)));
    }

    @GetMapping("/track")
    public ResponseEntity<?> trackOrder() {
        throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED, "Use POST /orders/track");
    }

    @PostMapping("/track")
    public ResponseEntity<?> trackOrder(@Valid @RequestBody(required = false) OrderTrackRequest body,
                                        HttpServletRequest request) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order tracking payload is required");
        }
        try {
            OrderTrackResponse response = orderService.trackOrder(body.getOrderNo(), body.getEmail());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            ipBlacklistService.recordLoginFailure(request, "guest-order-track failed");
            throw e;
        }
    }

    @GetMapping("/me")
    public ResponseEntity<List<OrderCustomerResponse>> getMyOrders(@RequestParam(required = false) Integer page,
                                                                   @RequestParam(required = false) Integer size,
                                                                   Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        return customerOrderPageResponse(userDetails.getId(), safeCustomerOrderPage(page), safeCustomerOrderPageSize(size));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserOrders(@PathVariable Long userId,
                                           @RequestParam(required = false) Integer page,
                                           @RequestParam(required = false) Integer size,
                                           Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        if (!isSelf(userDetails, userId)) {
            if (SecurityUtils.isAdmin(userDetails)) {
                requireOrdersPagePermission(userDetails);
            } else {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
            }
        }
        int safePage = safeCustomerOrderPage(page);
        int safeSize = safeCustomerOrderPageSize(size);
        List<Order> orders = orderService.getOrdersByUserId(userId, safePage, safeSize);
        return ResponseEntity.ok(canReadOrdersAsAdmin(userDetails) ? orders : toCustomerOrders(orders));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id,
                                      Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        Order order = requireVisibleOrder(id, authentication);
        return ResponseEntity.ok(canReadOrdersAsAdmin(userDetails) ? order : OrderCustomerResponse.from(order));
    }

    @PostMapping("/guest/{id}")
    public ResponseEntity<OrderCustomerResponse> getGuestOrder(@PathVariable Long id,
                                                               @Valid @RequestBody(required = false) GuestOrderAccessRequest body,
                                                               HttpServletRequest request) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest order access payload is required");
        }
        return ResponseEntity.ok(OrderCustomerResponse.from(requireGuestVisibleOrder(id, body.getGuestEmail(), body.getOrderNo(), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Boolean> updateOrder(@PathVariable Long id, Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Legacy admin order update is disabled; use /admin/orders/{id}/status");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Boolean> deleteOrder(@PathVariable Long id, Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Legacy admin order delete is disabled");
    }

    @GetMapping
    public ResponseEntity<?> getAllOrders(@RequestParam(required = false) Integer page,
                                          @RequestParam(required = false) Integer size,
                                          Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        if (canReadOrdersAsAdmin(userDetails)) {
            int limit = legacyAdminOrderListLimit();
            int total = orderService.countAdminOrders(null, null, null);
            List<AdminOrderResponse> orderResponses = orderService.searchAdminOrders(null, null, null, 1, limit)
                    .stream()
                    .map(AdminOrderResponse::from)
                    .collect(Collectors.toList());
            return ResponseEntity.ok()
                    .header("X-Admin-List-Limit", String.valueOf(limit))
                    .header("X-Admin-List-Returned", String.valueOf(orderResponses.size()))
                    .header("X-Admin-List-Total", String.valueOf(total))
                    .header("X-Admin-List-Truncated", String.valueOf(total > orderResponses.size()))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                            "X-Admin-List-Limit,X-Admin-List-Returned,X-Admin-List-Total,X-Admin-List-Truncated")
                    .body(orderResponses);
        }
        return customerOrderPageResponse(userDetails.getId(), safeCustomerOrderPage(page), safeCustomerOrderPageSize(size));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<?> getOrderItems(@PathVariable Long id,
                                           Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        requireVisibleOrder(id, authentication);
        List<OrderItem> items = orderItemService.getOrderItemsByOrderId(id);
        return ResponseEntity.ok(canReadOrdersAsAdmin(userDetails) ? items : toCustomerOrderItems(items));
    }

    @PostMapping("/guest/{id}/items")
    public ResponseEntity<List<OrderItemCustomerResponse>> getGuestOrderItems(@PathVariable Long id,
                                                                              @Valid @RequestBody(required = false) GuestOrderAccessRequest body,
                                                                              HttpServletRequest request) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest order access payload is required");
        }
        requireGuestVisibleOrder(id, body.getGuestEmail(), body.getOrderNo(), request);
        return ResponseEntity.ok(toCustomerOrderItems(orderItemService.getOrderItemsByOrderId(id)));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<OrderItem> addOrderItem(@PathVariable Long id, Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Legacy admin order item mutation is disabled");
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        return cancelOrderInternal(id, body, authentication, request, false);
    }

    @PostMapping("/guest/{id}/cancel")
    public ResponseEntity<?> cancelGuestOrder(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, String> body,
                                              HttpServletRequest request) {
        return cancelOrderInternal(id, body, null, request, true);
    }

    private ResponseEntity<?> cancelOrderInternal(Long id,
                                                  Map<String, String> body,
                                                  Authentication authentication,
                                                  HttpServletRequest request,
                                                  boolean allowGuestCredentials) {
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                recordGuestOrderOperationFailure(allowGuestCredentials, request, "guest-order not found");
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            assertCanCancelOrder(order, authentication,
                    guestBodyValue(body, "guestEmail", allowGuestCredentials),
                    guestBodyValue(body, "orderNo", allowGuestCredentials),
                    request);
            if (!orderService.cancelOrder(id)) {
                throw new IllegalStateException("Order cancellation failed");
            }
            auditLogService.record("ORDER_CANCEL", "SUCCESS", authentication, "ORDER", id, request,
                    "Order cancelled", null);
            return ResponseEntity.ok(Map.of("message", "Order cancelled"));
        } catch (IllegalStateException e) {
            auditLogService.record("ORDER_CANCEL", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<?> payOrder(@PathVariable Long id,
                                      @RequestBody(required = false) Map<String, String> body,
                                      Authentication authentication,
                                      HttpServletRequest request) {
        String transactionId = body == null ? null : body.get("transactionId");
        try {
            requireOrdersActionPermission(authentication, AdminRoleService.ORDER_PAYMENT_PERMISSION);
            Payment payment = orderService.confirmPayment(id, transactionId);
            auditLogService.record("PAYMENT_MANUAL_CONFIRM", "SUCCESS", authentication, "ORDER", id, request,
                    "Payment confirmed", legacyPaymentMetadata(payment, transactionId));
            return ResponseEntity.ok(Map.of("message", "Payment confirmed", "payment", PaymentResponse.from(payment)));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_MANUAL_CONFIRM", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), "transactionId=" + transactionId);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_MANUAL_CONFIRM", "FAILURE", authentication, "ORDER", id, request,
                    reasonOf(e), "transactionId=" + transactionId);
            throw e;
        }
    }

    @PostMapping("/{id}/ship")
    public ResponseEntity<?> shipOrder(@PathVariable Long id,
                                       @RequestBody(required = false) Map<String, String> body,
                                       Authentication authentication,
                                       HttpServletRequest request) {
        String trackingNumber = body != null ? body.get("trackingNumber") : null;
        String trackingCarrierCode = body != null ? body.get("trackingCarrierCode") : null;
        try {
            requireOrdersActionPermission(authentication, AdminRoleService.ORDER_FULFILLMENT_PERMISSION);
            if (!orderService.shipOrder(id, trackingNumber, trackingCarrierCode)) {
                throw new IllegalStateException("Order shipment failed");
            }
            auditLogService.record("ORDER_SHIP", "SUCCESS", authentication, "ORDER", id, request,
                    "Order shipped", legacyShipmentMetadata(trackingNumber, trackingCarrierCode));
            return ResponseEntity.ok(Map.of("message", "Order shipped"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("ORDER_SHIP", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), legacyShipmentMetadata(trackingNumber, trackingCarrierCode));
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("ORDER_SHIP", "FAILURE", authentication, "ORDER", id, request,
                    reasonOf(e), legacyShipmentMetadata(trackingNumber, trackingCarrierCode));
            throw e;
        }
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirmReceipt(@PathVariable Long id,
                                            @RequestBody(required = false) Map<String, String> body,
                                            Authentication authentication,
                                            HttpServletRequest request) {
        return confirmReceiptInternal(id, body, authentication, false, request);
    }

    @PostMapping("/guest/{id}/confirm")
    public ResponseEntity<?> confirmGuestReceipt(@PathVariable Long id,
                                                 @RequestBody(required = false) Map<String, String> body,
                                                 HttpServletRequest request) {
        return confirmReceiptInternal(id, body, null, true, request);
    }

    private ResponseEntity<?> confirmReceiptInternal(Long id,
                                                     Map<String, String> body,
                                                     Authentication authentication,
                                                     boolean allowGuestCredentials,
                                                     HttpServletRequest request) {
        Order order = null;
        String previousStatus = null;
        try {
            order = orderService.getOrderById(id);
            if (order == null) {
                recordGuestOrderOperationFailure(allowGuestCredentials, request, "guest-order not found");
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            previousStatus = order.getStatus();
            resolveCustomerUserId(order, authentication,
                    guestBodyValue(body, "guestEmail", allowGuestCredentials),
                    guestBodyValue(body, "orderNo", allowGuestCredentials),
                    "Order confirmation is not available for this order",
                    request,
                    permissionForLegacyOrderStatusAction(order.getStatus(), "COMPLETED"),
                    true);
            if (!orderService.updateOrderStatus(id, "COMPLETED")) {
                throw new IllegalStateException("Order completion failed");
            }
            auditLogService.record("ORDER_CONFIRM_RECEIPT", "SUCCESS", authentication, "ORDER", id, request,
                    "Order receipt confirmed", confirmReceiptMetadata(order, body, allowGuestCredentials, previousStatus));
            return ResponseEntity.ok(Map.of("message", "Order completed"));
        } catch (RuntimeException e) {
            auditLogService.record("ORDER_CONFIRM_RECEIPT", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), confirmReceiptMetadata(order, body, allowGuestCredentials, previousStatus));
            throw e;
        }
    }

    @PostMapping("/{id}/return")
    public ResponseEntity<?> returnOrder(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        return returnOrderInternal(id, body, authentication, request, false);
    }

    @PostMapping("/guest/{id}/return")
    public ResponseEntity<?> returnGuestOrder(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, String> body,
                                              HttpServletRequest request) {
        return returnOrderInternal(id, body, null, request, true);
    }

    private ResponseEntity<?> returnOrderInternal(Long id,
                                                  Map<String, String> body,
                                                  Authentication authentication,
                                                  HttpServletRequest request,
                                                  boolean allowGuestCredentials) {
        String reason = body != null ? body.get("reason") : null;
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                recordGuestOrderOperationFailure(allowGuestCredentials, request, "guest-order not found");
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            Long userId = resolveCustomerUserId(order, authentication,
                    guestBodyValue(body, "guestEmail", allowGuestCredentials),
                    guestBodyValue(body, "orderNo", allowGuestCredentials),
                    "Return request is not available for this order",
                    request,
                    null,
                    false);
            if (!orderService.requestReturn(id, userId, reason)) {
                auditLogService.record("RETURN_REQUEST", "FAILURE", authentication, "ORDER", id, request,
                        "Order not found or return request was not applied", reason == null ? null : "reason=" + reason);
                throw new IllegalStateException("Return request failed");
            }
            auditLogService.record("RETURN_REQUEST", "SUCCESS", authentication, "ORDER", id, request,
                    "Return requested", reason == null ? null : "reason=" + reason);
            return ResponseEntity.ok(Map.of("message", "Return requested"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("RETURN_REQUEST", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), reason == null ? null : "reason=" + reason);
            throw e;
        }
    }

    @PostMapping("/{id}/return-shipment")
    public ResponseEntity<?> submitReturnShipment(@PathVariable Long id,
                                                  @RequestBody(required = false) Map<String, String> body,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        return submitReturnShipmentInternal(id, body, authentication, request, false);
    }

    @PostMapping("/guest/{id}/return-shipment")
    public ResponseEntity<?> submitGuestReturnShipment(@PathVariable Long id,
                                                       @RequestBody(required = false) Map<String, String> body,
                                                       HttpServletRequest request) {
        return submitReturnShipmentInternal(id, body, null, request, true);
    }

    private ResponseEntity<?> submitReturnShipmentInternal(Long id,
                                                           Map<String, String> body,
                                                           Authentication authentication,
                                                           HttpServletRequest request,
                                                           boolean allowGuestCredentials) {
        String returnTrackingNumber = body != null ? body.get("returnTrackingNumber") : null;
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                recordGuestOrderOperationFailure(allowGuestCredentials, request, "guest-order not found");
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            Long userId = resolveCustomerUserId(order, authentication,
                    guestBodyValue(body, "guestEmail", allowGuestCredentials),
                    guestBodyValue(body, "orderNo", allowGuestCredentials),
                    "Return shipment is not available for this order",
                    request,
                    null,
                    false);
            if (!orderService.submitReturnShipment(id, userId, returnTrackingNumber)) {
                auditLogService.record("RETURN_SHIPMENT_SUBMIT", "FAILURE", authentication, "ORDER", id, request,
                        "Order not found or return shipment was not applied", "returnTrackingNumber=" + returnTrackingNumber);
                throw new IllegalStateException("Return shipment submit failed");
            }
            auditLogService.record("RETURN_SHIPMENT_SUBMIT", "SUCCESS", authentication, "ORDER", id, request,
                    "Return shipment submitted", "returnTrackingNumber=" + returnTrackingNumber);
            return ResponseEntity.ok(Map.of("message", "Return shipment submitted"));
        } catch (IllegalArgumentException e) {
            auditLogService.record("RETURN_SHIPMENT_SUBMIT", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), "returnTrackingNumber=" + returnTrackingNumber);
            throw e;
        } catch (IllegalStateException e) {
            auditLogService.record("RETURN_SHIPMENT_SUBMIT", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), "returnTrackingNumber=" + returnTrackingNumber);
            throw e;
        }
    }

    private Order requireVisibleOrder(Long id, Authentication authentication) {
        Order order = orderService.getOrderById(id);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (isSelf(user, order.getUserId())) {
            return order;
        }
        if (SecurityUtils.isAdmin(user)) {
            requireOrdersPagePermission(user);
            return order;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
    }

    private Order requireGuestVisibleOrder(Long id, String guestEmail, String orderNo, HttpServletRequest request) {
        Order order = orderService.getOrderById(id);
        if (order == null) {
            ipBlacklistService.recordLoginFailure(request, "guest-order not found");
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (!guestOrderAccessMatches(order, guestEmail, orderNo)) {
            ipBlacklistService.recordLoginFailure(request, "guest-order credentials failed");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Guest order access is not available for this order");
        }
        return order;
    }

    private void assertCanCancelOrder(Order order, Authentication authentication, String guestEmail, String orderNo, HttpServletRequest request) {
        resolveCustomerUserId(order, authentication, guestEmail, orderNo,
                "Order cancellation is not available for this order", request,
                AdminRoleService.ORDER_STATUS_PERMISSION, true);
    }

    private String guestBodyValue(Map<String, String> body, String key, boolean allowGuestCredentials) {
        return allowGuestCredentials && body != null ? body.get(key) : null;
    }

    private Long resolveCustomerUserId(Order order,
                                       Authentication authentication,
                                       String guestEmail,
                                       String orderNo,
                                       String forbiddenMessage,
                                       HttpServletRequest request,
                                       String adminPermission,
                                       boolean allowLegacyAdminAction) {
        if (guestOrderAccessMatches(order, guestEmail, orderNo)) {
            return null;
        }
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
            if (isSelf(user, order.getUserId())) {
                return order.getUserId();
            }
            if (SecurityUtils.isAdmin(user) && allowLegacyAdminAction && adminPermission != null) {
                requireOrdersActionPermission(user, adminPermission);
                return order.getUserId();
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
        }
        recordGuestOrderOperationFailure(true, request, "guest-order operation credentials failed");
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
    }

    private boolean canReadOrdersAsAdmin(UserDetailsImpl user) {
        return SecurityUtils.isAdmin(user)
                && adminRoleService != null
                && adminRoleService.canAccess(user.getId(), "/admin/orders");
    }

    private int legacyAdminOrderListLimit() {
        int configured = runtimeConfig == null
                ? 100
                : runtimeConfig.getInt("admin.orders.legacy-list-max-rows", 100);
        return Math.max(1, Math.min(configured, HARD_LEGACY_ADMIN_ORDER_LIST_LIMIT));
    }

    private ResponseEntity<List<OrderCustomerResponse>> customerOrderPageResponse(Long userId, int page, int size) {
        int total = orderService.countOrdersByUserId(userId);
        List<OrderCustomerResponse> orders = toCustomerOrders(orderService.getOrdersByUserId(userId, page, size));
        int totalPages = total <= 0 ? 0 : (int) Math.ceil((double) total / size);
        return ResponseEntity.ok()
                .header("X-Order-Page", String.valueOf(page))
                .header("X-Order-Page-Size", String.valueOf(size))
                .header("X-Order-Total", String.valueOf(total))
                .header("X-Order-Total-Pages", String.valueOf(totalPages))
                .header("X-Order-Has-Next", String.valueOf(page + 1 < totalPages))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        "X-Order-Page,X-Order-Page-Size,X-Order-Total,X-Order-Total-Pages,X-Order-Has-Next")
                .body(orders);
    }

    private int safeCustomerOrderPage(Integer page) {
        if (page != null && page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be greater than or equal to 0");
        }
        return page == null ? DEFAULT_CUSTOMER_ORDER_PAGE : page;
    }

    private int safeCustomerOrderPageSize(Integer size) {
        if (size != null && size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be greater than or equal to 1");
        }
        if (size != null && size > HARD_CUSTOMER_ORDER_PAGE_SIZE_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be less than or equal to " + HARD_CUSTOMER_ORDER_PAGE_SIZE_LIMIT);
        }
        return size == null ? DEFAULT_CUSTOMER_ORDER_PAGE_SIZE : size;
    }

    private void requireOrdersPagePermission(UserDetailsImpl user) {
        if (canReadOrdersAsAdmin(user)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No permission for this admin page");
    }

    private void requireOrdersActionPermission(Authentication authentication, String permission) {
        requireOrdersActionPermission(SecurityUtils.requireUser(authentication), permission);
    }

    private void requireOrdersActionPermission(UserDetailsImpl user, String permission) {
        requireOrdersPagePermission(user);
        if (adminRoleService != null && adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No permission for this order action");
    }

    private String permissionForLegacyOrderStatusAction(String currentStatus, String newStatus) {
        String current = currentStatus == null ? "" : currentStatus.trim().toUpperCase();
        String target = newStatus == null ? "" : newStatus.trim().toUpperCase();
        if ("PENDING_SHIPMENT".equals(target)) {
            return "PENDING_PAYMENT".equals(current)
                    ? AdminRoleService.ORDER_PAYMENT_PERMISSION
                    : AdminRoleService.ORDER_FULFILLMENT_PERMISSION;
        }
        if ("SHIPPED".equals(target) || "RETURN_APPROVED".equals(target)
                || ("COMPLETED".equals(target) && "RETURN_REQUESTED".equals(current))) {
            return AdminRoleService.ORDER_FULFILLMENT_PERMISSION;
        }
        if ("RETURNED".equals(target)) {
            return AdminRoleService.ORDER_REFUND_PERMISSION;
        }
        return AdminRoleService.ORDER_STATUS_PERMISSION;
    }

    private String legacyPaymentMetadata(Payment payment, String requestedTransactionId) {
        if (payment == null) {
            return "transactionId=" + requestedTransactionId;
        }
        return "paymentId=" + payment.getId()
                + ",paymentChannel=" + payment.getChannel()
                + ",transactionId=" + payment.getTransactionId()
                + ",requestedTransactionId=" + requestedTransactionId;
    }

    private String legacyShipmentMetadata(String trackingNumber, String trackingCarrierCode) {
        return "trackingNumber=" + maskTrackingAuditValue(trackingNumber, 4)
                + ",trackingCarrierCode=" + maskTrackingAuditValue(trackingCarrierCode, 0);
    }

    private String maskTrackingAuditValue(String value, int visibleSuffixLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        int suffixLength = Math.min(Math.max(visibleSuffixLength, 0), trimmed.length());
        if (suffixLength == 0) {
            return "******";
        }
        return "******" + trimmed.substring(trimmed.length() - suffixLength);
    }

    private String reasonOf(ResponseStatusException e) {
        return e.getReason() != null ? e.getReason() : e.getMessage();
    }

    private boolean isSelf(UserDetailsImpl user, Long userId) {
        return user != null && userId != null && Objects.equals(user.getId(), userId);
    }

    private void recordGuestOrderOperationFailure(boolean allowGuestCredentials, HttpServletRequest request, String reason) {
        if (allowGuestCredentials) {
            ipBlacklistService.recordLoginFailure(request, reason);
        }
    }

    private String confirmReceiptMetadata(Order order,
                                          Map<String, String> body,
                                          boolean allowGuestCredentials,
                                          String previousStatus) {
        String orderNo = order != null ? order.getOrderNo() : guestBodyValue(body, "orderNo", allowGuestCredentials);
        return "orderNo=" + auditMetadataValue(orderNo)
                + ", previousStatus=" + auditMetadataValue(previousStatus)
                + ", nextStatus=COMPLETED"
                + ", access=" + (allowGuestCredentials ? "guest" : "authenticated");
    }

    private String auditMetadataValue(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
        return normalized.length() > 120 ? normalized.substring(0, 120) : normalized;
    }

    private boolean guestOrderAccessMatches(Order order, String email, String orderNo) {
        return orderService.guestOrderAccessMatches(order, email, orderNo);
    }

    private List<OrderCustomerResponse> toCustomerOrders(List<Order> orders) {
        return orders.stream()
                .map(OrderCustomerResponse::from)
                .collect(Collectors.toList());
    }

    private List<OrderItemCustomerResponse> toCustomerOrderItems(List<OrderItem> items) {
        return items.stream()
                .map(OrderItemCustomerResponse::from)
                .collect(Collectors.toList());
    }
}
