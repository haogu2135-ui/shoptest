package com.example.shop.controller;

import com.example.shop.dto.CheckoutRequest;
import com.example.shop.dto.GuestCheckoutRequest;
import com.example.shop.dto.OrderTrackResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final OrderItemService orderItemService;

    @PostMapping
    public ResponseEntity<Order> createOrder(@Valid @RequestBody Order order) {
        return ResponseEntity.ok(orderService.createOrder(order));
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@Valid @RequestBody CheckoutRequest request, Authentication authentication) {
        try {
            if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
                UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
                request.setUserId(userDetails.getId());
            }
            return ResponseEntity.ok(orderService.checkout(request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/checkout/guest")
    public ResponseEntity<?> guestCheckout(@Valid @RequestBody GuestCheckoutRequest request) {
        try {
            return ResponseEntity.ok(orderService.guestCheckout(request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/track")
    public ResponseEntity<?> trackOrder(@RequestParam String orderNo, @RequestParam String email) {
        try {
            OrderTrackResponse response = orderService.trackOrder(orderNo, email);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<List<Order>> getMyOrders(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.status(401).build();
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return ResponseEntity.ok(orderService.getOrdersByUserId(userDetails.getId()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Order>> getUserOrders(@PathVariable Long userId) {
        return ResponseEntity.ok(orderService.getOrdersByUserId(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable Long id) {
        Order order = orderService.getOrderById(id);
        return order != null ? ResponseEntity.ok(order) : ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Boolean> updateOrder(@PathVariable Long id, @Valid @RequestBody Order order) {
        order.setId(id);
        return ResponseEntity.ok(orderService.updateOrder(order));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Boolean> deleteOrder(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.deleteOrder(id));
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<OrderItem>> getOrderItems(@PathVariable Long id) {
        return ResponseEntity.ok(orderItemService.getOrderItemsByOrderId(id));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<OrderItem> addOrderItem(@PathVariable Long id, @RequestBody OrderItem item) {
        item.setOrderId(id);
        return ResponseEntity.ok(orderItemService.addOrderItem(item));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id) {
        try {
            orderService.cancelOrder(id);
            return ResponseEntity.ok(Map.of("message", "Order cancelled"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/pay")
    public ResponseEntity<?> payOrder(@PathVariable Long id) {
        try {
            orderService.updateOrderStatus(id, "PENDING_SHIPMENT");
            return ResponseEntity.ok(Map.of("message", "Payment confirmed"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/ship")
    public ResponseEntity<?> shipOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        try {
            String trackingNumber = body != null ? body.get("trackingNumber") : null;
            String trackingCarrierCode = body != null ? body.get("trackingCarrierCode") : null;
            orderService.shipOrder(id, trackingNumber, trackingCarrierCode);
            return ResponseEntity.ok(Map.of("message", "Order shipped"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/confirm")
    public ResponseEntity<?> confirmReceipt(@PathVariable Long id) {
        try {
            orderService.updateOrderStatus(id, "COMPLETED");
            return ResponseEntity.ok(Map.of("message", "Order completed"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/return")
    public ResponseEntity<?> returnOrder(@PathVariable Long id) {
        try {
            orderService.requestReturn(id);
            return ResponseEntity.ok(Map.of("message", "Return requested"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/return-shipment")
    public ResponseEntity<?> submitReturnShipment(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            orderService.submitReturnShipment(id, body != null ? body.get("returnTrackingNumber") : null);
            return ResponseEntity.ok(Map.of("message", "Return shipment submitted"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
