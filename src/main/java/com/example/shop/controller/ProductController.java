package com.example.shop.controller;

import com.example.shop.entity.Product;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/products")
@CrossOrigin(originPatterns = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://10.*:*",
        "http://172.*:*",
        "http://192.168.*:*"
})
public class ProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId) {
        if (keyword != null || categoryId != null) {
            return ResponseEntity.ok(productService.search(keyword, categoryId));
        }
        return ResponseEntity.ok(productService.findAll());
    }

    @GetMapping("/featured")
    public ResponseEntity<List<Product>> getFeaturedProducts() {
        return ResponseEntity.ok(productService.findByIsFeaturedTrueOrderByIdAsc());
    }

    @GetMapping("/personalized-recommendations")
    public ResponseEntity<List<Product>> getPersonalizedRecommendations(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return ResponseEntity.ok(List.of());
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return ResponseEntity.ok(productService.findPersonalizedRecommendations(userDetails.getId()));
    }

    @GetMapping("/{id}/recommendations")
    public ResponseEntity<List<Product>> getRecommendations(@PathVariable Long id) {
        Product product = productService.findById(id).orElse(null);
        if (product == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(productService.findRelatedProducts(id, product.getCategoryId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        return productService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        return ResponseEntity.ok(productService.save(product));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        return productService.findById(id)
                .map(existingProduct -> {
                    mergeProduct(existingProduct, product);
                    return ResponseEntity.ok(productService.save(existingProduct));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private void mergeProduct(Product existingProduct, Product product) {
        if (product.getName() != null) existingProduct.setName(product.getName());
        if (product.getDescription() != null) existingProduct.setDescription(product.getDescription());
        if (product.getPrice() != null) existingProduct.setPrice(product.getPrice());
        if (product.getImageUrl() != null) existingProduct.setImageUrl(product.getImageUrl());
        if (product.getStock() != null) existingProduct.setStock(product.getStock());
        if (product.getCategoryId() != null) existingProduct.setCategoryId(product.getCategoryId());
        if (product.getIsFeatured() != null) existingProduct.setIsFeatured(product.getIsFeatured());
        existingProduct.setBrand(product.getBrand());
        existingProduct.setOriginalPrice(product.getOriginalPrice());
        existingProduct.setDiscount(product.getDiscount());
        existingProduct.setLimitedTimePrice(product.getLimitedTimePrice());
        existingProduct.setLimitedTimeStartAt(product.getLimitedTimeStartAt());
        existingProduct.setLimitedTimeEndAt(product.getLimitedTimeEndAt());
        existingProduct.setTag(product.getTag());
        if (product.getStatus() != null) existingProduct.setStatus(product.getStatus());
        existingProduct.setImages(product.getImages());
        existingProduct.setSpecifications(product.getSpecifications());
        existingProduct.setDetailContent(product.getDetailContent());
        existingProduct.setVariants(product.getVariants());
        existingProduct.setWarranty(product.getWarranty());
        existingProduct.setShipping(product.getShipping());
        existingProduct.setFreeShipping(product.getFreeShipping());
        existingProduct.setFreeShippingThreshold(product.getFreeShippingThreshold());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        return productService.findById(id)
                .map(product -> {
                    productService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
} 
