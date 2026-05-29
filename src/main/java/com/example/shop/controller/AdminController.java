package com.example.shop.controller;

import com.example.shop.dto.CouponGrantRequest;
import com.example.shop.dto.AdminOrderBatchShipResponse;
import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.dto.ProductImportHistoryEntry;
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
import com.example.shop.entity.PetGalleryPhoto;
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
import com.example.shop.service.PetGalleryService;
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
import java.net.URLDecoder;
import java.net.URLEncoder;
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
    private final PetGalleryService petGalleryService;
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
    public ResponseEntity<?> createCoupon(@RequestBody(required = false) CouponUpsertRequest request,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Coupon payload is required"));
        }
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
                                          @RequestBody(required = false) CouponUpsertRequest request,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Coupon payload is required"));
        }
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
                                         @RequestBody(required = false) CouponGrantRequest request,
                                         Authentication authentication,
                                         HttpServletRequest httpRequest) {
        try {
            List<Long> userIds = request == null || request.getUserIds() == null ? List.of() : request.getUserIds();
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
    public ResponseEntity<?> runPetBirthdayCoupons(Authentication authentication,
                                                  HttpServletRequest httpRequest) {
        LocalDate runDate = LocalDate.now();
        try {
            int granted = petBirthdayCouponService.grantBirthdayCoupons(runDate);
            auditLogService.record("PET_BIRTHDAY_COUPON_RUN", "SUCCESS", authentication, "COUPON", null, httpRequest,
                    "Pet birthday coupons granted", "date=" + runDate + ",granted=" + granted);
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PET_BIRTHDAY_COUPON_RUN", "FAILURE", authentication, "COUPON", null, httpRequest,
                    e.getMessage(), "date=" + runDate);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pet-birthday-coupons/config")
    public ResponseEntity<PetBirthdayCouponConfig> getPetBirthdayCouponConfig() {
        return ResponseEntity.ok(petBirthdayCouponService.getConfig());
    }

    @PutMapping("/pet-birthday-coupons/config")
    public ResponseEntity<?> updatePetBirthdayCouponConfig(@RequestBody(required = false) PetBirthdayCouponConfigRequest request,
                                                           Authentication authentication,
                                                           HttpServletRequest httpRequest) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Pet birthday coupon config payload is required"));
        }
        try {
            PetBirthdayCouponConfig config = petBirthdayCouponService.updateConfig(request);
            auditLogService.record("PET_BIRTHDAY_COUPON_CONFIG_UPDATE", "SUCCESS", authentication, "COUPON_CONFIG", config.getId(), httpRequest,
                    "Pet birthday coupon configuration updated", petBirthdayCouponConfigMetadata(config));
            return ResponseEntity.ok(config);
        } catch (IllegalArgumentException e) {
            auditLogService.record("PET_BIRTHDAY_COUPON_CONFIG_UPDATE", "FAILURE", authentication, "COUPON_CONFIG", null, httpRequest,
                    e.getMessage(), petBirthdayCouponConfigRequestMetadata(request));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== Notification Management ====================

    @PostMapping("/notifications/broadcast")
    public ResponseEntity<?> broadcastNotification(@RequestBody(required = false) Map<String, String> body,
                                                   Authentication authentication,
                                                   HttpServletRequest request) {
        if (body == null) {
            auditLogService.record("NOTIFICATION_BROADCAST", "FAILURE", authentication, "NOTIFICATION", null, request,
                    "Notification payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Notification payload is required"));
        }
        try {
            int sent = notificationService.broadcastToCustomers(
                    body.get("type"),
                    body.get("title"),
                    body.get("message"),
                    body.get("contentFormat"));
            auditLogService.record("NOTIFICATION_BROADCAST", "SUCCESS", authentication, "NOTIFICATION", null, request,
                    "Notification broadcast sent", notificationBroadcastMetadata(body, sent));
            return ResponseEntity.ok(Map.of("sent", sent));
        } catch (IllegalArgumentException e) {
            auditLogService.record("NOTIFICATION_BROADCAST", "FAILURE", authentication, "NOTIFICATION", null, request,
                    e.getMessage(), notificationBroadcastMetadata(body, null));
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
                                              @RequestParam(required = false) String status,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        String safeKeyword = normalizeAdminFilter(keyword, 120);
        String safeRole = normalizeAdminFilter(role, 40);
        String safeStatus = normalizeAdminFilter(status, 40);
        String metadata = "keyword=" + safeKeyword + ",role=" + safeRole + ",status=" + safeStatus;
        try {
            List<User> users = filterUsers(safeKeyword, safeRole, safeStatus);
            StringBuilder csv = new StringBuilder("\uFEFF");
            csv.append(CsvUtils.row(Arrays.asList("id", "username", "email", "phone", "role", "roleCode", "status", "createdAt"))).append("\r\n");
            for (User user : users) {
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
            auditLogService.record("USER_EXPORT", "SUCCESS", authentication, "USER", null, request,
                    "Users exported", metadata + ",count=" + users.size());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-users.csv")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(csv.toString().getBytes(StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            auditLogService.record("USER_EXPORT", "FAILURE", authentication, "USER", null, request,
                    e.getMessage(), metadata);
            throw e;
        }
    }

    @GetMapping("/roles")
    public ResponseEntity<List<AdminRole>> getRoles() {
        return ResponseEntity.ok(adminRoleService.findAll());
    }

    @PostMapping("/roles")
    public ResponseEntity<?> saveRole(@RequestBody(required = false) AdminRole role,
                                      Authentication authentication,
                                      HttpServletRequest request) {
        try {
            SecurityUtils.assertSuperAdmin(authentication);
        } catch (RuntimeException e) {
            auditLogService.record("ADMIN_ROLE_SAVE", "FAILURE", authentication, "ADMIN_ROLE", role == null ? null : role.getCode(), request,
                    e.getMessage(), adminRoleAuditMetadata(role));
            throw e;
        }
        if (role == null) {
            auditLogService.record("ADMIN_ROLE_SAVE", "FAILURE", authentication, "ADMIN_ROLE", null, request,
                    "Role payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Role payload is required"));
        }
        try {
            AdminRole savedRole = adminRoleService.save(role);
            auditLogService.record("ADMIN_ROLE_SAVE", "SUCCESS", authentication, "ADMIN_ROLE", savedRole.getCode(), request,
                    "Admin role saved", adminRoleAuditMetadata(savedRole));
            return ResponseEntity.ok(savedRole);
        } catch (IllegalArgumentException e) {
            auditLogService.record("ADMIN_ROLE_SAVE", "FAILURE", authentication, "ADMIN_ROLE", role.getCode(), request,
                    e.getMessage(), adminRoleAuditMetadata(role));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/users/{id}/role-code")
    public ResponseEntity<?> assignRole(@PathVariable Long id,
                                        @RequestBody(required = false) Map<String, String> body,
                                        Authentication authentication,
                                        HttpServletRequest request) {
        try {
            SecurityUtils.assertSuperAdmin(authentication);
        } catch (RuntimeException e) {
            auditLogService.record("USER_ROLE_ASSIGN", "FAILURE", authentication, "USER", id, request,
                    e.getMessage(), body == null ? null : "roleCode=" + body.get("roleCode"));
            throw e;
        }
        if (body == null) {
            auditLogService.record("USER_ROLE_ASSIGN", "FAILURE", authentication, "USER", id, request,
                    "Role assignment payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Role assignment payload is required"));
        }
        if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
            auditLogService.record("USER_ROLE_ASSIGN", "FAILURE", authentication, "USER", id, request,
                    "Cannot change current operator role", "roleCode=" + body.get("roleCode"));
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot change current operator role"));
        }
        try {
            User before = userService.findById(id);
            adminRoleService.assignRole(id, body.get("roleCode"));
            User updated = userService.findById(id);
            auditLogService.record("USER_ROLE_ASSIGN", "SUCCESS", authentication, "USER", id, request,
                    "User role assigned", userRoleChangeMetadata(before, updated));
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            auditLogService.record("USER_ROLE_ASSIGN", "FAILURE", authentication, "USER", id, request,
                    e.getMessage(), "roleCode=" + body.get("roleCode"));
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
    public ResponseEntity<?> updateUser(@PathVariable Long id,
                                        @RequestBody(required = false) User user,
                                        Authentication authentication,
                                        HttpServletRequest request) {
        if (user == null) {
            auditLogService.record("USER_UPDATE", "FAILURE", authentication, "USER", id, request,
                    "User payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "User payload is required"));
        }
        User existing = userService.findById(id);
        if (existing == null) {
            auditLogService.record("USER_UPDATE", "FAILURE", authentication, "USER", id, request,
                    "User not found", userUpdateRequestMetadata(user));
            return ResponseEntity.notFound().build();
        }
        User before = copyUserForAudit(existing);
        if (user.getRole() != null) {
            try {
                SecurityUtils.assertSuperAdmin(authentication);
            } catch (RuntimeException e) {
                auditLogService.record("USER_ROLE_UPDATE", "FAILURE", authentication, "USER", id, request,
                        e.getMessage(), userUpdateRequestMetadata(user));
                throw e;
            }
            if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
                auditLogService.record("USER_ROLE_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Cannot change current operator role", userUpdateRequestMetadata(user));
                return ResponseEntity.badRequest().body(Map.of("error", "Cannot change current operator role"));
            }
            String role = normalizeRole(user.getRole());
            if (role == null) {
                auditLogService.record("USER_ROLE_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Invalid role", userUpdateRequestMetadata(user));
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
            auditLogService.record("USER_UPDATE", "FAILURE", authentication, "USER", id, request,
                    "User not found after role update", userUpdateRequestMetadata(user));
            return ResponseEntity.notFound().build();
        }
        if (user.getStatus() != null) {
            String normalizedStatus = normalizeUserStatus(user.getStatus());
            if (normalizedStatus == null) {
                auditLogService.record("USER_STATUS_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Invalid status", userUpdateRequestMetadata(user));
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid status"));
            }
            existing.setStatus(normalizedStatus);
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
        User updated = userService.findById(id);
        String action = user.getRole() != null ? "USER_ROLE_UPDATE" : user.getStatus() != null ? "USER_STATUS_UPDATE" : "USER_UPDATE";
        auditLogService.record(action, "SUCCESS", authentication, "USER", id, request,
                userUpdateMessage(action), userChangeMetadata(before, updated == null ? existing : updated));
        return ResponseEntity.ok(existing);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id,
                                        Authentication authentication,
                                        HttpServletRequest request) {
        User existing = userService.findById(id);
        if (existing == null) {
            auditLogService.record("USER_DELETE", "FAILURE", authentication, "USER", id, request,
                    "User not found", null);
            return ResponseEntity.notFound().build();
        }
        if (SecurityUtils.requireUser(authentication).getId().equals(id)) {
            auditLogService.record("USER_DELETE", "FAILURE", authentication, "USER", id, request,
                    "Cannot delete current operator", userAuditMetadata(existing));
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete current operator"));
        }
        if ("ADMIN".equals(existing.getRole()) || "SUPER_ADMIN".equals(existing.getRole())) {
            try {
                SecurityUtils.assertSuperAdmin(authentication);
            } catch (RuntimeException e) {
                auditLogService.record("USER_DELETE", "FAILURE", authentication, "USER", id, request,
                        e.getMessage(), userAuditMetadata(existing));
                throw e;
            }
        }
        userService.deleteById(id);
        auditLogService.record("USER_DELETE", "SUCCESS", authentication, "USER", id, request,
                "User deleted", userAuditMetadata(existing));
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
                                               @RequestBody(required = false) Map<String, String> body,
                                               Authentication authentication,
                                               HttpServletRequest request) {
        if (body == null) {
            auditLogService.record("ORDER_STATUS_UPDATE", "FAILURE", authentication, "ORDER", id, request,
                    "request body is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
        }
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
    public ResponseEntity<?> batchShipOrders(@RequestBody(required = false) Map<String, Object> body,
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

        AdminOrderBatchShipResponse response = new AdminOrderBatchShipResponse();
        response.setRequestedCount(rawIds.size());
        response.setMaxBatchSize(maxBatchSize);
        response.setTrackingPrefix(trackingPrefix);
        response.setTrackingCarrierCode(trackingCarrierCode);
        int success = 0;
        for (Object idValue : rawIds) {
            Long id = null;
            try {
                id = parseBatchId(idValue);
                if (orderService.shipOrder(id, trackingPrefix + "-" + id, trackingCarrierCode)) {
                    success++;
                } else {
                    response.addFailure(id, String.valueOf(idValue), "Order shipment failed");
                }
            } catch (Exception e) {
                response.addFailure(id, String.valueOf(idValue), safeBatchFailureReason(e));
            }
        }
        response.setSuccess(success);
        auditLogService.record("ORDER_BATCH_SHIP", response.getFailed() == 0 ? "SUCCESS" : "FAILURE", authentication, "ORDER", null, request,
                "Batch ship completed",
                batchShipMetadata(response));
        return ResponseEntity.ok(response);
    }

    // ==================== Logistics Carrier Management ====================

    @GetMapping("/logistics-carriers")
    public ResponseEntity<List<LogisticsCarrier>> getLogisticsCarriers(@RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(logisticsCarrierService.findAll(activeOnly));
    }

    @PostMapping("/logistics-carriers")
    public ResponseEntity<?> createLogisticsCarrier(@RequestBody(required = false) LogisticsCarrier carrier,
                                                    Authentication authentication,
                                                    HttpServletRequest request) {
        if (carrier == null) {
            auditLogService.record("LOGISTICS_CARRIER_CREATE", "FAILURE", authentication, "LOGISTICS_CARRIER", null, request,
                    "Logistics carrier payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Logistics carrier payload is required"));
        }
        try {
            carrier.setId(null);
            LogisticsCarrier savedCarrier = logisticsCarrierService.save(carrier);
            auditLogService.record("LOGISTICS_CARRIER_CREATE", "SUCCESS", authentication, "LOGISTICS_CARRIER", savedCarrier.getId(), request,
                    "Logistics carrier created", logisticsCarrierAuditMetadata(savedCarrier));
            return ResponseEntity.ok(savedCarrier);
        } catch (IllegalArgumentException e) {
            auditLogService.record("LOGISTICS_CARRIER_CREATE", "FAILURE", authentication, "LOGISTICS_CARRIER", null, request,
                    e.getMessage(), logisticsCarrierAuditMetadata(carrier));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/logistics-carriers/{id}")
    public ResponseEntity<?> updateLogisticsCarrier(@PathVariable Long id,
                                                    @RequestBody(required = false) LogisticsCarrier carrier,
                                                    Authentication authentication,
                                                    HttpServletRequest request) {
        if (carrier == null) {
            auditLogService.record("LOGISTICS_CARRIER_UPDATE", "FAILURE", authentication, "LOGISTICS_CARRIER", id, request,
                    "Logistics carrier payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Logistics carrier payload is required"));
        }
        try {
            if (logisticsCarrierService.findById(id).isEmpty()) {
                auditLogService.record("LOGISTICS_CARRIER_UPDATE", "FAILURE", authentication, "LOGISTICS_CARRIER", id, request,
                        "Logistics carrier not found", logisticsCarrierAuditMetadata(carrier));
                return ResponseEntity.notFound().build();
            }
            carrier.setId(id);
            LogisticsCarrier savedCarrier = logisticsCarrierService.save(carrier);
            auditLogService.record("LOGISTICS_CARRIER_UPDATE", "SUCCESS", authentication, "LOGISTICS_CARRIER", id, request,
                    "Logistics carrier updated", logisticsCarrierAuditMetadata(savedCarrier));
            return ResponseEntity.ok(savedCarrier);
        } catch (IllegalArgumentException e) {
            auditLogService.record("LOGISTICS_CARRIER_UPDATE", "FAILURE", authentication, "LOGISTICS_CARRIER", id, request,
                    e.getMessage(), logisticsCarrierAuditMetadata(carrier));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/logistics-carriers/{id}")
    public ResponseEntity<?> deleteLogisticsCarrier(@PathVariable Long id,
                                                    Authentication authentication,
                                                    HttpServletRequest request) {
        LogisticsCarrier carrier = logisticsCarrierService.findById(id).orElse(null);
        if (carrier == null) {
            auditLogService.record("LOGISTICS_CARRIER_DELETE", "FAILURE", authentication, "LOGISTICS_CARRIER", id, request,
                    "Logistics carrier not found", null);
            return ResponseEntity.notFound().build();
        }
        logisticsCarrierService.deleteById(id);
        auditLogService.record("LOGISTICS_CARRIER_DELETE", "SUCCESS", authentication, "LOGISTICS_CARRIER", id, request,
                "Logistics carrier deleted", logisticsCarrierAuditMetadata(carrier));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/products/{id}/status")
    public ResponseEntity<?> updateProductStatus(@PathVariable Long id,
                                                 @RequestBody(required = false) Map<String, String> body,
                                                 Authentication authentication,
                                                 HttpServletRequest request) {
        if (body == null) {
            auditLogService.record("PRODUCT_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Product status payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "status must be one of " + ProductStatusUtils.PRODUCT_STATUSES));
        }
        String status = normalizeProductStatus(body.get("status"));
        if (status == null) {
            auditLogService.record("PRODUCT_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Invalid product status", "status=" + body.get("status"));
            return ResponseEntity.badRequest().body(Map.of("error", "status must be one of " + ProductStatusUtils.PRODUCT_STATUSES));
        }
        return productService.findById(id)
                .map(product -> {
                    String previousStatus = product.getStatus();
                    product.setStatus(status);
                    productService.save(product);
                    auditLogService.record("PRODUCT_STATUS_UPDATE", "SUCCESS", authentication, "PRODUCT", id, request,
                            "Product status updated", "from=" + previousStatus + ",to=" + status);
                    return ResponseEntity.ok(Map.of("message", "status updated", "status", status));
                })
                .orElseGet(() -> {
                    auditLogService.record("PRODUCT_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                            "Product not found", "to=" + status);
                    return ResponseEntity.notFound().build();
                });
    }

    @PostMapping("/products/batch-status")
    public ResponseEntity<?> batchUpdateProductStatus(@RequestBody(required = false) Map<String, Object> body,
                                                      Authentication authentication,
                                                      HttpServletRequest request) {
        if (body == null) {
            auditLogService.record("PRODUCT_BATCH_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", null, request,
                    "Product batch status payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "productIds and status are required"));
        }
        Object idsValue = body.get("productIds");
        String status = normalizeProductStatus(body.get("status") == null ? null : String.valueOf(body.get("status")));
        if (!(idsValue instanceof List<?>) || status == null) {
            auditLogService.record("PRODUCT_BATCH_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", null, request,
                    "Invalid product batch status payload", "status=" + body.get("status"));
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
        auditLogService.record("PRODUCT_BATCH_STATUS_UPDATE", failed == 0 ? "SUCCESS" : "FAILURE", authentication, "PRODUCT", null, request,
                "Product batch status updated", "status=" + status + ",success=" + success + ",failed=" + failed);
        return ResponseEntity.ok(Map.of("success", success, "failed", failed));
    }

    // ==================== Product Import ====================

    @PostMapping(value = "/products/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductImportResult> previewImportProducts(@RequestParam(value = "file", required = false) MultipartFile file,
                                                                     Authentication authentication,
                                                                     HttpServletRequest request) {
        if (file == null || file.isEmpty()) {
            ProductImportResult result = new ProductImportResult();
            result.setPreview(true);
            result.setStatus(ProductImportResult.STATUS_PREVIEW_BLOCKED);
            result.addError(0, "CSV file is required");
            auditProductImport("PRODUCT_IMPORT_PREVIEW", result, file, authentication, request);
            return ResponseEntity.badRequest().body(result);
        }
        ProductImportResult result = productService.previewImportCsv(file);
        auditProductImport("PRODUCT_IMPORT_PREVIEW", result, file, authentication, request);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/products/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductImportResult> importProducts(@RequestParam(value = "file", required = false) MultipartFile file,
                                                              Authentication authentication,
                                                              HttpServletRequest request) {
        if (file == null || file.isEmpty()) {
            ProductImportResult result = new ProductImportResult();
            result.setStatus(ProductImportResult.STATUS_REJECTED);
            result.addError(0, "CSV file is required");
            auditProductImport("PRODUCT_IMPORT_APPLY", result, file, authentication, request);
            return ResponseEntity.badRequest().body(result);
        }
        ProductImportResult result = productService.importCsv(file);
        auditProductImport("PRODUCT_IMPORT_APPLY", result, file, authentication, request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/products/import/history")
    public ResponseEntity<List<ProductImportHistoryEntry>> getProductImportHistory(
            @RequestParam(required = false, defaultValue = "6") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        List<ProductImportHistoryEntry> entries = auditLogService.search(
                        null, null, null, "PRODUCT_IMPORT", null, null, safeLimit * 3)
                .stream()
                .filter(log -> "PRODUCT_IMPORT_PREVIEW".equals(log.getAction())
                        || "PRODUCT_IMPORT_APPLY".equals(log.getAction())
                        || "PRODUCT_URL_IMPORT".equals(log.getAction()))
                .limit(safeLimit)
                .map(this::toProductImportHistoryEntry)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entries);
    }

    @PostMapping("/products/import-url")
    public ResponseEntity<ProductUrlImportPreview> importProductFromUrl(@RequestBody(required = false) ProductUrlImportRequest request,
                                                                        Authentication authentication,
                                                                        HttpServletRequest httpRequest) {
        String url = request == null ? null : request.getUrl();
        try {
            ProductUrlImportPreview preview = productUrlImportService.importFromUrl(url);
            auditLogService.record("PRODUCT_URL_IMPORT", "SUCCESS", authentication, "PRODUCT_IMPORT", preview.getSourceHost(), httpRequest,
                    "Product URL import preview generated", productUrlImportMetadata(preview));
            return ResponseEntity.ok(preview);
        } catch (RuntimeException ex) {
            auditLogService.record("PRODUCT_URL_IMPORT", "FAILURE", authentication, "PRODUCT_IMPORT", safeImportResourceId(url), httpRequest,
                    "Product URL import failed", "urlHost=" + encodeMetadataValue(safeImportResourceId(url)));
            throw ex;
        }
    }

    private void auditProductImport(String action,
                                    ProductImportResult result,
                                    MultipartFile file,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        boolean preview = "PRODUCT_IMPORT_PREVIEW".equals(action);
        boolean success = result != null && (preview ? result.isReadyToImport() : result.isApplied());
        String auditResult = success ? "SUCCESS" : "FAILURE";
        String filename = file == null ? null : file.getOriginalFilename();
        auditLogService.record(action, auditResult, authentication, "PRODUCT_IMPORT", safeImportResourceId(filename), request,
                productImportMessage(action, result), productImportMetadata(result, file));
    }

    private String productImportMessage(String action, ProductImportResult result) {
        boolean preview = "PRODUCT_IMPORT_PREVIEW".equals(action);
        if (result == null) {
            return preview ? "Product import preview failed" : "Product import failed";
        }
        if (preview) {
            return result.isReadyToImport()
                    ? "Product import preview passed"
                    : "Product import preview found errors";
        }
        return result.isApplied() ? "Product import completed" : "Product import rejected";
    }

    private String productImportMetadata(ProductImportResult result, MultipartFile file) {
        long size = file == null ? 0 : file.getSize();
        String filename = file == null ? "" : String.valueOf(file.getOriginalFilename());
        int totalRows = result == null ? 0 : result.getTotalRows();
        int created = result == null ? 0 : result.getCreated();
        int updated = result == null ? 0 : result.getUpdated();
        int failed = result == null ? 0 : result.getFailed();
        boolean preview = result != null && result.isPreview();
        boolean ready = result != null && result.isReadyToImport();
        boolean applied = result != null && result.isApplied();
        String status = result == null ? "" : productImportStatusForMetadata(preview, ready, applied);
        String importId = result == null || result.getImportId() == null ? "" : result.getImportId();
        String fileSha256 = result == null || result.getFileSha256() == null ? "" : result.getFileSha256();
        String updateFields = result == null || result.getUpdateFields() == null ? "" : String.join(",", result.getUpdateFields());
        return "importId=" + encodeMetadataValue(importId)
                + ";fileSha256=" + encodeMetadataValue(fileSha256)
                + ";status=" + encodeMetadataValue(status)
                + ";updateFields=" + encodeMetadataValue(updateFields)
                + ";filename=" + encodeMetadataValue(filename)
                + ";sizeBytes=" + size
                + ";preview=" + preview
                + ";readyToImport=" + ready
                + ";applied=" + applied
                + ";totalRows=" + totalRows
                + ";created=" + created
                + ";updated=" + updated
                + ";failed=" + failed;
    }

    private String productUrlImportMetadata(ProductUrlImportPreview preview) {
        if (preview == null) {
            return "";
        }
        return "sourceHost=" + encodeMetadataValue(preview.getSourceHost())
                + ";confidenceScore=" + preview.getConfidenceScore()
                + ";imageCount=" + (preview.getImages() == null ? 0 : preview.getImages().size())
                + ";blockedImageCount=" + (preview.getBlockedImages() == null ? 0 : preview.getBlockedImages().size())
                + ";warningCount=" + (preview.getWarnings() == null ? 0 : preview.getWarnings().size());
    }

    private String productImportStatusForMetadata(boolean preview, boolean ready, boolean applied) {
        if (preview) {
            return ready ? ProductImportResult.STATUS_PREVIEW_READY : ProductImportResult.STATUS_PREVIEW_BLOCKED;
        }
        return applied ? ProductImportResult.STATUS_APPLIED : ProductImportResult.STATUS_REJECTED;
    }

    private ProductImportHistoryEntry toProductImportHistoryEntry(SecurityAuditLog log) {
        Map<String, String> metadata = parseSemicolonMetadata(log.getMetadata());
        ProductImportHistoryEntry entry = new ProductImportHistoryEntry();
        entry.setAuditLogId(log.getId());
        entry.setAction(log.getAction());
        entry.setResult(log.getResult());
        entry.setFilename(metadata.getOrDefault("filename", log.getResourceId()));
        entry.setImportId(metadata.getOrDefault("importId", ""));
        entry.setFileSha256(metadata.getOrDefault("fileSha256", ""));
        String status = metadata.getOrDefault("status", fallbackProductImportStatus(log, metadata));
        entry.setStatus(status);
        entry.setSizeBytes(parseLongMetadata(metadata.get("sizeBytes")));
        entry.setTotalRows(parseIntMetadata(metadata.get("totalRows")));
        entry.setCreated(parseIntMetadata(metadata.get("created")));
        entry.setUpdated(parseIntMetadata(metadata.get("updated")));
        entry.setFailed(parseIntMetadata(metadata.get("failed")));
        entry.setUpdateFields(parseListMetadata(metadata.get("updateFields")));
        boolean urlImport = "PRODUCT_URL_IMPORT".equals(log.getAction());
        entry.setPreview(Boolean.parseBoolean(metadata.getOrDefault("preview", urlImport ? "true" : "false")));
        entry.setReadyToImport(Boolean.parseBoolean(metadata.getOrDefault("readyToImport", urlImport && "SUCCESS".equals(log.getResult()) ? "true" : "false")));
        entry.setApplied(metadata.containsKey("applied")
                ? Boolean.parseBoolean(metadata.get("applied"))
                : !urlImport && ProductImportResult.STATUS_APPLIED.equals(status));
        entry.setSourceHost(metadata.getOrDefault("sourceHost", metadata.getOrDefault("urlHost", "")));
        entry.setConfidenceScore(parseOptionalIntMetadata(metadata.get("confidenceScore")));
        entry.setImageCount(parseIntMetadata(metadata.get("imageCount")));
        entry.setBlockedImageCount(parseIntMetadata(metadata.get("blockedImageCount")));
        entry.setWarningCount(parseIntMetadata(metadata.get("warningCount")));
        entry.setMessage(log.getMessage());
        entry.setCreatedAt(log.getCreatedAt());
        return entry;
    }

    private String fallbackProductImportStatus(SecurityAuditLog log, Map<String, String> metadata) {
        if ("PRODUCT_URL_IMPORT".equals(log.getAction())) {
            return "SUCCESS".equals(log.getResult())
                    ? ProductImportResult.STATUS_PREVIEW_READY
                    : ProductImportResult.STATUS_PREVIEW_BLOCKED;
        }
        boolean preview = Boolean.parseBoolean(metadata.getOrDefault("preview", "PRODUCT_IMPORT_PREVIEW".equals(log.getAction()) ? "true" : "false"));
        boolean ready = Boolean.parseBoolean(metadata.getOrDefault("readyToImport", "false"));
        if (preview) {
            return ready ? ProductImportResult.STATUS_PREVIEW_READY : ProductImportResult.STATUS_PREVIEW_BLOCKED;
        }
        return "SUCCESS".equals(log.getResult()) ? ProductImportResult.STATUS_APPLIED : ProductImportResult.STATUS_REJECTED;
    }

    private Map<String, String> parseSemicolonMetadata(String metadata) {
        Map<String, String> values = new LinkedHashMap<>();
        if (metadata == null || metadata.isBlank()) {
            return values;
        }
        for (String part : metadata.split(";")) {
            int index = part.indexOf('=');
            if (index <= 0) {
                continue;
            }
            values.put(part.substring(0, index), decodeMetadataValue(part.substring(index + 1)));
        }
        return values;
    }

    private String encodeMetadataValue(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String decodeMetadataValue(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (!value.contains("%")) {
            return value;
        }
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return value;
        }
    }

    private int parseIntMetadata(String value) {
        try {
            return value == null || value.isBlank() ? 0 : Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private Integer parseOptionalIntMetadata(String value) {
        try {
            return value == null || value.isBlank() ? null : Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<String> parseListMetadata(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .collect(Collectors.toList());
    }

    private long parseLongMetadata(String value) {
        try {
            return value == null || value.isBlank() ? 0L : Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }

    private String safeImportResourceId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            java.net.URI uri = java.net.URI.create(value.trim());
            return uri.getHost() == null ? value : uri.getHost();
        } catch (Exception ex) {
            return value;
        }
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
        String metadata = "status=" + safeStatus + ",quick=" + safeQuick + ",search=" + safeSearch;
        try {
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
                    "Orders exported", metadata + ",count=" + orders.size() + ",total=" + total);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=orders.csv")
                    .header("X-Export-Total", String.valueOf(total))
                    .header("X-Export-Returned", String.valueOf(orders.size()))
                    .header("X-Export-Truncated", String.valueOf(total > orders.size()))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition,X-Export-Total,X-Export-Returned,X-Export-Truncated")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(body);
        } catch (Exception e) {
            auditLogService.record("ORDER_EXPORT", "FAILURE", authentication, "ORDER", null, request,
                    e.getMessage(), metadata);
            throw e;
        }
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
        try {
            SecurityAuditPurgeResponse response = auditLogService.purge(retentionDays);
            auditLogService.record("AUDIT_LOG_PURGE", "SUCCESS", authentication, "SECURITY_AUDIT_LOG", null, request,
                    "Security audit logs purged",
                    "retentionDays=" + response.getRetentionDays()
                            + ",deletedCount=" + response.getDeletedCount()
                            + ",purgedBefore=" + response.getPurgedBefore());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            auditLogService.record("AUDIT_LOG_PURGE", "FAILURE", authentication, "SECURITY_AUDIT_LOG", null, request,
                    e.getMessage(), "retentionDays=" + retentionDays);
            throw e;
        }
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
        try {
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
        } catch (RuntimeException e) {
            auditLogService.record("AUDIT_LOG_EXPORT", "FAILURE", authentication, "SECURITY_AUDIT_LOG", null, request,
                    e.getMessage(), auditLogExportMetadata(action, result, actorUsername, resourceType, startAt, endAt));
            throw e;
        }
    }

    private String auditLogExportMetadata(String action, String result, String actorUsername, String resourceType, String startAt, String endAt) {
        return "action=" + safeAuditFilter(action)
                + ",result=" + safeAuditFilter(result)
                + ",actor=" + safeAuditFilter(actorUsername)
                + ",resourceType=" + safeAuditFilter(resourceType)
                + ",startAt=" + safeAuditFilter(startAt)
                + ",endAt=" + safeAuditFilter(endAt);
    }

    private String safeAuditFilter(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s+", " ").trim();
        return normalized.length() > 120 ? normalized.substring(0, 120) : normalized;
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

    private String logisticsCarrierAuditMetadata(LogisticsCarrier carrier) {
        if (carrier == null) {
            return null;
        }
        return "name=" + carrier.getName()
                + ",trackingCode=" + carrier.getTrackingCode()
                + ",status=" + carrier.getStatus();
    }

    private String notificationBroadcastMetadata(Map<String, String> body, Integer sent) {
        if (body == null) {
            return sent == null ? null : "sent=" + sent;
        }
        String title = normalizeAdminFilter(body.get("title"), 120);
        String type = normalizeAdminFilter(body.get("type"), 40);
        String format = normalizeAdminFilter(body.get("contentFormat"), 20);
        String message = body.get("message") == null ? "" : body.get("message").trim();
        return "type=" + type
                + ",title=" + title
                + ",format=" + format
                + ",messageLength=" + message.length()
                + (sent == null ? "" : ",sent=" + sent);
    }

    private String adminRoleAuditMetadata(AdminRole role) {
        if (role == null) {
            return null;
        }
        int permissionCount = role.getPermissions() == null ? 0 : role.getPermissions().size();
        return "code=" + normalizeAdminFilter(role.getCode(), 60)
                + ",name=" + normalizeAdminFilter(role.getName(), 100)
                + ",status=" + normalizeAdminFilter(role.getStatus(), 20)
                + ",permissions=" + permissionCount;
    }

    private User copyUserForAudit(User user) {
        if (user == null) {
            return null;
        }
        User copy = new User();
        copy.setId(user.getId());
        copy.setUsername(user.getUsername());
        copy.setEmail(user.getEmail());
        copy.setPhone(user.getPhone());
        copy.setRole(user.getRole());
        copy.setRoleCode(user.getRoleCode());
        copy.setStatus(user.getStatus());
        copy.setAddress(user.getAddress());
        return copy;
    }

    private String userUpdateRequestMetadata(User user) {
        if (user == null) {
            return null;
        }
        return "role=" + normalizeAdminFilter(user.getRole(), 30)
                + ",roleCode=" + normalizeAdminFilter(user.getRoleCode(), 60)
                + ",status=" + normalizeAdminFilter(user.getStatus(), 20)
                + ",emailUpdated=" + (user.getEmail() != null)
                + ",phoneUpdated=" + (user.getPhone() != null)
                + ",addressUpdated=" + (user.getAddress() != null);
    }

    private String userAuditMetadata(User user) {
        if (user == null) {
            return null;
        }
        return "username=" + normalizeAdminFilter(user.getUsername(), 100)
                + ",role=" + normalizeAdminFilter(user.getRole(), 30)
                + ",roleCode=" + normalizeAdminFilter(user.getRoleCode(), 60)
                + ",status=" + normalizeAdminFilter(user.getStatus(), 20);
    }

    private String userRoleChangeMetadata(User before, User after) {
        return "role=" + normalizeAdminFilter(before == null ? null : before.getRole(), 30)
                + "->" + normalizeAdminFilter(after == null ? null : after.getRole(), 30)
                + ",roleCode=" + normalizeAdminFilter(before == null ? null : before.getRoleCode(), 60)
                + "->" + normalizeAdminFilter(after == null ? null : after.getRoleCode(), 60)
                + ",username=" + normalizeAdminFilter(after == null ? null : after.getUsername(), 100);
    }

    private String userChangeMetadata(User before, User after) {
        if (after == null) {
            return userAuditMetadata(before);
        }
        return "username=" + normalizeAdminFilter(after.getUsername(), 100)
                + ",role=" + normalizeAdminFilter(before == null ? null : before.getRole(), 30)
                + "->" + normalizeAdminFilter(after.getRole(), 30)
                + ",roleCode=" + normalizeAdminFilter(before == null ? null : before.getRoleCode(), 60)
                + "->" + normalizeAdminFilter(after.getRoleCode(), 60)
                + ",status=" + normalizeAdminFilter(before == null ? null : before.getStatus(), 20)
                + "->" + normalizeAdminFilter(after.getStatus(), 20)
                + ",emailChanged=" + (before != null && !java.util.Objects.equals(before.getEmail(), after.getEmail()))
                + ",phoneChanged=" + (before != null && !java.util.Objects.equals(before.getPhone(), after.getPhone()))
                + ",addressChanged=" + (before != null && !java.util.Objects.equals(before.getAddress(), after.getAddress()));
    }

    private String userUpdateMessage(String action) {
        if ("USER_ROLE_UPDATE".equals(action)) {
            return "User role updated";
        }
        if ("USER_STATUS_UPDATE".equals(action)) {
            return "User status updated";
        }
        return "User profile updated";
    }

    private String productQuestionAuditMetadata(ProductQuestion question) {
        if (question == null) {
            return null;
        }
        return "productId=" + question.getProductId()
                + ",userId=" + question.getUserId()
                + ",answeredBy=" + question.getAnsweredBy();
    }

    private String reviewAuditMetadata(Review review) {
        if (review == null) {
            return null;
        }
        return "productId=" + review.getProductId()
                + ",userId=" + review.getUserId()
                + ",rating=" + review.getRating()
                + ",status=" + review.getStatus();
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

    private String petBirthdayCouponConfigMetadata(PetBirthdayCouponConfig config) {
        if (config == null) {
            return null;
        }
        return "enabled=" + config.getEnabled()
                + ",namePrefix=" + normalizeAdminFilter(config.getNamePrefix(), 80)
                + ",couponType=" + config.getCouponType()
                + ",thresholdAmount=" + config.getThresholdAmount()
                + ",reductionAmount=" + config.getReductionAmount()
                + ",discountPercent=" + config.getDiscountPercent()
                + ",maxDiscountAmount=" + config.getMaxDiscountAmount()
                + ",validDays=" + config.getValidDays()
                + ",maxBenefitsPerUser=" + config.getMaxBenefitsPerUser()
                + ",totalQuantityPerCoupon=" + config.getTotalQuantityPerCoupon();
    }

    private String petBirthdayCouponConfigRequestMetadata(PetBirthdayCouponConfigRequest request) {
        if (request == null) {
            return null;
        }
        return "enabled=" + request.getEnabled()
                + ",namePrefix=" + normalizeAdminFilter(request.getNamePrefix(), 80)
                + ",couponType=" + normalizeAdminFilter(request.getCouponType(), 40)
                + ",validDays=" + request.getValidDays()
                + ",maxBenefitsPerUser=" + request.getMaxBenefitsPerUser()
                + ",totalQuantityPerCoupon=" + request.getTotalQuantityPerCoupon();
    }

    private Map<String, Long> buildAdminOrderSummary(String status, String search) {
        Map<String, Long> summary = new LinkedHashMap<>();
        for (String quick : List.of(
                "NEEDS_ACTION",
                "SLA_OVERDUE",
                "SLA_DUE_SOON",
                "MISSING_TRACKING",
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

    private String normalizeUserStatus(String status) {
        if (status == null) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        return Set.of("ACTIVE", "BANNED", "GUEST").contains(normalized) ? normalized : null;
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

    private String safeBatchFailureReason(Exception exception) {
        String message = exception == null ? null : exception.getMessage();
        String normalized = normalizeAdminFilter(message, 240);
        return normalized == null ? "Operation failed" : normalized;
    }

    private String batchShipMetadata(AdminOrderBatchShipResponse response) {
        String failedInputs = response.getFailures().stream()
                .limit(25)
                .map(failure -> failure.getOrderId() == null ? failure.getInput() : String.valueOf(failure.getOrderId()))
                .collect(Collectors.joining(","));
        return "requested=" + response.getRequestedCount()
                + ",success=" + response.getSuccess()
                + ",failed=" + response.getFailed()
                + ",failedIds=" + failedInputs
                + ",trackingPrefix=" + response.getTrackingPrefix()
                + ",carrier=" + response.getTrackingCarrierCode();
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
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication,
            HttpServletRequest request) {
        try {
            ProductQuestion question = productQuestionService.answer(id, SecurityUtils.requireUser(authentication).getId(), body == null ? null : body.get("answer"));
            auditLogService.record("PRODUCT_QUESTION_ANSWER", "SUCCESS", authentication, "PRODUCT_QUESTION", id, request,
                    "Product question answered", productQuestionAuditMetadata(question));
            return ResponseEntity.ok(question);
        } catch (IllegalArgumentException e) {
            auditLogService.record("PRODUCT_QUESTION_ANSWER", "FAILURE", authentication, "PRODUCT_QUESTION", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            auditLogService.record("PRODUCT_QUESTION_ANSWER", "FAILURE", authentication, "PRODUCT_QUESTION", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @GetMapping("/reviews")
    public ResponseEntity<List<Review>> getAllReviews() {
        return ResponseEntity.ok(reviewService.getAllReviews());
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<?> deleteReview(@PathVariable Long id,
                                          Authentication authentication,
                                          HttpServletRequest request) {
        try {
            reviewService.deleteReview(id);
            auditLogService.record("REVIEW_DELETE", "SUCCESS", authentication, "REVIEW", id, request,
                    "Review deleted", null);
        } catch (RuntimeException e) {
            auditLogService.record("REVIEW_DELETE", "FAILURE", authentication, "REVIEW", id, request,
                    e.getMessage(), null);
            throw e;
        }
        return ResponseEntity.ok().build();
    }

    @PutMapping("/reviews/{id}/reply")
    public ResponseEntity<?> replyReview(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        try {
            Review review = reviewService.replyReview(id, body == null ? null : body.get("reply"));
            auditLogService.record("REVIEW_REPLY", "SUCCESS", authentication, "REVIEW", id, request,
                    "Review replied", reviewAuditMetadata(review));
            return ResponseEntity.ok(review);
        } catch (IllegalArgumentException e) {
            auditLogService.record("REVIEW_REPLY", "FAILURE", authentication, "REVIEW", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            auditLogService.record("REVIEW_REPLY", "FAILURE", authentication, "REVIEW", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PutMapping("/reviews/{id}/status")
    public ResponseEntity<?> updateReviewStatus(@PathVariable Long id,
                                                @RequestBody(required = false) Map<String, String> body,
                                                Authentication authentication,
                                                HttpServletRequest request) {
        try {
            String status = body == null ? null : body.get("status");
            Review review = reviewService.updateReviewStatus(id, status);
            auditLogService.record("REVIEW_STATUS_UPDATE", "SUCCESS", authentication, "REVIEW", id, request,
                    "Review status updated", reviewAuditMetadata(review));
            return ResponseEntity.ok(review);
        } catch (IllegalArgumentException e) {
            auditLogService.record("REVIEW_STATUS_UPDATE", "FAILURE", authentication, "REVIEW", id, request,
                    e.getMessage(), body == null ? null : "status=" + body.get("status"));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            auditLogService.record("REVIEW_STATUS_UPDATE", "FAILURE", authentication, "REVIEW", id, request,
                    e.getMessage(), body == null ? null : "status=" + body.get("status"));
            throw e;
        }
    }

    @GetMapping("/pet-gallery")
    public ResponseEntity<List<PetGalleryPhoto>> getGalleryPhotos() {
        return ResponseEntity.ok(petGalleryService.findAllForAdmin());
    }

    @DeleteMapping("/pet-gallery/{id}")
    public ResponseEntity<?> deleteGalleryPhoto(@PathVariable Long id,
                                                 Authentication authentication,
                                                 HttpServletRequest httpRequest) {
        try {
            petGalleryService.adminDeletePhoto(id);
            auditLogService.record("PET_GALLERY_PHOTO_DELETE", "SUCCESS", authentication, "PET_GALLERY", id, httpRequest,
                    "Gallery photo deleted by admin", null);
            return ResponseEntity.ok(Map.of("message", "Photo deleted"));
        } catch (Exception e) {
            auditLogService.record("PET_GALLERY_PHOTO_DELETE", "FAILURE", authentication, "PET_GALLERY", id, httpRequest,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PostMapping("/pet-birthday-coupons/reissue")
    public ResponseEntity<?> reissuePetBirthdayCoupons(@RequestBody(required = false) Map<String, Object> body,
                                                        Authentication authentication,
                                                        HttpServletRequest httpRequest) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Pet birthday coupon reissue payload is required"));
        }
        try {
            Long userId = body.get("userId") != null ? Long.valueOf(body.get("userId").toString()) : null;
            String dateStr = body.get("date") != null ? body.get("date").toString() : null;
            LocalDate date = dateStr != null ? LocalDate.parse(dateStr) : LocalDate.now();
            int granted = petBirthdayCouponService.reissueBirthdayCoupons(userId, date);
            auditLogService.record("PET_BIRTHDAY_COUPON_REISSUE", "SUCCESS", authentication, "COUPON", null, httpRequest,
                    "Pet birthday coupons reissued", "userId=" + userId + ",date=" + date + ",granted=" + granted);
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException | DateTimeParseException e) {
            auditLogService.record("PET_BIRTHDAY_COUPON_REISSUE", "FAILURE", authentication, "COUPON", null, httpRequest,
                    e.getMessage(), "payload=invalid");
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
