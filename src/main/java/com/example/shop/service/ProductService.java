package com.example.shop.service;

import com.example.shop.entity.Product;
import org.springframework.web.multipart.MultipartFile;

import com.example.shop.dto.ProductImportResult;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

public interface ProductService {
    List<Product> findAll();
    Optional<Product> findById(Long id);
    Product save(Product product);
    void deleteById(Long id);
    List<Product> findByIsFeaturedTrueOrderByIdAsc();
    List<Product> search(String keyword, Long categoryId);
    List<Product> findRelatedProducts(Long productId, Long categoryId);
    List<Product> findPersonalizedRecommendations(Long userId);
    void clearPersonalizedRecommendationCache(Long userId);
    List<Product> findDiscountProducts();
    List<Product> findAddOnCandidates(BigDecimal targetAmount, List<Long> excludedProductIds, int limit);
    ProductImportResult importCsv(MultipartFile file);
} 
