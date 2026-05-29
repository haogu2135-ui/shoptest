package com.example.shop.controller;

import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.OrderTrackResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final SecurityAuditLogService auditLogService;

    @PostMapping
    public ResponseEntity<Order> createOrder(@Valid @RequestBody(required = false) Order order, Authentication authentication) {
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order payload is required");
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        if (!SecurityUtils.isAdmin(userDetails)) {
            order.setUserId(userDetails.getId());
        } else if (order.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        return ResponseEntity.ok(orderService.createOrder(order));
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@Valid @RequestBody(required = false) CheckoutRequest request, Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checkout payload is required");
        }
        if (request.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        SecurityUtils.assertSelfOrAdmin(authentication, request.getUserId());
        return ResponseEntity.ok(orderService.checkout(request));
    }

    @PostMapping("/checkout/me")
    public ResponseEntity<?> checkoutMine(@Valid @RequestBody(required = false) CheckoutRequest request, Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checkout payload is required");
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        request.setUserId(userDetails.getId());
        return ResponseEntity.ok(orderService.checkout(request));
    }

    @PostMapping("/checkout/guest")
    public ResponseEntity<?> guestCheckout(@Valid @RequestBody(required = false) GuestCheckoutRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest checkout payload is required");
        }
        return ResponseEntity.ok(orderService.guestCheckout(request));
    }

    @GetMapping("/track")
    public ResponseEntity<?> trackOrder(@RequestParam String orderNo, @RequestParam String email) {
        OrderTrackResponse response = orderService.trackOrder(orderNo, email);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<List<Order>> getMyOrders(Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        return ResponseEntity.ok(orderService.getOrdersByUserId(userDetails.getId()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Order>> getUserOrders(@PathVariable Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return ResponseEntity.ok(orderService.getOrdersByUserId(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable Long id,
                                          @RequestParam(required = false) String guestEmail,
                                          @RequestParam(required = false) String orderNo,
                                          Authentication authentication) {
        return ResponseEntity.ok(requireVisibleOrder(id, authentication, guestEmail, orderNo));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Boolean> updateOrder(@PathVariable Long id, @Valid @RequestBody(required = false) Order order, Authentication authentication) {
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order payload is required");
        }
        SecurityUtils.assertAdmin(authentication);
        order.setId(id);
        return ResponseEntity.ok(orderService.updateOrder(order));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Boolean> deleteOrder(@PathVariable Long id, Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        return ResponseEntity.ok(orderService.deleteOrder(id));
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders(Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<OrderItem>> getOrderItems(@PathVariable Long id,
                                                         @RequestParam(required = false) String guestEmail,
                                                         @RequestParam(required = false) String orderNo,
                                                         Authentication authentication) {
        requireVisibleOrder(id, authentication, guestEmail, orderNo);
        return ResponseEntity.ok(orderItemService.getOrderItemsByOrderId(id));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<OrderItem> addOrderItem(@PathVariable Long id, @RequestBody(required = false) OrderItem item, Authentication authentication) {
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order item payload is required");
        }
        SecurityUtils.assertAdmin(authentication);
        item.setOrderId(id);
        return ResponseEntity.ok(orderItemService.addOrderItem(item));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            assertCanCancelOrder(order, authentication, body == null ? null : body.get("guestEmail"), body == null ? null : body.get("orderNo"));
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

    @PutMapping("/{id}/pay")
    public ResponseEntity<?> payOrder(@PathVariable Long id,
                                      @RequestBody(required = false) Map<String, String> body,
                                      Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        String transactionId = body == null ? null : body.get("transactionId");
        Payment payment = orderService.confirmPayment(id, transactionId);
        return ResponseEntity.ok(Map.of("message", "Payment confirmed", "payment", payment));
    }

    @PutMapping("/{id}/ship")
    public ResponseEntity<?> shipOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body, Authentication authentication) {
        SecurityUtils.assertAdmin(authentication);
        String trackingNumber = body != null ? body.get("trackingNumber") : null;
        String trackingCarrierCode = body != null ? body.get("trackingCarrierCode") : null;
        if (!orderService.shipOrder(id, trackingNumber, trackingCarrierCode)) {
            throw new IllegalStateException("Order shipment failed");
        }
        return ResponseEntity.ok(Map.of("message", "Order shipped"));
    }

    @PutMapping("/{id}/confirm")
    public ResponseEntity<?> confirmReceipt(@PathVariable Long id,
                                            @RequestBody(required = false) Map<String, String> body,
                                            Authentication authentication) {
        Order order = orderService.getOrderById(id);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        resolveCustomerUserId(order, authentication, body == null ? null : body.get("guestEmail"), body == null ? null : body.get("orderNo"),
                "Order confirmation is not available for this order");
        if (!orderService.updateOrderStatus(id, "COMPLETED")) {
            throw new IllegalStateException("Order completion failed");
        }
        return ResponseEntity.ok(Map.of("message", "Order completed"));
    }

    @PutMapping("/{id}/return")
    public ResponseEntity<?> returnOrder(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        String reason = body != null ? body.get("reason") : null;
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            Long userId = resolveCustomerUserId(order, authentication, body == null ? null : body.get("guestEmail"), body == null ? null : body.get("orderNo"),
                    "Return request is not available for this order");
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

    @PutMapping("/{id}/return-shipment")
    public ResponseEntity<?> submitReturnShipment(@PathVariable Long id,
                                                  @RequestBody(required = false) Map<String, String> body,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        String returnTrackingNumber = body != null ? body.get("returnTrackingNumber") : null;
        try {
            Order order = orderService.getOrderById(id);
            if (order == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
            Long userId = resolveCustomerUserId(order, authentication, body == null ? null : body.get("guestEmail"), body == null ? null : body.get("orderNo"),
                    "Return shipment is not available for this order");
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
        return requireVisibleOrder(id, authentication, null, null);
    }

    private Order requireVisibleOrder(Long id, Authentication authentication, String guestEmail, String orderNo) {
        Order order = orderService.getOrderById(id);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (customerAccessMatches(order, guestEmail, orderNo)) {
            return order;
        }
        SecurityUtils.assertSelfOrAdmin(authentication, order.getUserId());
        return order;
    }

    private void assertCanCancelOrder(Order order, Authentication authentication, String guestEmail, String orderNo) {
        resolveCustomerUserId(order, authentication, guestEmail, orderNo, "Order cancellation is not available for this order");
    }

    private Long resolveCustomerUserId(Order order, Authentication authentication, String guestEmail, String orderNo, String forbiddenMessage) {
        if (customerAccessMatches(order, guestEmail, orderNo)) {
            return null;
        }
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            SecurityUtils.assertSelfOrAdmin(authentication, order.getUserId());
            return order.getUserId();
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
    }

    private boolean customerAccessMatches(Order order, String email, String orderNo) {
        return orderNoMatches(order, orderNo) && customerEmailMatches(order, email);
    }

    private boolean orderNoMatches(Order order, String orderNo) {
        return orderNo != null
                && order.getOrderNo() != null
                && order.getOrderNo().trim().equalsIgnoreCase(orderNo.trim());
    }

    private boolean customerEmailMatches(Order order, String email) {
        return orderService.orderEmailMatches(order, email) || orderService.guestOrderEmailMatches(order, email);
    }
}
