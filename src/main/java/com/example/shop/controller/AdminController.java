package com.example.shop.controller;

import com.example.shop.dto.CouponGrantRequest;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.AdminRole;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.entity.Product;
import com.example.shop.entity.PetBirthdayCouponConfig;
import com.example.shop.entity.Review;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.entity.User;
import com.example.shop.security.SecurityUtils;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.OrderService;
import com.example.shop.service.CouponService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.ProductService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.util.CsvUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
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
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final LogisticsCarrierService logisticsCarrierService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;

    // ==================== Dashboard ====================

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        List<Product> products = productService.findAll();
        List<Order> orders = orderService.getAllOrders();
        List<User> users = userService.findAll();
        List<OrderItem> orderItems = orderItemService.getAllOrderItems();
        Set<String> revenueStatuses = Set.of(
                "PENDING_SHIPMENT", "SHIPPED", "COMPLETED",
                "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_SHIPPED");

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
        try {
            couponService.delete(id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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

    @PostMapping("/pet-birthday-coupons/run")
    public ResponseEntity<?> runPetBirthdayCoupons() {
        int granted = petBirthdayCouponService.grantBirthdayCoupons(LocalDate.now());
        return ResponseEntity.ok(Map.of("granted", granted));
    }

    @GetMapping("/pet-birthday-coupons/config")
    public ResponseEntity<PetBirthdayCouponConfig> getPetBirthdayCouponConfig() {
        return ResponseEntity.ok(petBirthdayCouponService.getConfig());
    }

    @PutMapping("/pet-birthday-coupons/config")
    public ResponseEntity<?> updatePetBirthdayCouponConfig(@RequestBody PetBirthdayCouponConfigRequest request) {
        try {
            return ResponseEntity.ok(petBirthdayCouponService.updateConfig(request));
        } catch (IllegalArgumentException e) {
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
    public ResponseEntity<List<User>> getAllUsers(@RequestParam(required = false) String keyword,
                                                  @RequestParam(required = false) String role,
                                                  @RequestParam(required = false) String status) {
        return ResponseEntity.ok(filterUsers(keyword, role, status));
    }

    @GetMapping("/users/export")
    public ResponseEntity<byte[]> exportUsers(@RequestParam(required = false) String keyword,
                                              @RequestParam(required = false) String role,
                                              @RequestParam(required = false) String status) {
        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append(CsvUtils.row(Arrays.asList("id", "username", "email", "phone", "role", "roleCode", "status", "createdAt"))).append("\r\n");
        for (User user : filterUsers(keyword, role, status)) {
            csv.append(CsvUtils.row(Arrays.asList(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getPhone(),
                    user.getRole(),
                    user.getRoleCode(),
                    user.getStatus(),
                    user.getCreatedAt()
            ))).append("\r\n");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-users.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/roles")
    public ResponseEntity<List<AdminRole>> getRoles() {
        return ResponseEntity.ok(adminRoleService.findAll());
    }

    @PostMapping("/roles")
    public ResponseEntity<?> saveRole(@RequestBody AdminRole role, Authentication authentication) {
        SecurityUtils.assertSuperAdmin(authentication);
        try {
            return ResponseEntity.ok(adminRoleService.save(role));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{id}/role-code")
    public ResponseEntity<?> assignRole(@PathVariable Long id, @RequestBody Map<String, String> body, Authentication authentication) {
        SecurityUtils.assertSuperAdmin(authentication);
        if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot change current operator role"));
        }
        try {
            adminRoleService.assignRole(id, body.get("roleCode"));
            return ResponseEntity.ok(userService.findById(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me/permissions")
    public ResponseEntity<Map<String, Object>> getMyAdminPermissions(Authentication authentication) {
        User current = userService.findById(SecurityUtils.requireUser(authentication).getId());
        return ResponseEntity.ok(Map.of(
                "role", current.getRole(),
                "roleCode", current.getRoleCode() == null ? "" : current.getRoleCode(),
                "permissions", adminRoleService.getPermissionsForUser(current)
        ));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User user, Authentication authentication) {
        User existing = userService.findById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (user.getRole() != null) {
            SecurityUtils.assertSuperAdmin(authentication);
            if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Cannot change current operator role"));
            }
            String role = normalizeRole(user.getRole());
            if (role == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid role"));
            }
            String roleCode = existing.getRoleCode();
            if ("USER".equals(role)) {
                roleCode = null;
            } else if ("SUPER_ADMIN".equals(role)) {
                roleCode = AdminRoleService.SUPER_ADMIN;
            } else if (roleCode == null || roleCode.trim().isEmpty()) {
                roleCode = AdminRoleService.ADMIN;
            }
            userService.updateRoleAccess(existing.getId(), role, roleCode);
            existing = userService.findById(id);
        }
        if (existing == null) {
            return ResponseEntity.notFound().build();
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
    public ResponseEntity<?> deleteUser(@PathVariable Long id, Authentication authentication) {
        User existing = userService.findById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete current operator"));
        }
        if ("ADMIN".equals(existing.getRole()) || "SUPER_ADMIN".equals(existing.getRole())) {
            SecurityUtils.assertSuperAdmin(authentication);
        }
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
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id,
                                               @RequestBody Map<String, String> body,
                                               Authentication authentication,
                                               HttpServletRequest request) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isEmpty()) {
            auditLogService.record("ORDER_STATUS_UPDATE", "FAILURE", authentication, "ORDER", id, request,
                    "Order status is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "状态不能为空"));
        }

        Order order = orderService.getOrderById(id);
        if (order == null) {
            auditLogService.record("ORDER_STATUS_UPDATE", "FAILURE", authentication, "ORDER", id, request,
                    "Order not found", "to=" + newStatus);
            return ResponseEntity.notFound().build();
        }

        try {
            boolean updated;
            Payment payment = null;
            if ("CANCELLED".equals(newStatus)) {
                updated = orderService.cancelOrder(id);
            } else if ("PENDING_SHIPMENT".equals(newStatus) && "PENDING_PAYMENT".equals(order.getStatus())) {
                payment = orderService.confirmPayment(id, body.get("transactionId"));
                updated = payment != null;
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
                auditLogService.record(auditActionForOrderStatus(order.getStatus(), newStatus), "SUCCESS", authentication, "ORDER", id, request,
                        "Order status updated", "from=" + order.getStatus() + ",to=" + newStatus + ",orderNo=" + order.getOrderNo() + paymentMetadata(payment));
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("message", "状态更新成功");
                response.put("status", newStatus);
                if (payment != null) {
                    response.put("payment", payment);
                }
                return ResponseEntity.ok(response);
            }
            auditLogService.record(auditActionForOrderStatus(order.getStatus(), newStatus), "FAILURE", authentication, "ORDER", id, request,
                    "Order status update returned false", "from=" + order.getStatus() + ",to=" + newStatus + ",orderNo=" + order.getOrderNo());
            return ResponseEntity.badRequest().body(Map.of("error", "Update failed"));
        } catch (IllegalArgumentException e) {
            auditLogService.record(auditActionForOrderStatus(order.getStatus(), newStatus), "FAILURE", authentication, "ORDER", id, request, e.getMessage(), "to=" + newStatus);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            auditLogService.record(auditActionForOrderStatus(order.getStatus(), newStatus), "FAILURE", authentication, "ORDER", id, request, e.getMessage(), "to=" + newStatus);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/{id}/refund")
    public ResponseEntity<?> refundOrder(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, Object> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        String reason = body == null || body.get("reason") == null ? "" : String.valueOf(body.get("reason"));
        boolean restock = body != null && Boolean.parseBoolean(String.valueOf(body.getOrDefault("restock", "false")));
        try {
            Payment payment = orderService.refundOrder(id, reason, restock);
            auditLogService.record("ORDER_REFUND", "SUCCESS", authentication, "ORDER", id, request,
                    "Order refunded",
                    "paymentId=" + payment.getId() + ",channel=" + payment.getChannel() + ",reference=" + payment.getRefundReference() + ",restock=" + restock);
            return ResponseEntity.ok(Map.of(
                    "message", "Refund completed",
                    "payment", payment
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("ORDER_REFUND", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), "restock=" + restock);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/batch-ship")
    public ResponseEntity<?> batchShipOrders(@RequestBody Map<String, Object> body,
                                             Authentication authentication,
                                             HttpServletRequest request) {
        Object idsValue = body.get("orderIds");
        String trackingPrefix = String.valueOf(body.getOrDefault("trackingPrefix", "BATCH"));
        String trackingCarrierCode = body.get("trackingCarrierCode") == null ? null : String.valueOf(body.get("trackingCarrierCode"));
        if (!(idsValue instanceof List<?>)) {
            auditLogService.record("ORDER_BATCH_SHIP", "FAILURE", authentication, "ORDER", null, request,
                    "orderIds is required", "trackingPrefix=" + trackingPrefix + ",carrier=" + trackingCarrierCode);
            return ResponseEntity.badRequest().body(Map.of("error", "orderIds is required"));
        }

        int success = 0;
        int failed = 0;
        StringBuilder failedIds = new StringBuilder();
        for (Object idValue : (List<?>) idsValue) {
            try {
                Long id = Long.valueOf(String.valueOf(idValue));
                orderService.shipOrder(id, trackingPrefix + "-" + id, trackingCarrierCode);
                success++;
            } catch (Exception e) {
                failed++;
                if (failedIds.length() < 500) {
                    if (failedIds.length() > 0) {
                        failedIds.append(",");
                    }
                    failedIds.append(idValue);
                }
            }
        }
        auditLogService.record("ORDER_BATCH_SHIP", failed == 0 ? "SUCCESS" : "FAILURE", authentication, "ORDER", null, request,
                "Batch ship completed",
                "success=" + success + ",failed=" + failed + ",failedIds=" + failedIds + ",trackingPrefix=" + trackingPrefix + ",carrier=" + trackingCarrierCode);
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
    public ResponseEntity<byte[]> exportOrders(@RequestParam(required = false) String status,
                                               Authentication authentication,
                                               HttpServletRequest request) {
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
        auditLogService.record("ORDER_EXPORT", "SUCCESS", authentication, "ORDER", null, request,
                "Orders exported", "status=" + status + ",count=" + orders.size());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=orders.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(body);
    }

    // ==================== Security Audit Logs ====================

    @GetMapping("/audit-logs")
    public ResponseEntity<List<SecurityAuditLog>> getAuditLogs(@RequestParam(required = false) String action,
                                                               @RequestParam(required = false) String result,
                                                               @RequestParam(required = false) String actorUsername,
                                                               @RequestParam(required = false) String resourceType,
                                                               @RequestParam(required = false) String startAt,
                                                               @RequestParam(required = false) String endAt,
                                                               @RequestParam(required = false, defaultValue = "200") int limit) {
        return ResponseEntity.ok(auditLogService.search(
                action,
                result,
                actorUsername,
                resourceType,
                parseDateTime(startAt),
                parseDateTime(endAt),
                limit));
    }

    @GetMapping("/audit-logs/export")
    public ResponseEntity<byte[]> exportAuditLogs(@RequestParam(required = false) String action,
                                                  @RequestParam(required = false) String result,
                                                  @RequestParam(required = false) String actorUsername,
                                                  @RequestParam(required = false) String resourceType,
                                                  @RequestParam(required = false) String startAt,
                                                  @RequestParam(required = false) String endAt,
                                                  Authentication authentication,
                                                  HttpServletRequest request) {
        List<SecurityAuditLog> logs = auditLogService.search(
                action,
                result,
                actorUsername,
                resourceType,
                parseDateTime(startAt),
                parseDateTime(endAt),
                5000);

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append(CsvUtils.row(Arrays.asList(
                "id", "createdAt", "action", "result", "actorUserId", "actorUsername", "actorRole",
                "resourceType", "resourceId", "ipAddress", "userAgent", "message", "metadata"
        ))).append("\r\n");
        for (SecurityAuditLog log : logs) {
            csv.append(CsvUtils.row(Arrays.asList(
                    log.getId(),
                    log.getCreatedAt(),
                    log.getAction(),
                    log.getResult(),
                    log.getActorUserId(),
                    log.getActorUsername(),
                    log.getActorRole(),
                    log.getResourceType(),
                    log.getResourceId(),
                    log.getIpAddress(),
                    log.getUserAgent(),
                    log.getMessage(),
                    log.getMetadata()
            ))).append("\r\n");
        }

        auditLogService.record("AUDIT_LOG_EXPORT", "SUCCESS", authentication, "SECURITY_AUDIT_LOG", null, request,
                "Security audit logs exported", "count=" + logs.size());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=security-audit-logs.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String auditActionForOrderStatus(String currentStatus, String newStatus) {
        if ("PENDING_PAYMENT".equals(currentStatus) && "PENDING_SHIPMENT".equals(newStatus)) {
            return "PAYMENT_MANUAL_CONFIRM";
        }
        if ("RETURNED".equals(newStatus)) {
            return "REFUND_COMPLETE";
        }
        if ("RETURN_APPROVED".equals(newStatus)) {
            return "RETURN_APPROVE";
        }
        if ("COMPLETED".equals(newStatus) && "RETURN_REQUESTED".equals(currentStatus)) {
            return "RETURN_REJECT";
        }
        return "ORDER_STATUS_UPDATE";
    }

    private String paymentMetadata(Payment payment) {
        if (payment == null) {
            return "";
        }
        return ",paymentId=" + payment.getId()
                + ",paymentChannel=" + payment.getChannel()
                + ",transactionId=" + payment.getTransactionId();
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return null;
        }
        String normalized = role.trim().toUpperCase();
        return Set.of("USER", "ADMIN", "SUPER_ADMIN").contains(normalized) ? normalized : null;
    }

    private List<User> filterUsers(String keyword, String role, String status) {
        return userService.search(keyword, role, status);
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
