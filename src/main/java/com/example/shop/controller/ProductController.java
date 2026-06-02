package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicPageResponse;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.entity.Product;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ProductService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.data.domain.Page;
import com.example.shop.util.ProductStatusUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/products")
public class ProductController {
    private static final int DEFAULT_PUBLIC_PRODUCT_PAGE = 0;
    private static final int DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE = 24;

    @Autowired
    private ProductService productService;

    @Autowired
    private SecurityAuditLogService auditLogService;

    @Autowired
    private AdminRoleService adminRoleService;

    @GetMapping
    public ResponseEntity<?> getAllProducts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, name = "q") String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Boolean discount,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false, name = "price_min") BigDecimal priceMin,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false, name = "price_max") BigDecimal priceMax,
            @RequestParam(required = false) List<String> petSize,
            @RequestParam(required = false) List<String> material,
            @RequestParam(required = false) List<String> color,
            @RequestParam(required = false) String collection,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        ProductListQuery query = new ProductListQuery();
        query.setKeyword(resolveKeyword(keyword, q));
        query.setCategoryId(categoryId);
        query.setDiscount(discount);
        query.setFeatured(featured);
        query.setMinPrice(minPrice == null ? priceMin : minPrice);
        query.setMaxPrice(maxPrice == null ? priceMax : maxPrice);
        query.setPetSizes(petSize);
        query.setMaterials(material);
        query.setColors(color);
        query.setCollection(collection);
        query.setStatus(status);
        query.setPage(page == null ? DEFAULT_PUBLIC_PRODUCT_PAGE : page);
        query.setSize(size == null ? DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE : size);
        query.setSort(sort);
        Page<Product> result = productService.findPublicProductPage(query);
        return ResponseEntity.ok(ProductPublicPageResponse.of(
                toPublicProducts(result.getContent()),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize()));
    }

    private String resolveKeyword(String keyword, String q) {
        if (keyword != null && !keyword.isBlank()) {
            return keyword;
        }
        return q;
    }

    @GetMapping("/featured")
    public ResponseEntity<List<ProductPublicResponse>> getFeaturedProducts(
            @RequestParam(required = false, defaultValue = "12") Integer limit) {
        return ResponseEntity.ok(toPublicProducts(productService.findPublicFeaturedProducts(limit)));
    }

    @GetMapping("/personalized-recommendations")
    public ResponseEntity<List<ProductPublicResponse>> getPersonalizedRecommendations(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.ok(List.of());
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return ResponseEntity.ok(toPublicProducts(productService.findPersonalizedRecommendations(userDetails.getId())));
    }

    @GetMapping("/add-on-candidates")
    public ResponseEntity<List<ProductPublicResponse>> getAddOnCandidates(
            @RequestParam(required = false) BigDecimal targetAmount,
            @RequestParam(required = false) List<Long> excludedIds,
            @RequestParam(required = false, defaultValue = "3") Integer limit) {
        return ResponseEntity.ok(toPublicProducts(productService.findAddOnCandidates(targetAmount, excludedIds, limit == null ? 3 : limit)));
    }

    @GetMapping("/finder-candidates")
    public ResponseEntity<List<ProductPublicResponse>> getFinderCandidates(
            @RequestParam(required = false) List<String> keywords,
            @RequestParam(required = false, defaultValue = "36") Integer limit) {
        return ResponseEntity.ok(toPublicProducts(productService.findFinderCandidates(keywords, limit == null ? 36 : limit)));
    }

    @GetMapping("/by-ids")
    public ResponseEntity<List<ProductPublicResponse>> getProductsByIds(@RequestParam(required = false) List<Long> ids) {
        return ResponseEntity.ok(toPublicProducts(productService.findPublicByIds(ids)));
    }

    @GetMapping("/{id}/recommendations")
    public ResponseEntity<List<ProductPublicResponse>> getRecommendations(@PathVariable Long id) {
        Product product = productService.findPublicById(id).orElse(null);
        if (product == null) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(toPublicProducts(productService.findRelatedProducts(id, product.getCategoryId())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductPublicResponse> getProductById(@PathVariable Long id) {
        return productService.findPublicById(id)
                .map(ProductPublicResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private List<ProductPublicResponse> toPublicProducts(List<Product> products) {
        return products == null ? List.of() : products.stream()
                .map(ProductPublicResponse::from)
                .collect(Collectors.toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Product> createProduct(@RequestBody(required = false) Product product,
                                                 Authentication authentication,
                                                 HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_WRITE_PERMISSION,
                "PRODUCT_CREATE", "PRODUCT", null, request, productAuditMetadata(product));
        if (product == null) {
            auditLogService.record("PRODUCT_CREATE", "FAILURE", authentication, "PRODUCT", null, request,
                    "Product payload is required", null);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product payload is required");
        }
        try {
            product.setStatus(normalizeProductStatus(product.getStatus()));
            Product savedProduct = productService.save(product);
            auditLogService.record("PRODUCT_CREATE", "SUCCESS", authentication, "PRODUCT", savedProduct.getId(), request,
                    "Product created", "name=" + savedProduct.getName() + ",status=" + savedProduct.getStatus());
            return ResponseEntity.ok(savedProduct);
        } catch (RuntimeException e) {
            auditLogService.record("PRODUCT_CREATE", "FAILURE", authentication, "PRODUCT", null, request,
                    e.getMessage(), productAuditMetadata(product));
            throw e;
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id,
                                                 @RequestBody(required = false) Product product,
                                                 Authentication authentication,
                                                 HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_WRITE_PERMISSION,
                "PRODUCT_UPDATE", "PRODUCT", id, request, productAuditMetadata(product));
        if (product == null) {
            auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    "Product payload is required", null);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product payload is required");
        }
        try {
            return productService.findById(id)
                    .map(existingProduct -> {
                        mergeProduct(existingProduct, product);
                        Product savedProduct = productService.save(existingProduct);
                        auditLogService.record("PRODUCT_UPDATE", "SUCCESS", authentication, "PRODUCT", id, request,
                                "Product updated", "name=" + savedProduct.getName() + ",status=" + savedProduct.getStatus());
                        return ResponseEntity.ok(savedProduct);
                    })
                    .orElseGet(() -> {
                        auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                                "Product not found", productAuditMetadata(product));
                        return ResponseEntity.notFound().build();
                    });
        } catch (RuntimeException e) {
            auditLogService.record("PRODUCT_UPDATE", "FAILURE", authentication, "PRODUCT", id, request,
                    e.getMessage(), productAuditMetadata(product));
            throw e;
        }
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
        if (product.getStatus() != null) existingProduct.setStatus(normalizeProductStatus(product.getStatus()));
        if (product.getImages() != null) existingProduct.setImages(product.getImages());
        if (product.getSpecifications() != null) existingProduct.setSpecifications(product.getSpecifications());
        if (product.getDetailContent() != null) existingProduct.setDetailContent(product.getDetailContent());
        if (product.getVariants() != null) existingProduct.setVariants(product.getVariants());
        if (product.getWarranty() != null) existingProduct.setWarranty(product.getWarranty());
        if (product.getShipping() != null) existingProduct.setShipping(product.getShipping());
        if (product.getFreeShipping() != null) existingProduct.setFreeShipping(product.getFreeShipping());
        if (product.getFreeShippingThreshold() != null) existingProduct.setFreeShippingThreshold(product.getFreeShippingThreshold());
    }

    private String normalizeProductStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = ProductStatusUtils.normalizeProductStatus(status);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be one of " + ProductStatusUtils.PRODUCT_STATUSES);
        }
        return normalized;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        requireAdminActionPermission(authentication, AdminRoleService.PRODUCTS_DELETE_PERMISSION,
                "PRODUCT_DELETE", "PRODUCT", id, request, null);
        try {
            return productService.findById(id)
                    .map(product -> {
                        productService.deleteById(id);
                        auditLogService.record("PRODUCT_DELETE", "SUCCESS", authentication, "PRODUCT", id, request,
                                "Product deleted", "name=" + product.getName() + ",status=" + product.getStatus());
                        return ResponseEntity.ok().<Void>build();
                    })
                    .orElseGet(() -> {
                        auditLogService.record("PRODUCT_DELETE", "FAILURE", authentication, "PRODUCT", id, request,
                                "Product not found", null);
                        return ResponseEntity.notFound().build();
                    });
        } catch (RuntimeException e) {
            auditLogService.record("PRODUCT_DELETE", "FAILURE", authentication, "PRODUCT", id, request,
                    e.getMessage(), null);
            throw e;
        }
    }

    private void requireAdminActionPermission(Authentication authentication,
                                              String permission,
                                              String auditAction,
                                              String resourceType,
                                              Long resourceId,
                                              HttpServletRequest request,
                                              String metadata) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (adminRoleService.hasPermission(user.getId(), permission)) {
            return;
        }
        String auditMetadata = metadata == null || metadata.isBlank()
                ? "permission=" + permission
                : metadata + ",permission=" + permission;
        auditLogService.record(auditAction, "FAILURE", authentication, resourceType, resourceId, request,
                "Missing admin action permission", auditMetadata);
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private String productAuditMetadata(Product product) {
        if (product == null) {
            return null;
        }
        return "name=" + product.getName()
                + ",status=" + product.getStatus()
                + ",categoryId=" + product.getCategoryId();
    }
}
