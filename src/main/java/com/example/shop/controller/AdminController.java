package com.example.shop.controller;

import com.example.shop.dto.CouponGrantRequest;
import com.example.shop.dto.AdminOrderBatchShipResponse;
import com.example.shop.dto.AdminOrderResponse;
import com.example.shop.dto.AdminReviewResponse;
import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.dto.ProductAdminPageResponse;
import com.example.shop.dto.ProductImportHistoryEntry;
import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.dto.ProductImportResult;
import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductUrlImportPreview;
import com.example.shop.dto.ProductUrlImportRequest;
import com.example.shop.dto.SecurityAuditPurgeResponse;
import com.example.shop.dto.SecurityAuditSummaryResponse;
import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.AdminRole;
import com.example.shop.entity.Brand;
import com.example.shop.entity.Category;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Payment;
import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.PetBirthdayCouponConfig;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.entity.User;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.BrandService;
import com.example.shop.service.CategoryService;
import com.example.shop.service.OrderService;
import com.example.shop.service.CouponService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.PetGalleryService;
import com.example.shop.service.PaymentService;
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
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private static final int DEFAULT_ADMIN_PRODUCT_PAGE = 0;
    private static final int DEFAULT_ADMIN_PRODUCT_PAGE_SIZE = 50;
    private static final String DEFAULT_ADMIN_PRODUCT_SORT = "updatedAt,desc";
    private static final int HARD_ADMIN_LIST_LIMIT = 5000;
    private static final int HARD_ADMIN_EXPORT_LIMIT = 50000;
    private static final int HARD_ADMIN_BATCH_LIMIT = 1000;
    private static final int HARD_ADMIN_PAGE_SIZE_LIMIT = 500;

    private final UserService userService;
    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final BrandService brandService;
    private final CategoryService categoryService;
    private final ProductService productService;
    private final ProductQuestionService productQuestionService;
    private final ProductUrlImportService productUrlImportService;
    private final ReviewService reviewService;
    private final CouponService couponService;
    private final NotificationService notificationService;
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final PetGalleryService petGalleryService;
    private final PaymentService paymentService;
    private final LogisticsCarrierService logisticsCarrierService;
    private final SecurityAuditLogService auditLogService;
    private final AdminRoleService adminRoleService;
    private final PaymentRepository paymentRepository;
    private final RuntimeConfigService runtimeConfig;

    @GetMapping("/products")
    public ResponseEntity<ProductAdminPageResponse> getProducts(@RequestParam(required = false) String keyword,
                                                                @RequestParam(required = false, name = "q") String q,
                                                                @RequestParam(required = false) Long categoryId,
                                                                @RequestParam(required = false) Boolean discount,
                                                                @RequestParam(required = false) Boolean featured,
                                                                @RequestParam(required = false) BigDecimal minPrice,
                                                                @RequestParam(required = false, name = "price_min") BigDecimal priceMin,
                                                                @RequestParam(required = false) BigDecimal maxPrice,
                                                                @RequestParam(required = false, name = "price_max") BigDecimal priceMax,
                                                                @RequestParam(required = false) String status,
                                                                @RequestParam(required = false) Integer page,
                                                                @RequestParam(required = false) Integer size,
                                                                @RequestParam(required = false) String sort) {
        ProductListQuery query = new ProductListQuery();
        query.setKeyword(resolveProductKeyword(keyword, q));
        query.setCategoryId(categoryId);
        query.setDiscount(discount);
        query.setFeatured(featured);
        query.setMinPrice(minPrice == null ? priceMin : minPrice);
        query.setMaxPrice(maxPrice == null ? priceMax : maxPrice);
        query.setStatus(status);
        query.setPage(page == null ? DEFAULT_ADMIN_PRODUCT_PAGE : page);
        query.setSize(size == null ? DEFAULT_ADMIN_PRODUCT_PAGE_SIZE : size);
        query.setSort(sort == null || sort.isBlank() ? DEFAULT_ADMIN_PRODUCT_SORT : sort);
        Page<Product> result = productService.findAdminProductPage(query);
        return ResponseEntity.ok(ProductAdminPageResponse.of(
                result.getContent(),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize()));
    }

    @PostMapping("/products")
    public ResponseEntity<?> createProduct(@RequestBody(required = false) Product product,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_WRITE_PERMISSION,
                "PRODUCT_CREATE", "PRODUCT", null, request, productAuditMetadata(product),
                "Missing admin action permission");
        if (product == null) {
            auditLogService.record("PRODUCT_CREATE", "FAILURE", authentication, "PRODUCT", null, request,
                    "Product payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Product payload is required"));
        }
        try {
            product.setId(null);
            Product savedProduct = productService.save(product);
            auditLogService.record("PRODUCT_CREATE", "SUCCESS", authentication, "PRODUCT", savedProduct.getId(), request,
                    "Product created", productAuditMetadata(savedProduct));
            return ResponseEntity.ok(savedProduct);
        } catch (IllegalArgumentException e) {
            auditLogService.record("PRODUCT_CREATE", "FAILURE", authentication, "PRODUCT", null, request,
                    e.getMessage(), productAuditMetadata(product));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id,
                                           @RequestBody(required = false) Product product,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_WRITE_PERMISSION,
                "PRODUCT_UPDATE", "PRODUCT", id, request, productAuditMetadata(product),
                "Missing admin action permission");
        if (product == null) {
            auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Product payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Product payload is required"));
        }
        Product existingProduct = productService.findById(id).orElse(null);
        if (existingProduct == null) {
            auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Product not found", productAuditMetadata(product));
            return ResponseEntity.notFound().build();
        }
        try {
            mergeProduct(existingProduct, product);
            Product savedProduct = productService.save(existingProduct);
            auditLogService.record("PRODUCT_UPDATE", "SUCCESS", authentication, "PRODUCT", id, request,
                    "Product updated", productAuditMetadata(savedProduct));
            return ResponseEntity.ok(savedProduct);
        } catch (IllegalArgumentException e) {
            auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    e.getMessage(), productAuditMetadata(product));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Long id,
                                           Authentication authentication,
                                           HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_DELETE_PERMISSION,
                "PRODUCT_DELETE", "PRODUCT", id, request, null,
                "Missing admin action permission");
        Product product = productService.findById(id).orElse(null);
        if (product == null) {
            auditLogService.record("PRODUCT_DELETE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Product not found", null);
            return ResponseEntity.notFound().build();
        }
        productService.deleteById(id);
        auditLogService.record("PRODUCT_DELETE", "SUCCESS", authentication, "PRODUCT", id, request,
                "Product deleted", productAuditMetadata(product));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/brands")
    public ResponseEntity<List<Brand>> getBrands(@RequestParam(required = false, defaultValue = "false") boolean activeOnly,
                                                 @RequestParam(required = false) Integer limit) {
        int safeLimit = resolveAdminListLimit("admin.brands.list-max-rows", limit, 500);
        return limitedAdminListResponse(brandService.findAll(activeOnly, safeLimit + 1), safeLimit);
    }

    @PostMapping("/brands")
    public ResponseEntity<?> createBrand(@RequestBody(required = false) Brand brand,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_WRITE_PERMISSION,
                "BRAND_CREATE", "BRAND", null, request, brandAuditMetadata(brand),
                "Missing admin action permission");
        if (brand == null) {
            auditLogService.record("BRAND_CREATE", "FAILURE", authentication, "BRAND", null, request,
                    "Brand payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Brand payload is required"));
        }
        try {
            brand.setId(null);
            Brand savedBrand = brandService.save(brand);
            auditLogService.record("BRAND_CREATE", "SUCCESS", authentication, "BRAND", savedBrand.getId(), request,
                    "Brand created", brandAuditMetadata(savedBrand));
            return ResponseEntity.ok(savedBrand);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BRAND_CREATE", "FAILURE", authentication, "BRAND", null, request,
                    e.getMessage(), brandAuditMetadata(brand));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/brands/{id}")
    public ResponseEntity<?> updateBrand(@PathVariable Long id,
                                         @RequestBody(required = false) Brand brand,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_WRITE_PERMISSION,
                "BRAND_UPDATE", "BRAND", id, request, brandAuditMetadata(brand),
                "Missing admin action permission");
        if (brand == null) {
            auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                    "Brand payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Brand payload is required"));
        }
        Brand existingBrand = brandService.findById(id).orElse(null);
        if (existingBrand == null) {
            auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                    "Brand not found", brandAuditMetadata(brand));
            return ResponseEntity.notFound().build();
        }
        try {
            mergeBrand(existingBrand, brand);
            Brand savedBrand = brandService.save(existingBrand);
            auditLogService.record("BRAND_UPDATE", "SUCCESS", authentication, "BRAND", id, request,
                    "Brand updated", brandAuditMetadata(savedBrand));
            return ResponseEntity.ok(savedBrand);
        } catch (IllegalArgumentException e) {
            auditLogService.record("BRAND_UPDATE", "FAILURE", authentication, "BRAND", id, request,
                    e.getMessage(), brandAuditMetadata(brand));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/brands/{id}")
    public ResponseEntity<?> deleteBrand(@PathVariable Long id,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.BRANDS_DELETE_PERMISSION,
                "BRAND_DELETE", "BRAND", id, request, null,
                "Missing admin action permission");
        Brand brand = brandService.findById(id).orElse(null);
        if (brand == null) {
            auditLogService.record("BRAND_DELETE", "FAILURE", authentication, "BRAND", id, request,
                    "Brand not found", null);
            return ResponseEntity.notFound().build();
        }
        brandService.deleteById(id);
        auditLogService.record("BRAND_DELETE", "SUCCESS", authentication, "BRAND", id, request,
                "Brand deleted", brandAuditMetadata(brand));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/categories")
    public ResponseEntity<List<Category>> getCategories(@RequestParam(required = false) Integer limit) {
        int safeLimit = resolveAdminListLimit("admin.categories.list-max-rows", limit, 500);
        return limitedAdminListResponse(categoryService.findAll(safeLimit + 1), safeLimit);
    }

    @PostMapping("/categories")
    public ResponseEntity<?> createCategory(@RequestBody(required = false) Category category,
                                            Authentication authentication,
                                            HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_WRITE_PERMISSION,
                "CATEGORY_CREATE", "CATEGORY", null, request, categoryAuditMetadata(category),
                "Missing admin action permission");
        if (category == null) {
            auditLogService.record("CATEGORY_CREATE", "FAILURE", authentication, "CATEGORY", null, request,
                    "Category payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Category payload is required"));
        }
        try {
            category.setId(null);
            Category savedCategory = categoryService.save(category);
            auditLogService.record("CATEGORY_CREATE", "SUCCESS", authentication, "CATEGORY", savedCategory.getId(), request,
                    "Category created", categoryAuditMetadata(savedCategory));
            return ResponseEntity.ok(savedCategory);
        } catch (IllegalArgumentException e) {
            auditLogService.record("CATEGORY_CREATE", "FAILURE", authentication, "CATEGORY", null, request,
                    e.getMessage(), categoryAuditMetadata(category));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<?> updateCategory(@PathVariable Long id,
                                            @RequestBody(required = false) Category category,
                                            Authentication authentication,
                                            HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_WRITE_PERMISSION,
                "CATEGORY_UPDATE", "CATEGORY", id, request, categoryAuditMetadata(category),
                "Missing admin action permission");
        if (category == null) {
            auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                    "Category payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Category payload is required"));
        }
        if (categoryService.findById(id).isEmpty()) {
            auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                    "Category not found", categoryAuditMetadata(category));
            return ResponseEntity.notFound().build();
        }
        try {
            category.setId(id);
            Category savedCategory = categoryService.save(category);
            auditLogService.record("CATEGORY_UPDATE", "SUCCESS", authentication, "CATEGORY", id, request,
                    "Category updated", categoryAuditMetadata(savedCategory));
            return ResponseEntity.ok(savedCategory);
        } catch (IllegalArgumentException e) {
            auditLogService.record("CATEGORY_UPDATE", "FAILURE", authentication, "CATEGORY", id, request,
                    e.getMessage(), categoryAuditMetadata(category));
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id,
                                            Authentication authentication,
                                            HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.CATEGORIES_DELETE_PERMISSION,
                "CATEGORY_DELETE", "CATEGORY", id, request, null,
                "Missing admin action permission");
        try {
            Category category = categoryService.findById(id).orElse(null);
            if (category == null) {
                auditLogService.record("CATEGORY_DELETE", "FAILURE", authentication, "CATEGORY", id, request,
                        "Category not found", null);
                return ResponseEntity.notFound().build();
            }
            categoryService.deleteById(id);
            auditLogService.record("CATEGORY_DELETE", "SUCCESS", authentication, "CATEGORY", id, request,
                    "Category deleted", categoryAuditMetadata(category));
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            auditLogService.record("CATEGORY_DELETE", "FAILURE", authentication, "CATEGORY", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String resolveProductKeyword(String keyword, String q) {
        if (keyword != null && !keyword.isBlank()) {
            return keyword;
        }
        return q;
    }

    private void mergeProduct(Product existingProduct, Product product) {
        if (product.getName() != null) existingProduct.setName(product.getName());
        if (product.getDescription() != null) existingProduct.setDescription(product.getDescription());
        if (product.getPrice() != null) existingProduct.setPrice(product.getPrice());
        if (product.getImageUrl() != null) existingProduct.setImageUrl(product.getImageUrl());
        if (product.getStock() != null) existingProduct.setStock(product.getStock());
        if (product.getCategoryId() != null) existingProduct.setCategoryId(product.getCategoryId());
        if (product.getIsFeatured() != null) existingProduct.setIsFeatured(product.getIsFeatured());
        if (product.getBrand() != null) existingProduct.setBrand(product.getBrand());
        if (product.getOriginalPrice() != null) existingProduct.setOriginalPrice(product.getOriginalPrice());
        if (product.getDiscount() != null) existingProduct.setDiscount(product.getDiscount());
        if (product.getLimitedTimePrice() != null) existingProduct.setLimitedTimePrice(product.getLimitedTimePrice());
        if (product.getLimitedTimeStartAt() != null) existingProduct.setLimitedTimeStartAt(product.getLimitedTimeStartAt());
        if (product.getLimitedTimeEndAt() != null) existingProduct.setLimitedTimeEndAt(product.getLimitedTimeEndAt());
        if (product.getTag() != null) existingProduct.setTag(product.getTag());
        if (product.getStatus() != null) existingProduct.setStatus(product.getStatus());
        if (product.getImages() != null) existingProduct.setImages(product.getImages());
        if (product.getSpecifications() != null) existingProduct.setSpecifications(product.getSpecifications());
        if (product.getDetailContent() != null) existingProduct.setDetailContent(product.getDetailContent());
        if (product.getVariants() != null) existingProduct.setVariants(product.getVariants());
        if (product.getWarranty() != null) existingProduct.setWarranty(product.getWarranty());
        if (product.getShipping() != null) existingProduct.setShipping(product.getShipping());
        if (product.getFreeShipping() != null) existingProduct.setFreeShipping(product.getFreeShipping());
        if (product.getFreeShippingThreshold() != null) existingProduct.setFreeShippingThreshold(product.getFreeShippingThreshold());
    }

    private void mergeBrand(Brand existingBrand, Brand brand) {
        existingBrand.setName(brand.getName());
        existingBrand.setDescription(brand.getDescription());
        existingBrand.setLogoUrl(brand.getLogoUrl());
        existingBrand.setWebsiteUrl(brand.getWebsiteUrl());
        existingBrand.setStatus(brand.getStatus());
        existingBrand.setSortOrder(brand.getSortOrder());
    }

    private String productAuditMetadata(Product product) {
        if (product == null) {
            return null;
        }
        return "name=" + product.getName()
                + ",status=" + product.getStatus()
                + ",categoryId=" + product.getCategoryId();
    }

    private String brandAuditMetadata(Brand brand) {
        if (brand == null) {
            return null;
        }
        return "name=" + brand.getName() + ",status=" + brand.getStatus();
    }

    private String categoryAuditMetadata(Category category) {
        if (category == null) {
            return null;
        }
        return "name=" + category.getName()
                + ",parentId=" + category.getParentId()
                + ",level=" + category.getLevel();
    }

    // ==================== Dashboard ====================

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalProducts", productService.countProducts());
        stats.putAll(orderService.getDashboardOrderStats(orderService.currentDatabaseTime(), 7, 5));
        stats.put("totalUsers", userService.count());
        Map<String, Long> orderSummary = orderService.countAdminOrderSummary(null);
        stats.put("refundingPayments", orderSummary.getOrDefault("REFUNDING", 0L));
        stats.put("activeProducts", productService.countActiveProducts());
        stats.put("pendingProducts", productService.countPendingReviewProducts());
        stats.put("lowStockProducts", productService.countLowStockProducts());
        stats.put("topProducts", orderItemService.getTopProductsByPaidStatuses(orderService.dashboardRevenueStatuses(), 8));
        stats.put("lowStockList", productService.findLowStockProducts(8));

        return ResponseEntity.ok(stats);
    }

    private String normalizeProductStatus(String status) {
        return ProductStatusUtils.normalizeProductStatus(status);
    }

    // ==================== Coupon Management ====================

    @GetMapping("/coupons")
    public ResponseEntity<?> getCoupons(@RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String status,
                                        @RequestParam(required = false) String scope,
                                        @RequestParam(required = false) Integer page,
                                        @RequestParam(required = false) Integer size) {
        if (keyword == null && status == null && scope == null && page == null && size == null) {
            return ResponseEntity.ok(couponService.findAll());
        }
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, size == null ? 20 : size);
        Page<Coupon> result = couponService.searchAdminCoupons(keyword, status, scope, safePage - 1, safeSize);
        if (result.getTotalPages() > 0 && safePage > result.getTotalPages()) {
            safePage = result.getTotalPages();
            result = couponService.searchAdminCoupons(keyword, status, scope, safePage - 1, safeSize);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", result.getContent());
        response.put("total", result.getTotalElements());
        response.put("page", safePage);
        response.put("size", result.getSize());
        response.put("totalPages", result.getTotalPages());
        response.put("summary", couponService.adminSummary(keyword, status, scope));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/coupons/summary")
    public ResponseEntity<CouponAdminSummaryResponse> getCouponSummary(@RequestParam(required = false) String keyword,
                                                                       @RequestParam(required = false) String status,
                                                                       @RequestParam(required = false) String scope) {
        return ResponseEntity.ok(couponService.adminSummary(keyword, status, scope));
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@RequestBody(required = false) CouponUpsertRequest request,
                                          Authentication authentication,
                                          HttpServletRequest httpRequest) {
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_WRITE_PERMISSION,
                "COUPON_CREATE", "COUPON", null, httpRequest, couponRequestMetadata(request),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_WRITE_PERMISSION,
                "COUPON_UPDATE", "COUPON", id, httpRequest, couponRequestMetadata(request),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_DELETE_PERMISSION,
                "COUPON_DELETE", "COUPON", id, httpRequest, null,
                "Missing admin action permission");
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
        int requested = request == null || request.getUserIds() == null ? 0 : request.getUserIds().size();
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_GRANT_PERMISSION,
                "COUPON_GRANT", "COUPON", id, httpRequest, "requested=" + requested,
                "Missing admin action permission");
        try {
            List<Long> userIds = request == null || request.getUserIds() == null ? List.of() : request.getUserIds();
            int granted = couponService.grant(id, userIds);
            auditLogService.record("COUPON_GRANT", "SUCCESS", authentication, "COUPON", id, httpRequest,
                    "Coupon granted", "requested=" + userIds.size() + ",granted=" + granted);
            return ResponseEntity.ok(Map.of("granted", granted));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("COUPON_GRANT", "FAILURE", authentication, "COUPON", id, httpRequest,
                    e.getMessage(), "requested=" + requested);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/pet-birthday-coupons/run")
    public ResponseEntity<?> runPetBirthdayCoupons(Authentication authentication,
                                                  HttpServletRequest httpRequest) {
        LocalDate runDate = LocalDate.now();
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_BIRTHDAY_RUN_PERMISSION,
                "PET_BIRTHDAY_COUPON_RUN", "COUPON", null, httpRequest, "date=" + runDate,
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_BIRTHDAY_CONFIG_PERMISSION,
                "PET_BIRTHDAY_COUPON_CONFIG_UPDATE", "COUPON_CONFIG", null, httpRequest,
                petBirthdayCouponConfigRequestMetadata(request),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.NOTIFICATIONS_BROADCAST_PERMISSION,
                "NOTIFICATION_BROADCAST", "NOTIFICATION", null, request, notificationBroadcastMetadata(body, null),
                "Missing admin action permission");
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
    public ResponseEntity<Map<String, Object>> getAllUsers(@RequestParam(required = false) String keyword,
                                                           @RequestParam(required = false) String role,
                                                           @RequestParam(required = false) String status,
                                                           @RequestParam(required = false, defaultValue = "1") int page,
                                                           @RequestParam(required = false, defaultValue = "20") int size) {
        return ResponseEntity.ok(buildAdminUsersPage(keyword, role, status, page, size));
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
        requireAdminActionPermission(authentication, AdminRoleService.USERS_EXPORT_PERMISSION,
                "USER_EXPORT", "USER", null, request, metadata,
                "Missing admin action permission");
        try {
            int exportMaxRows = resolveAdminExportLimit("admin.users.export-max-rows", 10000);
            long total = userService.countSearch(safeKeyword, safeRole, safeStatus);
            if (total > exportMaxRows) {
                String message = "User export exceeds maximum row count " + exportMaxRows + "; narrow the filters";
                auditLogService.record("USER_EXPORT", "FAILURE", authentication, "USER", null, request,
                        message, metadata + ",total=" + total + ",maxRows=" + exportMaxRows);
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .header("X-Export-Total", String.valueOf(total))
                        .header("X-Export-Returned", "0")
                        .header("X-Export-Truncated", "true")
                        .header("X-Export-Limit", String.valueOf(exportMaxRows))
                        .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                                "X-Export-Total,X-Export-Returned,X-Export-Truncated,X-Export-Limit")
                        .body(message.getBytes(StandardCharsets.UTF_8));
            }
            List<User> users = userService.searchPage(safeKeyword, safeRole, safeStatus, 1, exportMaxRows);
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
                    .header("X-Export-Total", String.valueOf(total))
                    .header("X-Export-Returned", String.valueOf(users.size()))
                    .header("X-Export-Truncated", "false")
                    .header("X-Export-Limit", String.valueOf(exportMaxRows))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                            "Content-Disposition,X-Export-Total,X-Export-Returned,X-Export-Truncated,X-Export-Limit")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(csv.toString().getBytes(StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            auditLogService.record("USER_EXPORT", "FAILURE", authentication, "USER", null, request,
                    e.getMessage(), metadata);
            throw e;
        }
    }

    @GetMapping("/roles")
    public ResponseEntity<List<AdminRole>> getRoles(@RequestParam(required = false) Integer limit,
                                                    Authentication authentication,
                                                    HttpServletRequest request) {
        try {
            SecurityUtils.assertSuperAdmin(authentication);
        } catch (RuntimeException e) {
            auditLogService.record("ADMIN_ROLE_LIST", "FAILURE", authentication, "ADMIN_ROLE", null, request,
                    e.getMessage(), null);
            throw e;
        }
        int safeLimit = resolveAdminListLimit("admin.roles.list-max-rows", limit, 200);
        return limitedAdminListResponse(adminRoleService.findAll(safeLimit + 1), safeLimit);
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
            } else if ("ADMIN".equals(role)) {
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
        boolean selfUpdate = Objects.equals(SecurityUtils.requireUser(authentication).getId(), id);
        if (user.getStatus() != null) {
            requireAdminActionPermission(authentication, AdminRoleService.USERS_STATUS_PERMISSION,
                    "USER_STATUS_UPDATE", "USER", id, request, userUpdateRequestMetadata(user),
                    "Missing admin action permission");
            String normalizedStatus = normalizeUserStatus(user.getStatus());
            if (normalizedStatus == null) {
                auditLogService.record("USER_STATUS_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Invalid status", userUpdateRequestMetadata(user));
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid status"));
            }
            if (isGuestStatus(existing.getStatus()) || isGuestStatus(normalizedStatus)) {
                auditLogService.record("USER_STATUS_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Guest status is system-managed", userUpdateRequestMetadata(user));
                return ResponseEntity.badRequest().body(Map.of("error", "Guest status is system-managed"));
            }
            if (selfUpdate) {
                auditLogService.record("USER_STATUS_UPDATE", "FAILURE", authentication, "USER", id, request,
                        "Cannot change current operator status", userUpdateRequestMetadata(user));
                return ResponseEntity.badRequest().body(Map.of("error", "Cannot change current operator status"));
            }
            if (isPrivilegedOperator(existing)) {
                try {
                    SecurityUtils.assertSuperAdmin(authentication);
                } catch (RuntimeException e) {
                    auditLogService.record("USER_STATUS_UPDATE", "FAILURE", authentication, "USER", id, request,
                            e.getMessage(), userUpdateRequestMetadata(user));
                    throw e;
                }
            }
            existing.setStatus(normalizedStatus);
        }
        if (hasProfileContactUpdate(user) && isPrivilegedOperator(existing) && !selfUpdate) {
            try {
                SecurityUtils.assertSuperAdmin(authentication);
            } catch (RuntimeException e) {
                auditLogService.record("USER_UPDATE", "FAILURE", authentication, "USER", id, request,
                        e.getMessage(), userUpdateRequestMetadata(user));
                throw e;
            }
        }
        if (hasProfileContactUpdate(user) && !(isPrivilegedOperator(existing) && !selfUpdate)) {
            requireAdminActionPermission(authentication, AdminRoleService.USERS_WRITE_PERMISSION,
                    "USER_UPDATE", "USER", id, request, userUpdateRequestMetadata(user),
                    "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.USERS_DELETE_PERMISSION,
                "USER_DELETE", "USER", id, request, userAuditMetadata(existing),
                "Missing admin action permission");
        userService.deleteById(id);
        auditLogService.record("USER_DELETE", "SUCCESS", authentication, "USER", id, request,
                "User deleted", userAuditMetadata(existing));
        return ResponseEntity.ok().build();
    }

    // ==================== Order Management ====================

    @GetMapping("/orders")
    public ResponseEntity<Map<String, Object>> getAllOrders(@RequestParam(required = false) String status,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) String quick,
                                                            @RequestParam(required = false, defaultValue = "1") int page,
                                                            @RequestParam(required = false, defaultValue = "20") int size) {
        return ResponseEntity.ok(buildAdminOrdersPage(status, search, quick, page, size));
    }

    @GetMapping("/orders/page")
    public ResponseEntity<Map<String, Object>> getOrdersPage(@RequestParam(required = false) String status,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(required = false) String quick,
                                                             @RequestParam(required = false, defaultValue = "1") int page,
                                                             @RequestParam(required = false, defaultValue = "20") int size) {
        return ResponseEntity.ok(buildAdminOrdersPage(status, search, quick, page, size));
    }

    private Map<String, Object> buildAdminOrdersPage(String status, String search, String quick, int page, int size) {
        int safeSize = resolveAdminPageSize("admin.orders.page-max-size", size, 20);
        int safePage = Math.max(1, page);
        String safeStatus = normalizeAdminFilter(status, 40);
        String safeSearch = normalizeAdminFilter(search, 120);
        String safeQuick = normalizeAdminFilter(quick, 40);
        int total = orderService.countAdminOrders(safeStatus, safeSearch, safeQuick);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        List<AdminOrderResponse> orders = orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, safePage, safeSize)
                .stream()
                .map(AdminOrderResponse::from)
                .collect(Collectors.toList());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", orders);
        response.put("total", total);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        response.put("summary", buildAdminOrdersSummary(safeSearch));
        return response;
    }

    private Map<String, Object> buildAdminOrdersSummary(String safeSearch) {
        Map<String, Object> summary = new LinkedHashMap<>();
        Map<String, Long> baseSummary = orderService.countAdminOrderSummary(safeSearch);
        if (baseSummary != null) {
            summary.putAll(baseSummary);
        }
        summary.put("MISSING_TRACKING", (long) orderService.countAdminOrders(null, safeSearch, "MISSING_TRACKING"));
        return summary;
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<Order> getOrder(@PathVariable Long id) {
        Order order = orderService.getOrderById(id);
        return order == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(order);
    }

    @GetMapping("/orders/{id}/items")
    public ResponseEntity<List<OrderItem>> getOrderItems(@PathVariable Long id) {
        if (orderService.getOrderById(id) == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(orderItemService.getOrderItemsByOrderId(id));
    }

    @GetMapping("/orders/{id}/payments")
    public ResponseEntity<List<PaymentResponse>> getOrderPayments(@PathVariable Long id,
                                                                  Authentication authentication,
                                                                  HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.ORDER_PAYMENT_PERMISSION,
                "PAYMENT_VIEW", "ORDER", id, request, null);
        if (orderService.getOrderById(id) == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(paymentResponses(paymentService.findStoredByOrderId(id)));
    }

    @PostMapping("/orders/payments/{paymentId}/sync")
    public ResponseEntity<?> syncOrderPayment(@PathVariable Long paymentId,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.ORDER_PAYMENT_PERMISSION,
                "PAYMENT_SYNC", "PAYMENT", paymentId, request, null);
        Payment existing = paymentService.findById(paymentId);
        if (existing == null) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", paymentId, request,
                    "Payment not found", null);
            return ResponseEntity.notFound().build();
        }
        try {
            Payment payment = paymentService.syncPayment(paymentId);
            auditLogService.record("PAYMENT_SYNC", "SUCCESS", authentication, "PAYMENT", paymentId, request,
                    "Admin payment state synced", payment == null ? null : payment.getOrderNo());
            return ResponseEntity.ok(PaymentResponse.from(payment));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", paymentId, request,
                    e.getMessage(), existing.getOrderNo());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
        requireAdminActionPermission(authentication, permissionForOrderStatusAction(order.getStatus(), newStatus),
                auditActionForOrderStatus(order.getStatus(), newStatus), "ORDER", id, request,
                "from=" + order.getStatus() + ",to=" + newStatus + ",orderNo=" + order.getOrderNo());

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
                    response.put("payment", PaymentResponse.from(payment));
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
        requireAdminActionPermission(authentication, AdminRoleService.ORDER_REFUND_PERMISSION,
                "REFUND_COMPLETE", "ORDER", id, request, null);
        String reason = body == null || body.get("reason") == null ? "" : String.valueOf(body.get("reason"));
        boolean restock = body != null && Boolean.parseBoolean(String.valueOf(body.getOrDefault("restock", "false")));
        String manualRefundReference = body == null || body.get("manualRefundReference") == null ? null : String.valueOf(body.get("manualRefundReference"));
        try {
            Order order = orderService.getOrderById(id);
            boolean effectiveRestock = restock || (order != null && "PENDING_SHIPMENT".equals(order.getStatus()));
            Payment payment = orderService.refundOrder(id, reason, effectiveRestock, manualRefundReference);
            String restockAudit = "restock=" + effectiveRestock
                    + (effectiveRestock != restock ? ",requestedRestock=" + restock : "");
            auditLogService.record("REFUND_COMPLETE", "SUCCESS", authentication, "ORDER", id, request,
                    "Order refunded",
                    "paymentId=" + payment.getId() + ",channel=" + payment.getChannel() + ",reference=" + payment.getRefundReference() + "," + restockAudit);
            return ResponseEntity.ok(Map.of(
                    "message", "Refund completed",
                    "payment", PaymentResponse.from(payment)
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
        requireAdminActionPermission(authentication, AdminRoleService.ORDER_FULFILLMENT_PERMISSION,
                "ORDER_BATCH_SHIP", "ORDER", null, request, null);
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
    public ResponseEntity<List<LogisticsCarrier>> getLogisticsCarriers(@RequestParam(defaultValue = "false") boolean activeOnly,
                                                                       @RequestParam(required = false) Integer limit) {
        int safeLimit = resolveAdminListLimit("admin.logistics-carriers.list-max-rows", limit, 500);
        return limitedAdminListResponse(logisticsCarrierService.findAll(activeOnly, safeLimit + 1), safeLimit);
    }

    @PostMapping("/logistics-carriers")
    public ResponseEntity<?> createLogisticsCarrier(@RequestBody(required = false) LogisticsCarrier carrier,
                                                    Authentication authentication,
                                                    HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.LOGISTICS_CARRIERS_WRITE_PERMISSION,
                "LOGISTICS_CARRIER_CREATE", "LOGISTICS_CARRIER", null, request, logisticsCarrierAuditMetadata(carrier),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.LOGISTICS_CARRIERS_WRITE_PERMISSION,
                "LOGISTICS_CARRIER_UPDATE", "LOGISTICS_CARRIER", id, request, logisticsCarrierAuditMetadata(carrier),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.LOGISTICS_CARRIERS_DELETE_PERMISSION,
                "LOGISTICS_CARRIER_DELETE", "LOGISTICS_CARRIER", id, request, null,
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_STATUS_PERMISSION,
                "PRODUCT_STATUS_UPDATE", "PRODUCT", id, request,
                body == null ? null : "status=" + body.get("status"),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_STATUS_PERMISSION,
                "PRODUCT_BATCH_STATUS_UPDATE", "PRODUCT", null, request,
                body == null ? null : "status=" + body.get("status"),
                "Missing admin action permission");
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

        List<?> rawIds = (List<?>) idsValue;
        int maxBatchSize = resolveAdminBatchLimit("admin.products.batch-status-max-size", 100);
        if (rawIds.size() > maxBatchSize) {
            auditLogService.record("PRODUCT_BATCH_STATUS_UPDATE", "FAILURE", authentication, "PRODUCT", null, request,
                    "too many productIds", "requested=" + rawIds.size() + ",max=" + maxBatchSize + ",status=" + status);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "too many productIds",
                    "max", maxBatchSize));
        }

        int success = 0;
        int failed = 0;
        for (Object idValue : rawIds) {
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
                "Product batch status updated",
                "status=" + status + ",requested=" + rawIds.size() + ",max=" + maxBatchSize
                        + ",success=" + success + ",failed=" + failed);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "failed", failed,
                "requested", rawIds.size(),
                "max", maxBatchSize));
    }

    // ==================== Product Import ====================

    @PostMapping(value = "/products/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductImportResult> previewImportProducts(@RequestParam(value = "file", required = false) MultipartFile file,
                                                                     Authentication authentication,
                                                                     HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_IMPORT_PERMISSION,
                "PRODUCT_IMPORT_PREVIEW", "PRODUCT_IMPORT", null, request, productImportMetadata(null, file),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_IMPORT_PERMISSION,
                "PRODUCT_IMPORT_APPLY", "PRODUCT_IMPORT", null, request, productImportMetadata(null, file),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_IMPORT_PERMISSION,
                "PRODUCT_URL_IMPORT", "PRODUCT_IMPORT", null, httpRequest,
                "urlHost=" + encodeMetadataValue(safeImportResourceId(url)),
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.ORDER_EXPORT_PERMISSION,
                "ORDER_EXPORT", "ORDER", null, request, metadata,
                "Missing admin action permission");
        try {
            int exportLimit = resolveAdminExportLimit("admin.orders.export-max-rows", 5000);
            int total = orderService.countAdminOrders(safeStatus, safeSearch, safeQuick);
            List<Order> orders = orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, 1, exportLimit);
            Map<Long, List<OrderItem>> itemsByOrderId = orderItemService.getOrderItemsByOrderIds(orders.stream()
                    .map(Order::getId)
                    .collect(Collectors.toList()));

            StringBuilder csv = new StringBuilder("\uFEFF");
            csv.append(CsvUtils.row(Arrays.asList(
                    "id", "orderNo", "userId", "customerDisplayName", "customerEmail", "customerPhone", "customerType", "totalAmount", "status",
                    "recipientName", "recipientPhone", "contactEmail", "shippingAddress", "paymentMethod", "trackingNumber", "returnTrackingNumber",
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
                        order.getCustomerDisplayName(),
                        order.getCustomerEmail(),
                        order.getCustomerPhone(),
                        order.getCustomerType(),
                        order.getTotalAmount(),
                        order.getStatus(),
                        order.getRecipientName(),
                        order.getRecipientPhone(),
                        order.getContactEmail(),
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
                    .header("X-Export-Limit", String.valueOf(exportLimit))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                            "Content-Disposition,X-Export-Total,X-Export-Returned,X-Export-Truncated,X-Export-Limit")
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
    public ResponseEntity<SecurityAuditSummaryResponse> getAuditLogSummary(@RequestParam(required = false) String action,
                                                                           @RequestParam(required = false) String result,
                                                                           @RequestParam(required = false) String actorUsername,
                                                                           @RequestParam(required = false) String resourceType,
                                                                           @RequestParam(required = false) String startAt,
                                                                           @RequestParam(required = false) String endAt,
                                                                           @RequestParam(required = false, defaultValue = "10") int topLimit) {
        return ResponseEntity.ok(auditLogService.summary(
                action,
                result,
                actorUsername,
                resourceType,
                parseDateTime(startAt),
                parseDateTime(endAt),
                topLimit));
    }

    @PostMapping("/audit-logs/purge")
    public ResponseEntity<SecurityAuditPurgeResponse> purgeAuditLogs(@RequestParam(required = false, defaultValue = "180") int retentionDays,
                                                                     Authentication authentication,
                                                                     HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.AUDIT_LOGS_PURGE_PERMISSION,
                "AUDIT_LOG_PURGE", "SECURITY_AUDIT_LOG", null, request,
                "retentionDays=" + retentionDays,
                "Missing admin action permission");
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
        String metadata = auditLogExportMetadata(action, result, actorUsername, resourceType, startAt, endAt);
        requireAdminActionPermission(authentication, AdminRoleService.AUDIT_LOGS_EXPORT_PERMISSION,
                "AUDIT_LOG_EXPORT", "SECURITY_AUDIT_LOG", null, request, metadata,
                "Missing admin action permission");
        try {
            LocalDateTime safeStartAt = parseDateTime(startAt);
            LocalDateTime safeEndAt = parseDateTime(endAt);
            int exportLimit = auditLogService.exportMaxRows();
            long total = auditLogService.countExport(
                    action,
                    result,
                    actorUsername,
                    resourceType,
                    safeStartAt,
                    safeEndAt);
            List<SecurityAuditLog> logs = auditLogService.export(
                    action,
                    result,
                    actorUsername,
                    resourceType,
                    safeStartAt,
                    safeEndAt);

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
                    "Security audit logs exported",
                    metadata + ",count=" + logs.size() + ",total=" + total + ",maxRows=" + exportLimit
                            + ",truncated=" + (total > logs.size()));

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=security-audit-logs.csv")
                    .header("X-Export-Total", String.valueOf(total))
                    .header("X-Export-Returned", String.valueOf(logs.size()))
                    .header("X-Export-Truncated", String.valueOf(total > logs.size()))
                    .header("X-Export-Limit", String.valueOf(exportLimit))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                            "Content-Disposition,X-Export-Total,X-Export-Returned,X-Export-Truncated,X-Export-Limit")
                    .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                    .body(csv.toString().getBytes(StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            auditLogService.record("AUDIT_LOG_EXPORT", "FAILURE", authentication, "SECURITY_AUDIT_LOG", null, request,
                    e.getMessage(), metadata);
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

    private String permissionForOrderStatusAction(String currentStatus, String newStatus) {
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

    private void requireAdminActionPermission(Authentication authentication,
                                              String permission,
                                              String auditAction,
                                              String resourceType,
                                              Long resourceId,
                                              HttpServletRequest request,
                                              String metadata) {
        requireAdminActionPermission(authentication, permission, auditAction, resourceType, resourceId, request, metadata,
                "No permission for this order action");
    }

    private void requireAdminActionPermission(Authentication authentication,
                                              String permission,
                                              String auditAction,
                                              String resourceType,
                                              Long resourceId,
                                              HttpServletRequest request,
                                              String metadata,
                                              String deniedMessage) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        String auditMetadata = metadata == null || metadata.isBlank()
                ? "permission=" + permission
                : metadata + ",permission=" + permission;
        auditLogService.record(auditAction, "FAILURE", authentication, resourceType, resourceId, request,
                "Missing admin action permission", auditMetadata);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, deniedMessage);
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

    private String adminReviewAuditMetadata(AdminReviewResponse review) {
        if (review == null) {
            return null;
        }
        return "productId=" + review.getProductId()
                + ",userId=" + review.getUserId()
                + ",rating=" + review.getRating()
                + ",status=" + review.getStatus();
    }

    private int resolveAdminListLimit(String configKey, Integer requestedLimit, int fallback) {
        int configuredLimit = Math.max(1, runtimeConfig.getInt(configKey, fallback));
        int rawLimit = requestedLimit != null && requestedLimit > 0 ? requestedLimit : configuredLimit;
        return Math.max(1, Math.min(rawLimit, HARD_ADMIN_LIST_LIMIT));
    }

    private int resolveAdminExportLimit(String configKey, int fallback) {
        int configuredLimit = Math.max(1, runtimeConfig.getInt(configKey, fallback));
        return Math.max(1, Math.min(configuredLimit, HARD_ADMIN_EXPORT_LIMIT));
    }

    private int resolveAdminBatchLimit(String configKey, int fallback) {
        int configuredLimit = Math.max(1, runtimeConfig.getInt(configKey, fallback));
        return Math.max(1, Math.min(configuredLimit, HARD_ADMIN_BATCH_LIMIT));
    }

    private int resolveAdminPageSize(String configKey, int requestedSize, int fallback) {
        int configuredLimit = Math.max(1, Math.min(runtimeConfig.getInt(configKey, fallback), HARD_ADMIN_PAGE_SIZE_LIMIT));
        int rawSize = requestedSize > 0 ? requestedSize : fallback;
        return Math.max(1, Math.min(rawSize, configuredLimit));
    }

    private <T> ResponseEntity<List<T>> limitedAdminListResponse(List<T> rows, int limit) {
        List<T> source = rows == null ? List.of() : rows;
        boolean truncated = source.size() > limit;
        List<T> body = truncated
                ? source.stream().limit(limit).collect(Collectors.toList())
                : source;
        return ResponseEntity.ok()
                .header("X-Admin-List-Limit", String.valueOf(limit))
                .header("X-Admin-List-Returned", String.valueOf(body.size()))
                .header("X-Admin-List-Truncated", String.valueOf(truncated))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        "X-Admin-List-Limit,X-Admin-List-Returned,X-Admin-List-Truncated")
                .body(body);
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

    private List<PaymentResponse> paymentResponses(List<Payment> payments) {
        return payments.stream().map(PaymentResponse::from).collect(Collectors.toList());
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

    private boolean isGuestStatus(String status) {
        return status != null && "GUEST".equals(status.trim().toUpperCase());
    }

    private boolean hasProfileContactUpdate(User user) {
        return user != null && (user.getEmail() != null || user.getPhone() != null || user.getAddress() != null);
    }

    private boolean isPrivilegedOperator(User user) {
        if (user == null) {
            return false;
        }
        String role = user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
        return AdminRoleService.ADMIN.equals(role)
                || AdminRoleService.SUPER_ADMIN.equals(role);
    }

    private Map<String, Object> buildAdminUsersPage(String keyword, String role, String status, int page, int size) {
        int safeSize = resolveAdminPageSize("admin.users.page-max-size", size, 20);
        int safePage = Math.max(1, page);
        String safeKeyword = normalizeAdminFilter(keyword, 120);
        String safeRole = normalizeAdminFilter(role, 40);
        String safeStatus = normalizeAdminFilter(status, 40);
        long total = userService.countSearch(safeKeyword, safeRole, safeStatus);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        List<User> users = userService.searchPage(safeKeyword, safeRole, safeStatus, safePage, safeSize);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", users);
        response.put("total", total);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        return response;
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
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int limit) {
        return ResponseEntity.ok(productQuestionService.getAdminQueue(status, search, limit));
    }

    @GetMapping("/questions/summary")
    public ResponseEntity<ProductQuestionAdminSummaryResponse> getAdminQuestionSummary(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(productQuestionService.adminSummary(status, search));
    }

    @PutMapping("/questions/{id}/answer")
    public ResponseEntity<?> answerAdminQuestion(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication,
            HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.QUESTIONS_ANSWER_PERMISSION,
                "PRODUCT_QUESTION_ANSWER", "PRODUCT_QUESTION", id, request,
                body == null ? null : "answer=present",
                "Missing admin action permission");
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

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<?> deleteAdminQuestion(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.QUESTIONS_DELETE_PERMISSION,
                "PRODUCT_QUESTION_DELETE", "PRODUCT_QUESTION", id, request, null,
                "Missing admin action permission");
        try {
            ProductQuestion question = productQuestionService.delete(id);
            auditLogService.record("PRODUCT_QUESTION_DELETE", "SUCCESS", authentication, "PRODUCT_QUESTION", id, request,
                    "Product question deleted", productQuestionAuditMetadata(question));
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            auditLogService.record("PRODUCT_QUESTION_DELETE", "FAILURE", authentication, "PRODUCT_QUESTION", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            auditLogService.record("PRODUCT_QUESTION_DELETE", "FAILURE", authentication, "PRODUCT_QUESTION", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    @GetMapping("/reviews")
    public ResponseEntity<Map<String, Object>> getAllReviews(@RequestParam(required = false) String status,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(required = false, defaultValue = "1") int page,
                                                             @RequestParam(required = false, defaultValue = "20") int size) {
        int safeSize = resolveAdminPageSize("admin.reviews.page-max-size", size, 20);
        int safePage = Math.max(1, page);
        String safeStatus = normalizeAdminFilter(status, 40);
        String safeSearch = normalizeAdminFilter(search, 120);
        long total = reviewService.countAdminReviews(safeStatus, safeSearch);
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        if (totalPages > 0 && safePage > totalPages) {
            safePage = totalPages;
        }
        List<AdminReviewResponse> reviews = reviewService.searchAdminReviewResponses(safeStatus, safeSearch, safePage, safeSize);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", reviews);
        response.put("total", total);
        response.put("page", safePage);
        response.put("size", safeSize);
        response.put("totalPages", totalPages);
        response.put("summary", reviewService.summarizeAdminReviews(safeStatus, safeSearch));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<?> deleteReview(@PathVariable Long id,
                                          Authentication authentication,
                                          HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.REVIEWS_DELETE_PERMISSION,
                "REVIEW_DELETE", "REVIEW", id, request, null,
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.REVIEWS_REPLY_PERMISSION,
                "REVIEW_REPLY", "REVIEW", id, request,
                body == null ? null : "reply=present",
                "Missing admin action permission");
        try {
            AdminReviewResponse review = reviewService.replyReviewForAdmin(id, body == null ? null : body.get("reply"));
            auditLogService.record("REVIEW_REPLY", "SUCCESS", authentication, "REVIEW", id, request,
                    "Review replied", adminReviewAuditMetadata(review));
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
        requireAdminActionPermission(authentication, AdminRoleService.REVIEWS_MODERATE_PERMISSION,
                "REVIEW_STATUS_UPDATE", "REVIEW", id, request,
                body == null ? null : "status=" + body.get("status"),
                "Missing admin action permission");
        try {
            String status = body == null ? null : body.get("status");
            AdminReviewResponse review = reviewService.updateReviewStatusForAdmin(id, status);
            auditLogService.record("REVIEW_STATUS_UPDATE", "SUCCESS", authentication, "REVIEW", id, request,
                    "Review status updated", adminReviewAuditMetadata(review));
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
    public ResponseEntity<Map<String, Object>> getGalleryPhotos(@RequestParam(required = false) String status,
                                                                @RequestParam(required = false) String source,
                                                                @RequestParam(required = false) String keyword,
                                                                @RequestParam(defaultValue = "1") int page,
                                                                @RequestParam(defaultValue = "12") int size) {
        int safeSize = resolveAdminPageSize("admin.pet-gallery.page-max-size", size, 12);
        int safePage = Math.max(1, page);
        Page<PetGalleryPhoto> result = petGalleryService.findForAdmin(status, source, keyword, safePage - 1, safeSize);
        if (result.getTotalPages() > 0 && safePage > result.getTotalPages()) {
            safePage = result.getTotalPages();
            result = petGalleryService.findForAdmin(status, source, keyword, safePage - 1, safeSize);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", result.getContent());
        response.put("total", result.getTotalElements());
        response.put("page", safePage);
        response.put("size", result.getSize());
        response.put("totalPages", result.getTotalPages());
        response.put("summary", petGalleryService.summarizeForAdmin(status, source, keyword));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/pet-gallery/{id}")
    public ResponseEntity<?> deleteGalleryPhoto(@PathVariable Long id,
                                                 Authentication authentication,
                                                 HttpServletRequest httpRequest) {
        requireAdminActionPermission(authentication, AdminRoleService.PET_GALLERY_DELETE_PERMISSION,
                "PET_GALLERY_PHOTO_DELETE", "PET_GALLERY", id, httpRequest, null,
                "Missing admin action permission");
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
        requireAdminActionPermission(authentication, AdminRoleService.COUPONS_BIRTHDAY_REISSUE_PERMISSION,
                "PET_BIRTHDAY_COUPON_REISSUE", "COUPON", null, httpRequest,
                body == null ? null : "payload=present",
                "Missing admin action permission");
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
