package com.example.shop.controller;

import com.example.shop.dto.CouponGrantRequest;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.entity.Review;
import com.example.shop.entity.User;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.CouponService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.ProductService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.UserService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.util.CsvUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin")
@CrossOrigin(originPatterns = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://10.*:*",
        "http://172.*:*",
        "http://192.168.*:*"
})
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserService userService;
    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final ProductService productService;
    private final ReviewService reviewService;
    private final CouponService couponService;
    private final NotificationService notificationService;
    private final LogisticsCarrierService logisticsCarrierService;

    // ==================== Dashboard ====================

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        List<Product> products = productService.findAll();
        List<Order> orders = orderService.getAllOrders();
        List<User> users = userService.findAll();
        List<OrderItem> orderItems = orderItemService.getAllOrderItems();
        Set<String> revenueStatuses = Set.of("PENDING_SHIPMENT", "SHIPPED", "COMPLETED");

        List<Order> paidOrders = orders.stream()
                .filter(order -> revenueStatuses.contains(order.getStatus()))
                .collect(Collectors.toList());
        BigDecimal paidRevenue = paidOrders.stream()
                .map(order -> amountOf(order.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalProducts", products.size());
        stats.put("totalOrders", orders.size());
        stats.put("totalUsers", users.size());
        stats.put("totalRevenue", paidRevenue);
        stats.put("grossOrderAmount", orders.stream()
                .map(order -> amountOf(order.getOriginalAmount() != null ? order.getOriginalAmount() : order.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        stats.put("paidOrders", paidOrders.size());
        stats.put("cancelledOrders", orders.stream()
                .filter(order -> "CANCELLED".equals(order.getStatus()))
                .count());
        stats.put("pendingPaymentOrders", orders.stream()
                .filter(order -> "PENDING_PAYMENT".equals(order.getStatus()))
                .count());
        stats.put("orderStatusBreakdown", orders.stream()
                .collect(Collectors.groupingBy(order -> normalizeStatus(order.getStatus()), LinkedHashMap::new, Collectors.counting())));
        stats.put("pendingShipmentOrders", orders.stream()
                .filter(order -> "PENDING_SHIPMENT".equals(order.getStatus()))
                .count());
        stats.put("shippedOrders", orders.stream()
                .filter(order -> "SHIPPED".equals(order.getStatus()))
                .count());
        stats.put("ordersWithTracking", orders.stream()
                .filter(order -> order.getTrackingNumber() != null && !order.getTrackingNumber().isBlank())
                .count());
        stats.put("ordersWithoutTracking", orders.stream()
                .filter(order -> "SHIPPED".equals(order.getStatus()) && (order.getTrackingNumber() == null || order.getTrackingNumber().isBlank()))
                .count());
        stats.put("completedOrders", orders.stream()
                .filter(order -> "COMPLETED".equals(order.getStatus()))
                .count());
        stats.put("activeProducts", products.stream()
                .filter(product -> "ACTIVE".equals(product.getStatus()))
                .count());
        stats.put("pendingProducts", products.stream()
                .filter(product -> "PENDING_REVIEW".equals(product.getStatus()))
                .count());
        stats.put("lowStockProducts", products.stream()
                .filter(product -> product.getStock() != null && product.getStock() < 10)
                .count());
        stats.put("averageOrderValue", paidOrders.isEmpty()
                ? BigDecimal.ZERO
                : paidRevenue.divide(BigDecimal.valueOf(paidOrders.size()), 2, java.math.RoundingMode.HALF_UP));
        stats.put("conversionRate", orders.isEmpty()
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(paidOrders.size() * 100L)
                        .divide(BigDecimal.valueOf(orders.size()), 2, java.math.RoundingMode.HALF_UP));

        List<Order> recentOrders = orders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .limit(5)
                .collect(Collectors.toList());
        stats.put("recentOrders", recentOrders);
        stats.put("salesTrend", buildSalesTrend(orders, revenueStatuses));
        stats.put("paymentMethodBreakdown", orders.stream()
                .filter(order -> order.getPaymentMethod() != null && !order.getPaymentMethod().isEmpty())
                .collect(Collectors.groupingBy(Order::getPaymentMethod, LinkedHashMap::new, Collectors.counting())));
        stats.put("topProducts", buildTopProducts(orderItems, orders, revenueStatuses));
        stats.put("lowStockList", products.stream()
                .filter(product -> product.getStock() != null && product.getStock() < 10)
                .sorted(Comparator.comparing(product -> product.getStock() == null ? 0 : product.getStock()))
                .limit(8)
                .collect(Collectors.toList()));

        return ResponseEntity.ok(stats);
    }

    private List<Map<String, Object>> buildSalesTrend(List<Order> orders, Set<String> revenueStatuses) {
        LocalDate today = LocalDate.now();
        Map<LocalDate, List<Order>> ordersByDay = orders.stream()
                .filter(order -> order.getCreatedAt() != null)
                .collect(Collectors.groupingBy(order -> order.getCreatedAt().toLocalDate()));
        return java.util.stream.IntStream.rangeClosed(0, 6)
                .mapToObj(offset -> today.minusDays(6L - offset))
                .map(day -> {
                    List<Order> dayOrders = ordersByDay.getOrDefault(day, List.of());
                    BigDecimal revenue = dayOrders.stream()
                            .filter(order -> revenueStatuses.contains(order.getStatus()))
                            .map(order -> amountOf(order.getTotalAmount()))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("date", day.toString());
                    item.put("orders", dayOrders.size());
                    item.put("revenue", revenue);
                    return item;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildTopProducts(List<OrderItem> orderItems, List<Order> orders, Set<String> revenueStatuses) {
        Set<Long> paidOrderIds = orders.stream()
                .filter(order -> revenueStatuses.contains(order.getStatus()))
                .map(Order::getId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, Map<String, Object>> productMap = new HashMap<>();
        for (OrderItem item : orderItems) {
            if (item.getProductId() == null) {
                continue;
            }
            if (!paidOrderIds.contains(item.getOrderId())) {
                continue;
            }
            Map<String, Object> product = productMap.computeIfAbsent(item.getProductId(), id -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("productId", item.getProductId());
                row.put("productName", item.getProductName());
                row.put("imageUrl", item.getImageUrl());
                row.put("quantity", 0);
                row.put("revenue", BigDecimal.ZERO);
                return row;
            });
            Integer quantity = (Integer) product.get("quantity");
            BigDecimal revenue = (BigDecimal) product.get("revenue");
            int itemQuantity = item.getQuantity() == null ? 0 : item.getQuantity();
            BigDecimal itemRevenue = item.getPrice() == null
                    ? BigDecimal.ZERO
                    : item.getPrice().multiply(BigDecimal.valueOf(itemQuantity));
            product.put("quantity", quantity + itemQuantity);
            product.put("revenue", revenue.add(itemRevenue));
        }
        return productMap.values().stream()
                .sorted((left, right) -> ((BigDecimal) right.get("revenue")).compareTo((BigDecimal) left.get("revenue")))
                .limit(8)
                .collect(Collectors.toList());
    }

    private BigDecimal amountOf(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalizeStatus(String status) {
        return status == null || status.isBlank() ? "UNKNOWN" : status;
    }

    // ==================== Coupon Management ====================

    @GetMapping("/coupons")
    public ResponseEntity<List<Coupon>> getCoupons() {
        return ResponseEntity.ok(couponService.findAll());
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@RequestBody CouponUpsertRequest request) {
        try {
            return ResponseEntity.ok(couponService.save(request, null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/coupons/{id}")
    public ResponseEntity<?> updateCoupon(@PathVariable Long id, @RequestBody CouponUpsertRequest request) {
        try {
            return ResponseEntity.ok(couponService.save(request, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/coupons/{id}")
    public ResponseEntity<?> deleteCoupon(@PathVariable Long id) {
        couponService.delete(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/coupons/{id}/grant")
    public ResponseEntity<?> grantCoupon(@PathVariable Long id, @RequestBody CouponGrantRequest request) {
        try {
            int granted = couponService.grant(id, request.getUserIds());
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== Notification Management ====================

    @PostMapping("/notifications/broadcast")
    public ResponseEntity<?> broadcastNotification(@RequestBody Map<String, String> body) {
        try {
            int sent = notificationService.broadcastToCustomers(
                    body.get("type"),
                    body.get("title"),
                    body.get("message"),
                    body.get("contentFormat"));
            return ResponseEntity.ok(Map.of("sent", sent));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== User Management ====================

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.findAll());
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User user) {
        User existing = userService.findById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (user.getRole() != null) {
            existing.setRole(user.getRole());
        }
        if (user.getStatus() != null) {
            existing.setStatus(user.getStatus());
        }
        if (user.getEmail() != null) {
            existing.setEmail(user.getEmail());
        }
        if (user.getPhone() != null) {
            existing.setPhone(user.getPhone());
        }
        if (user.getAddress() != null) {
            existing.setAddress(user.getAddress());
        }
        userService.update(existing);
        return ResponseEntity.ok(existing);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        userService.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ==================== Order Management ====================

    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getAllOrders(@RequestParam(required = false) String status) {
        List<Order> orders = orderService.getAllOrders();
        if (status != null && !status.isEmpty()) {
            orders = orders.stream()
                    .filter(o -> status.equalsIgnoreCase(o.getStatus()))
                    .collect(Collectors.toList());
        }
        return ResponseEntity.ok(orders);
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "状态不能为空"));
        }

        Order order = orderService.getOrderById(id);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            boolean updated;
            if ("CANCELLED".equals(newStatus)) {
                updated = orderService.cancelOrder(id);
            } else if ("RETURN_APPROVED".equals(newStatus)) {
                updated = orderService.approveReturn(id);
            } else if ("COMPLETED".equals(newStatus) && "RETURN_REQUESTED".equals(order.getStatus())) {
                updated = orderService.rejectReturn(id);
            } else if ("RETURNED".equals(newStatus)) {
                updated = orderService.completeReturn(id);
            } else if ("SHIPPED".equals(newStatus)) {
                updated = orderService.shipOrder(id, body.get("trackingNumber"), body.get("trackingCarrierCode"));
            } else {
                updated = orderService.updateOrderStatus(id, newStatus);
            }
            if (updated) {
                return ResponseEntity.ok(Map.of("message", "状态更新成功", "status", newStatus));
            }
            return ResponseEntity.badRequest().body(Map.of("error", "更新失败"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/batch-ship")
    public ResponseEntity<?> batchShipOrders(@RequestBody Map<String, Object> body) {
        Object idsValue = body.get("orderIds");
        String trackingPrefix = String.valueOf(body.getOrDefault("trackingPrefix", "BATCH"));
        String trackingCarrierCode = body.get("trackingCarrierCode") == null ? null : String.valueOf(body.get("trackingCarrierCode"));
        if (!(idsValue instanceof List<?>)) {
            return ResponseEntity.badRequest().body(Map.of("error", "orderIds is required"));
        }

        int success = 0;
        int failed = 0;
        for (Object idValue : (List<?>) idsValue) {
            try {
                Long id = Long.valueOf(String.valueOf(idValue));
                orderService.shipOrder(id, trackingPrefix + "-" + id, trackingCarrierCode);
                success++;
            } catch (Exception e) {
                failed++;
            }
        }
        return ResponseEntity.ok(Map.of("success", success, "failed", failed));
    }

    // ==================== Logistics Carrier Management ====================

    @GetMapping("/logistics-carriers")
    public ResponseEntity<List<LogisticsCarrier>> getLogisticsCarriers(@RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(logisticsCarrierService.findAll(activeOnly));
    }

    @PostMapping("/logistics-carriers")
    public ResponseEntity<?> createLogisticsCarrier(@RequestBody LogisticsCarrier carrier) {
        try {
            carrier.setId(null);
            return ResponseEntity.ok(logisticsCarrierService.save(carrier));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/logistics-carriers/{id}")
    public ResponseEntity<?> updateLogisticsCarrier(@PathVariable Long id, @RequestBody LogisticsCarrier carrier) {
        try {
            if (logisticsCarrierService.findById(id).isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            carrier.setId(id);
            return ResponseEntity.ok(logisticsCarrierService.save(carrier));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/logistics-carriers/{id}")
    public ResponseEntity<?> deleteLogisticsCarrier(@PathVariable Long id) {
        logisticsCarrierService.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/products/{id}/status")
    public ResponseEntity<?> updateProductStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "状态不能为空"));
        }
        return productService.findById(id)
                .map(product -> {
                    product.setStatus(status);
                    productService.save(product);
                    return ResponseEntity.ok(Map.of("message", "状态更新成功", "status", status));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/products/batch-status")
    public ResponseEntity<?> batchUpdateProductStatus(@RequestBody Map<String, Object> body) {
        Object idsValue = body.get("productIds");
        String status = String.valueOf(body.get("status"));
        if (!(idsValue instanceof List<?>) || status == null || status.isEmpty() || "null".equals(status)) {
            return ResponseEntity.badRequest().body(Map.of("error", "productIds and status are required"));
        }

        int success = 0;
        int failed = 0;
        for (Object idValue : (List<?>) idsValue) {
            try {
                Long id = Long.valueOf(String.valueOf(idValue));
                productService.findById(id).ifPresent(product -> {
                    product.setStatus(status);
                    productService.save(product);
                });
                success++;
            } catch (Exception e) {
                failed++;
            }
        }
        return ResponseEntity.ok(Map.of("success", success, "failed", failed));
    }

    // ==================== Product Import ====================

    @PostMapping(value = "/products/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductImportResult> importProducts(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            ProductImportResult result = new ProductImportResult();
            result.addError(0, "CSV file is required");
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(productService.importCsv(file));
    }

    // ==================== Order Export ====================

    @GetMapping("/orders/export")
    public ResponseEntity<byte[]> exportOrders(@RequestParam(required = false) String status) {
        List<Order> orders = orderService.getAllOrders();
        if (status != null && !status.isEmpty()) {
            orders = orders.stream()
                    .filter(o -> status.equalsIgnoreCase(o.getStatus()))
                    .collect(Collectors.toList());
        }

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append(CsvUtils.row(Arrays.asList(
                "id", "orderNo", "userId", "totalAmount", "status",
                "shippingAddress", "paymentMethod", "createdAt", "updatedAt", "items"
        ))).append("\r\n");

        for (Order order : orders) {
            List<OrderItem> items = orderItemService.getOrderItemsByOrderId(order.getId());
            String itemSummary = items.stream()
                    .map(item -> item.getProductName() + " x " + item.getQuantity() + " @ " + item.getPrice())
                    .collect(Collectors.joining("; "));
            csv.append(CsvUtils.row(Arrays.asList(
                    order.getId(),
                    order.getOrderNo(),
                    order.getUserId(),
                    order.getTotalAmount(),
                    order.getStatus(),
                    order.getShippingAddress(),
                    order.getPaymentMethod(),
                    order.getCreatedAt(),
                    order.getUpdatedAt(),
                    itemSummary
            ))).append("\r\n");
        }

        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=orders.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(body);
    }

    // ==================== Review Management ====================

    @GetMapping("/reviews")
    public ResponseEntity<List<Review>> getAllReviews() {
        return ResponseEntity.ok(reviewService.getAllReviews());
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<?> deleteReview(@PathVariable Long id) {
        reviewService.deleteReview(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/reviews/{id}/reply")
    public ResponseEntity<?> replyReview(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(reviewService.replyReview(id, body.get("reply")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/reviews/{id}/status")
    public ResponseEntity<?> updateReviewStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(reviewService.updateReviewStatus(id, body.get("status")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
