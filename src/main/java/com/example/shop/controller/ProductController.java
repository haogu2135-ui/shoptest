package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicListItemResponse;
import com.example.shop.dto.ProductPublicPageResponse;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.entity.Product;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ProductService;
import com.example.shop.service.SecurityAuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/products")
public class ProductController {
    private static final int DEFAULT_PUBLIC_PRODUCT_PAGE = 0;
    private static final int DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE = 24;
    private static final int MAX_PUBLIC_PRODUCT_PAGE_SIZE = 100;

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
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Boolean includeChildren,
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
        int safePage = validatePublicProductPage(page);
        int safeSize = validatePublicProductPageSize(size);
        ProductListQuery query = new ProductListQuery();
        query.setKeyword(resolveKeyword(keyword, q, search));
        query.setCategoryId(categoryId);
        query.setIncludeChildren(includeChildren);
        query.setDiscount(discount);
        query.setFeatured(featured);
        query.setMinPrice(minPrice == null ? priceMin : minPrice);
        query.setMaxPrice(maxPrice == null ? priceMax : maxPrice);
        query.setPetSizes(petSize);
        query.setMaterials(material);
        query.setColors(color);
        query.setCollection(collection);
        query.setStatus(status);
        query.setPage(safePage);
        query.setSize(safeSize);
        query.setSort(sort);
        Page<Product> result = productService.findPublicProductPage(query);
        return ResponseEntity.ok(ProductPublicPageResponse.of(
                toPublicListItems(result.getContent()),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize()));
    }

    private int validatePublicProductPage(Integer page) {
        if (page != null && page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be greater than or equal to 0");
        }
        return page == null ? DEFAULT_PUBLIC_PRODUCT_PAGE : page;
    }

    private int validatePublicProductPageSize(Integer size) {
        if (size != null && size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be greater than or equal to 1");
        }
        if (size != null && size > MAX_PUBLIC_PRODUCT_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be less than or equal to " + MAX_PUBLIC_PRODUCT_PAGE_SIZE);
        }
        return size == null ? DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE : size;
    }

    private String resolveKeyword(String keyword, String q, String search) {
        if (keyword != null && !keyword.isBlank()) {
            return keyword;
        }
        if (q != null && !q.isBlank()) {
            return q;
        }
        return search;
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

    private List<ProductPublicListItemResponse> toPublicListItems(List<Product> products) {
        return products == null ? List.of() : products.stream()
                .map(ProductPublicListItemResponse::from)
                .collect(Collectors.toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Product> createProduct(@Valid @RequestBody(required = false) Product product,
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
                                                 @Valid @RequestBody(required = false) Product product,
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
                        assertProductVersionCurrent(existingProduct, product);
                        Product savedProduct = productService.save(productService.mergeProduct(existingProduct, product));
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

    private void assertProductVersionCurrent(Product existingProduct, Product submittedProduct) {
        if (submittedProduct.getUpdatedAt() == null) {
            return;
        }
        if (!Objects.equals(existingProduct.getUpdatedAt(), submittedProduct.getUpdatedAt())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Product was updated by another admin. Refresh and try again.");
        }
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
