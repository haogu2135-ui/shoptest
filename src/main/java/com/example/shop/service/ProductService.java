package com.example.shop.service;

import com.example.shop.entity.Product;
import com.example.shop.dto.ProductListQuery;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import com.example.shop.dto.ProductImportResult;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

public interface ProductService {
    List<Product> findAll();
    List<Product> findPublicProducts();
    List<Product> findPublicProducts(ProductListQuery query);
    Page<Product> findPublicProductPage(ProductListQuery query);
    List<Product> findAdminProducts(ProductListQuery query);
    Page<Product> findAdminProductPage(ProductListQuery query);
    Optional<Product> findById(Long id);
    Optional<Product> findPublicById(Long id);
    List<Product> findByIds(List<Long> ids);
    List<Product> findPublicByIds(List<Long> ids);
    Product save(Product product);
    void deleteById(Long id);
    List<Product> findByIsFeaturedTrueOrderByIdAsc();
    List<Product> findPublicFeaturedProducts();
    List<Product> findPublicFeaturedProducts(int limit);
    List<Product> search(String keyword, Long categoryId);
    List<Product> findFinderCandidates(List<String> keywords, int limit);
    List<Product> findRelatedProducts(Long productId, Long categoryId);
    List<Product> findPersonalizedRecommendations(Long userId);
    void clearPersonalizedRecommendationCache(Long userId);
    List<Product> findDiscountProducts();
    List<Product> findAddOnCandidates(BigDecimal targetAmount, List<Long> excludedProductIds, int limit);
    long countProducts();
    long countActiveProducts();
    long countPendingReviewProducts();
    long countLowStockProducts();
    List<Product> findLowStockProducts(int limit);
    ProductImportResult previewImportCsv(MultipartFile file);
    ProductImportResult importCsv(MultipartFile file);
} 
