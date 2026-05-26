package com.example.shop.controller;

import com.example.shop.dto.CouponGrantRequest;
import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.dto.ProductImportResult;
import com.example.shop.dto.ProductUrlImportPreview;
import com.example.shop.dto.ProductUrlImportRequest;
import com.example.shop.dto.SecurityAuditPurgeResponse;
import com.example.shop.dto.SecurityAuditSummaryResponse;
import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.AdminRole;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
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
import com.example.shop.service.ProductQuestionService;
import com.example.shop.service.ProductUrlImportService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.util.CsvUtils;
import com.example.shop.util.ProductStatusUtils;
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
    private final ProductQuestionService productQuestionService;
    private final ProductUrlImportService productUrlImportService;
    private final ReviewService reviewService;
    private final CouponService couponService;
    private final NotificationService notificationService;
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final LogisticsCarrierService logisticsCarrierService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;
    private final PaymentRepository paymentRepository;
    private final RuntimeConfigService runtimeConfig;

    @GetMapping("/products")
    public ResponseEntity<List<Product>> getProducts() {
        return ResponseEntity.ok(productService.findAll());
    }

    // ==================== Dashboard ====================

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        List<Order> orders = orderService.getAllOrders();
        Set<String> revenueStatuses = Set.of(
                "PENDING_SHIPMENT", "SHIPPED", "COMPLETED",
                "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_SHIPPED");

        List<Order> paidOrders = orders.stream()
                .filter(order -> revenueStatuses.contains(order.getStatus()))
                .collect(Collectors.toList());
        BigDecimal paidRevenue = paidOrders.stream()
                .map(order -> amountOf(order.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Order> refundedOrders = orders.stream()
                .filter(order -> "REFUNDED".equals(order.getStatus()) || "RETURNED".equals(order.getStatus()) || order.getRefundedAt() != null)
                .collect(Collectors.toList());
        BigDecimal refundedAmount = refundedOrders.stream()
                .map(order -> amountOf(order.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossPaidRevenue = paidRevenue.add(refundedAmount);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalProducts", productService.countProducts());
        stats.put("totalOrders", orders.size());
        stats.put("totalUsers", userService.count());
        stats.put("totalRevenue", paidRevenue);
        stats.put("grossPaidRevenue", grossPaidRevenue);
        stats.put("refundedOrders", refundedOrders.size());
        stats.put("refundedAmount", refundedAmount);
        stats.put("refundingPayments", paymentRepository.countByStatus("REFUNDING"));
        stats.put("netRevenue", paidRevenue);
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
        stats.put("activeProducts", productService.countActiveProducts());
        stats.put("pendingProducts", productService.countPendingReviewProducts());
        stats.put("lowStockProducts", productService.countLowStockProducts());
        stats.put("averageOrderValue", paidOrders.isEmpty()
                ? BigDecimal.ZERO
                : paidRevenue.divide(BigDecimal.valueOf(paidOrders.size()), 2, java.math.RoundingMode.HALF_UP));
        stats.put("conversionRate", orders.isEmpty()
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(paidOrders.size() * 100L)
                        .divide(BigDecimal.valueOf(orders.size()), 2, java.math.RoundingMode.HALF_UP));
        stats.put("refundRate", grossPaidRevenue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : refundedAmount.multiply(BigDecimal.valueOf(100L))
                        .divide(grossPaidRevenue, 2, java.math.RoundingMode.HALF_UP));
        Map<String, Object> slaRisks = buildOperationsSlaRisks(orders);
        stats.put("operationsSlaRisks", slaRisks);
        stats.put("operationsSlaRiskTotal", slaRisks.values().stream()
                .filter(Number.class::isInstance)
                .map(Number.class::cast)
                .mapToLong(Number::longValue)
                .sum());

        List<Order> recentOrders = orders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .limit(5)
                .collect(Collectors.toList());
        stats.put("recentOrders", recentOrders);
        stats.put("salesTrend", buildSalesTrend(orders, revenueStatuses));
        stats.put("paymentMethodBreakdown", orders.stream()
                .filter(order -> order.getPaymentMethod() != null && !order.getPaymentMethod().isEmpty())
                .collect(Collectors.groupingBy(Order::getPaymentMethod, LinkedHashMap::new, Collectors.counting())));
        stats.put("topProducts", orderItemService.getTopProductsByPaidStatuses(List.copyOf(revenueStatuses), 8));
        stats.put("lowStockList", productService.findLowStockProducts(8));

        return ResponseEntity.ok(stats);
    }

    private Map<String, Object> buildOperationsSlaRisks(List<Order> orders) {
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> risks = new LinkedHashMap<>();
        risks.put("stalePendingPayment", orders.stream()
                .filter(order -> "PENDING_PAYMENT".equals(order.getStatus()))
                .filter(order -> isBefore(order.getCreatedAt(), now.minusMinutes(30)))
                .count());
        risks.put("delayedShipment", orders.stream()
                .filter(order -> "PENDING_SHIPMENT".equals(order.getStatus()))
                .filter(order -> isBefore(firstNonNull(order.getUpdatedAt(), order.getCreatedAt()), now.minusHours(24)))
                .count());
        risks.put("returnAwaitingShipment", orders.stream()
                .filter(order -> "RETURN_APPROVED".equals(order.getStatus()))
                .filter(order -> isBefore(firstNonNull(order.getReturnApprovedAt(), order.getUpdatedAt()), now.minusDays(3)))
                .count());
        risks.put("refundDue", orders.stream()
                .filter(order -> "RETURN_SHIPPED".equals(order.getStatus()))
                .filter(order -> isBefore(firstNonNull(order.getReturnShippedAt(), order.getUpdatedAt()), now.minusHours(24)))
                .count());
        return risks;
    }

    private LocalDateTime firstNonNull(LocalDateTime first, LocalDateTime second) {
        return first != null ? first : second;
    }

    private boolean isBefore(LocalDateTime value, LocalDateTime threshold) {
        return value != null && value.isBefore(threshold);
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

    private BigDecimal amountOf(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalizeStatus(String status) {
        return status == null || status.isBlank() ? "UNKNOWN" : status;
    }

    private String normalizeProductStatus(String status) {
        return ProductStatusUtils.normalizeProductStatus(status);
    }

    // ==================== Coupon Management ====================

    @GetMapping("/coupons")
    public ResponseEntity<List<Coupon>> getCoupons() {
        return ResponseEntity.ok(couponService.findAll());
    }

    @GetMapping("/coupons/summary")
    public ResponseEntity<CouponAdminSummaryResponse> getCouponSummary() {
        return ResponseEntity.ok(couponService.adminSummary());
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@RequestBody CouponUpsertRequest request,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        try {
            Coupon coupon = couponService.save(request, null);
            auditLogService.record("COUPON_CREATE", "SUCCESS", authentication, "COUPON", coupon.getId(), httpRequest,
                    "Coupon created", couponMetadata(coupon));
            return ResponseEntity.ok(coupon);
        } catch (IllegalArgumentException e) {
            auditLogService.record("COUPON_CREATE", "FAILURE", authentication, "COUPON", null, httpRequest,
                    e.getMessage(), couponRequestMetadata(request));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/coupons/{id}")
    public ResponseEntity<?> updateCoupon(@PathVariable Long id,
                                          @RequestBody CouponUpsertRequest request,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        try {
            Coupon coupon = couponService.save(request, id);
            auditLogService.record("COUPON_UPDATE", "SUCCESS", authentication, "COUPON", id, httpRequest,
                    "Coupon updated", couponMetadata(coupon));
            return ResponseEntity.ok(coupon);
        } catch (IllegalArgumentException e) {
            auditLogService.record("COUPON_UPDATE", "FAILURE", authentication, "COUPON", id, httpRequest,
                    e.getMessage(), couponRequestMetadata(request));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/coupons/{id}")
    public ResponseEntity<?> deleteCoupon(@PathVariable Long id,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        try {
            couponService.delete(id);
            auditLogService.record("COUPON_DELETE", "SUCCESS", authentication, "COUPON", id, httpRequest,
                    "Coupon deleted", null);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            auditLogService.record("COUPON_DELETE", "FAILURE", authentication, "COUPON", id, httpRequest,
                    e.getMessage(), null);
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            auditLogService.record("COUPON_DELETE", "FAILURE", authentication, "COUPON", id, httpRequest,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/coupons/{id}/grant")
    public ResponseEntity<?> grantCoupon(@PathVariable Long id,
                                         @RequestBody CouponGrantRequest request,
                                         Authentication authentication,
                                         HttpServletRequest httpRequest) {
        try {
            List<Long> userIds = request == null ? List.of() : request.getUserIds();
            int granted = couponService.grant(id, userIds);
            auditLogService.record("COUPON_GRANT", "SUCCESS", authentication, "COUPON", id, httpRequest,
                    "Coupon granted", "requested=" + userIds.size() + ",granted=" + granted);
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException e) {
            int requested = request == null || request.getUserIds() == null ? 0 : request.getUserIds().size();
            auditLogService.record("COUPON_GRANT", "FAILURE", authentication, "COUPON", id, httpRequest,
                    e.getMessage(), "requested=" + requested);
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

    @GetMapping("/users/summary")
    public ResponseEntity<UserAdminSummaryResponse> getUserSummary(@RequestParam(required = false) String keyword,
                                                                   @RequestParam(required = false) String role,
                                                                   @RequestParam(required = false) String status) {
        return ResponseEntity.ok(userService.adminSummary(keyword, role, status));
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

    @GetMapping("/orders/page")
    public ResponseEntity<Map<String, Object>> getOrdersPage(@RequestParam(required = false) String status,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(required = false) String quick,
                                                             @RequestParam(required = false, defaultValue = "1") int page,
                                                             @RequestParam(required = false, defaultValue = "20") int size) {
        int safeSize = Math.max(1, Math.min(size <= 0 ? 20 : size, Math.max(1, runtimeConfig.getInt("admin.orders.page-max-size", 100))));
        int safePage = Math.max(1, page);
        String safeStatus = normalizeAdminFilter(status, 40);
        String safeSearch = normalizeAdminFilter(search, 120);
        String safeQuick = normalizeAdminFilter(quick, 40);
        int total = orderService.countAdminOrders(safeStatus, safeSearch, safeQuick);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        List<Order> orders = orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, safePage, safeSize);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", orders);
        response.put("total", total);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        response.put("summary", buildAdminOrderSummary(safeStatus, safeSearch));
        return ResponseEntity.ok(response);
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
            return ResponseEntity.badRequest().body(Map.of("error", "status is required"));
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
                response.put("message", "status updated");
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
        String manualRefundReference = body == null || body.get("manualRefundReference") == null ? null : String.valueOf(body.get("manualRefundReference"));
        try {
            Payment payment = orderService.refundOrder(id, reason, restock, manualRefundReference);
            auditLogService.record("REFUND_COMPLETE", "SUCCESS", authentication, "ORDER", id, request,
                    "Order refunded",
                    "paymentId=" + payment.getId() + ",channel=" + payment.getChannel() + ",reference=" + payment.getRefundReference() + ",restock=" + restock);
            return ResponseEntity.ok(Map.of(
                    "message", "Refund completed",
                    "payment", payment
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("REFUND_COMPLETE", "FAILURE", authentication, "ORDER", id, request,
                    e.getMessage(), "restock=" + restock);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/batch-ship")
    public ResponseEntity<?> batchShipOrders(@RequestBody Map<String, Object> body,
                                             Authentication authentication,
                                             HttpServletRequest request) {
        if (body == null) {
            auditLogService.record("ORDER_BATCH_SHIP", "FAILURE", authentication, "ORDER", null, request,
                    "request body is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
        }
        Object idsValue = body.get("orderIds");
        String trackingPrefix = normalizeAdminFilter(String.valueOf(body.getOrDefault("trackingPrefix", "BATCH")), 80);
        if (trackingPrefix == null) {
            trackingPrefix = "BATCH";
        }
        String trackingCarrierCode = body.get("trackingCarrierCode") == null ? null : normalizeAdminFilter(String.valueOf(body.get("trackingCarrierCode")), 40);
        if (!(idsValue instanceof List<?>)) {
            auditLogService.record("ORDER_BATCH_SHIP", "FAILURE", authentication, "ORDER", null, request,
                    "orderIds is required", "trackingPrefix=" + trackingPrefix + ",carrier=" + trackingCarrierCode);
            return ResponseEntity.badRequest().body(Map.of("error", "orderIds is required"));
        }
        List<?> rawIds = (List<?>) idsValue;
        int maxBatchSize = Math.max(1, Math.min(runtimeConfig.getInt("admin.orders.batch-ship-max-size", 100), 500));
        if (rawIds.size() > maxBatchSize) {
            auditLogService.record("ORDER_BATCH_SHIP", "FAILURE", authentication, "ORDER", null, request,
                    "too many orderIds", "requested=" + rawIds.size() + ",max=" + maxBatchSize);
            return ResponseEntity.badRequest().body(Map.of("error", "too many orderIds", "max", maxBatchSize));
        }

        int success = 0;
        int failed = 0;
        StringBuilder failedIds = new StringBuilder();
        for (Object idValue : rawIds) {
            try {
                Long id = parseBatchId(idValue);
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
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "status must be one of " + ProductStatusUtils.PRODUCT_STATUSES));
        }
        String status = normalizeProductStatus(body.get("status"));
        if (status == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "status must be one of " + ProductStatusUtils.PRODUCT_STATUSES));
        }
        return productService.findById(id)
                .map(product -> {
                    product.setStatus(status);
                    productService.save(product);
                    return ResponseEntity.ok(Map.of("message", "status updated", "status", status));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/products/batch-status")
    public ResponseEntity<?> batchUpdateProductStatus(@RequestBody Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "productIds and status are required"));
        }
        Object idsValue = body.get("productIds");
        String status = normalizeProductStatus(body.get("status") == null ? null : String.valueOf(body.get("status")));
        if (!(idsValue instanceof List<?>) || status == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "productIds and status are required"));
        }

        int success = 0;
        int failed = 0;
        for (Object idValue : (List<?>) idsValue) {
            try {
                Long id = parseBatchId(idValue);
                boolean updated = productService.findById(id).map(product -> {
                    product.setStatus(status);
                    productService.save(product);
                    return true;
                }).orElse(false);
                if (updated) {
                    success++;
                } else {
                    failed++;
                }
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

    @PostMapping("/products/import-url")
    public ResponseEntity<ProductUrlImportPreview> importProductFromUrl(@RequestBody ProductUrlImportRequest request) {
        String url = request == null ? null : request.getUrl();
        return ResponseEntity.ok(productUrlImportService.importFromUrl(url));
    }

    // ==================== Order Export ====================

    @GetMapping("/orders/export")
    public ResponseEntity<byte[]> exportOrders(@RequestParam(required = false) String status,
                                               @RequestParam(required = false) String search,
                                               @RequestParam(required = false) String quick,
                                               Authentication authentication,
                                               HttpServletRequest request) {
        String safeStatus = normalizeAdminFilter(status, 40);
        String safeSearch = normalizeAdminFilter(search, 120);
        String safeQuick = normalizeAdminFilter(quick, 40);
        int exportLimit = Math.max(1, Math.min(runtimeConfig.getInt("admin.orders.export-max-rows", 5000), 50000));
        int total = orderService.countAdminOrders(safeStatus, safeSearch, safeQuick);
        List<Order> orders = orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, 1, exportLimit);
        Map<Long, List<OrderItem>> itemsByOrderId = orderItemService.getOrderItemsByOrderIds(orders.stream()
                .map(Order::getId)
                .collect(Collectors.toList()));

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append(CsvUtils.row(Arrays.asList(
                "id", "orderNo", "userId", "totalAmount", "status",
                "shippingAddress", "paymentMethod", "trackingNumber", "returnTrackingNumber",
                "returnReason", "refundedAt", "createdAt", "updatedAt", "items"
        ))).append("\r\n");

        for (Order order : orders) {
            List<OrderItem> items = itemsByOrderId.getOrDefault(order.getId(), List.of());
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
                    order.getTrackingNumber(),
                    order.getReturnTrackingNumber(),
                    order.getReturnReason(),
                    order.getRefundedAt(),
                    order.getCreatedAt(),
                    order.getUpdatedAt(),
                    itemSummary
            ))).append("\r\n");
        }

        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        auditLogService.record("ORDER_EXPORT", "SUCCESS", authentication, "ORDER", null, request,
                "Orders exported", "status=" + safeStatus + ",quick=" + safeQuick + ",search=" + safeSearch + ",count=" + orders.size() + ",total=" + total);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=orders.csv")
                .header("X-Export-Total", String.valueOf(total))
                .header("X-Export-Returned", String.valueOf(orders.size()))
                .header("X-Export-Truncated", String.valueOf(total > orders.size()))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition,X-Export-Total,X-Export-Returned,X-Export-Truncated")
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

    @GetMapping("/audit-logs/summary")
    public ResponseEntity<SecurityAuditSummaryResponse> getAuditLogSummary(@RequestParam(required = false) String startAt,
                                                                           @RequestParam(required = false) String endAt,
                                                                           @RequestParam(required = false, defaultValue = "10") int topLimit) {
        return ResponseEntity.ok(auditLogService.summary(parseDateTime(startAt), parseDateTime(endAt), topLimit));
    }

    @PostMapping("/audit-logs/purge")
    public ResponseEntity<SecurityAuditPurgeResponse> purgeAuditLogs(@RequestParam(required = false, defaultValue = "180") int retentionDays,
                                                                     Authentication authentication,
                                                                     HttpServletRequest request) {
        SecurityAuditPurgeResponse response = auditLogService.purge(retentionDays);
        auditLogService.record("AUDIT_LOG_PURGE", "SUCCESS", authentication, "SECURITY_AUDIT_LOG", null, request,
                "Security audit logs purged",
                "retentionDays=" + response.getRetentionDays()
                        + ",deletedCount=" + response.getDeletedCount()
                        + ",purgedBefore=" + response.getPurgedBefore());
        return ResponseEntity.ok(response);
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
        List<SecurityAuditLog> logs = auditLogService.export(
                action,
                result,
                actorUsername,
                resourceType,
                parseDateTime(startAt),
                parseDateTime(endAt));

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

    private String normalizeAdminFilter(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private String couponMetadata(Coupon coupon) {
        if (coupon == null) {
            return null;
        }
        return "name=" + normalizeAdminFilter(coupon.getName(), 80)
                + ",type=" + coupon.getCouponType()
                + ",scope=" + coupon.getScope()
                + ",status=" + coupon.getStatus()
                + ",totalQuantity=" + coupon.getTotalQuantity()
                + ",claimedQuantity=" + coupon.getClaimedQuantity();
    }

    private String couponRequestMetadata(CouponUpsertRequest request) {
        if (request == null) {
            return null;
        }
        return "name=" + normalizeAdminFilter(request.getName(), 80)
                + ",type=" + normalizeAdminFilter(request.getCouponType(), 40)
                + ",scope=" + normalizeAdminFilter(request.getScope(), 40)
                + ",status=" + normalizeAdminFilter(request.getStatus(), 40)
                + ",totalQuantity=" + request.getTotalQuantity();
    }

    private Map<String, Long> buildAdminOrderSummary(String status, String search) {
        Map<String, Long> summary = new LinkedHashMap<>();
        for (String quick : List.of(
                "NEEDS_ACTION",
                "SLA_OVERDUE",
                "SLA_DUE_SOON",
                "PENDING_SHIPMENT",
                "RETURN_REQUESTED",
                "RETURN_SHIPPED",
                "REFUNDED")) {
            summary.put(quick, (long) orderService.countAdminOrders(status, search, quick));
        }
        return summary;
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

    private Long parseBatchId(Object value) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            throw new IllegalArgumentException("id is required");
        }
        return Long.valueOf(String.valueOf(value).trim());
    }

    // ==================== Review Management ====================

    @GetMapping("/questions")
    public ResponseEntity<List<ProductQuestion>> getAdminQuestions(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int limit) {
        return ResponseEntity.ok(productQuestionService.getAdminQueue(status, limit));
    }

    @GetMapping("/questions/summary")
    public ResponseEntity<ProductQuestionAdminSummaryResponse> getAdminQuestionSummary() {
        return ResponseEntity.ok(productQuestionService.adminSummary());
    }

    @PutMapping("/questions/{id}/answer")
    public ResponseEntity<?> answerAdminQuestion(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(productQuestionService.answer(id, SecurityUtils.requireUser(authentication).getId(), body.get("answer")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

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
