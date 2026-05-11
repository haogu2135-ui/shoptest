package com.example.shop.service.impl;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Product;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.service.ProductService;
import com.example.shop.util.CsvUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Override
    public List<Product> findAll() {
        return enrichReviewStats(productRepository.findAll());
    }

    @Override
    public Optional<Product> findById(Long id) {
        return productRepository.findById(id).map(this::enrichReviewStats);
    }

    @Override
    @Transactional
    public Product save(Product product) {
        return productRepository.save(product);
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        productRepository.deleteById(id);
    }

    @Override
    public List<Product> findByIsFeaturedTrueOrderByIdAsc() {
        return enrichReviewStats(productRepository.findByIsFeaturedTrueOrderByIdAsc());
    }

    @Override
    public List<Product> search(String keyword, Long categoryId) {
        List<Long> categoryIds = categoryId == null ? null : collectCategoryIds(categoryId);
        if (categoryId != null && keyword != null && !keyword.isEmpty()) {
            return enrichReviewStats(productRepository.findByCategoryIdIn(categoryIds).stream()
                    .filter(p -> p.getName().toLowerCase().contains(keyword.toLowerCase()))
                    .collect(Collectors.toList()));
        }
        if (categoryId != null) {
            return enrichReviewStats(productRepository.findByCategoryIdIn(categoryIds));
        }
        if (keyword != null && !keyword.isEmpty()) {
            return enrichReviewStats(productRepository.findByNameContainingIgnoreCase(keyword));
        }
        return enrichReviewStats(productRepository.findAll());
    }

    public List<Product> findRelatedProducts(Long productId, Long categoryId) {
        return enrichReviewStats(productRepository.findByCategoryId(categoryId).stream()
                .filter(p -> !p.getId().equals(productId))
                .limit(8)
                .collect(Collectors.toList()));
    }

    @Override
    @Transactional
    public ProductImportResult importCsv(MultipartFile file) {
        ProductImportResult result = new ProductImportResult();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int rowNumber = 0;
            while ((line = reader.readLine()) != null) {
                rowNumber++;
                if (rowNumber == 1) {
                    line = line.replace("\uFEFF", "");
                }
                if (rowNumber == 1 && line.toLowerCase().startsWith("id,")) {
                    continue;
                }
                if (line.trim().isEmpty()) {
                    continue;
                }

                result.setTotalRows(result.getTotalRows() + 1);
                try {
                    Product product = toProduct(CsvUtils.parseLine(line));
                    if (product.getId() != null) {
                        Optional<Product> existing = productRepository.findById(product.getId());
                        if (existing.isPresent()) {
                            mergeForImport(existing.get(), product);
                            productRepository.save(existing.get());
                            result.setUpdated(result.getUpdated() + 1);
                            continue;
                        }
                    }
                    product.setId(null);
                    productRepository.save(product);
                    result.setCreated(result.getCreated() + 1);
                } catch (Exception ex) {
                    result.addError(rowNumber, ex.getMessage());
                }
            }
        } catch (Exception ex) {
            result.addError(0, "Failed to read CSV: " + ex.getMessage());
        }
        return result;
    }

    private Product toProduct(List<String> values) {
        if (values.size() < 6) {
            throw new IllegalArgumentException("Expected at least 6 columns: id,name,description,price,stock,categoryId");
        }

        Product product = new Product();
        product.setId(parseLong(value(values, 0), false, "id"));
        product.setName(required(value(values, 1), "name"));
        product.setDescription(value(values, 2));
        product.setPrice(parseDecimal(value(values, 3), true, "price"));
        product.setStock(parseInteger(value(values, 4), true, "stock"));
        product.setCategoryId(parseLong(value(values, 5), true, "categoryId"));
        product.setImageUrl(value(values, 6));
        product.setIsFeatured(parseBoolean(value(values, 7)));
        product.setBrand(value(values, 8));
        product.setOriginalPrice(parseDecimal(value(values, 9), false, "originalPrice"));
        product.setDiscount(parseInteger(value(values, 10), false, "discount"));
        product.setLimitedTimePrice(parseDecimal(value(values, 11), false, "limitedTimePrice"));
        product.setLimitedTimeStartAt(parseDateTime(value(values, 12), "limitedTimeStartAt"));
        product.setLimitedTimeEndAt(parseDateTime(value(values, 13), "limitedTimeEndAt"));
        product.setTag(value(values, 14));
        boolean hasDetailContentColumn = values.size() > 20;
        String status = value(values, hasDetailContentColumn ? 20 : 19);
        product.setStatus(status == null || status.isEmpty() ? "ACTIVE" : status);
        product.setImages(value(values, 15));
        product.setSpecifications(value(values, 16));
        product.setDetailContent(hasDetailContentColumn ? value(values, 17) : null);
        product.setWarranty(value(values, hasDetailContentColumn ? 18 : 17));
        product.setShipping(value(values, hasDetailContentColumn ? 19 : 18));
        product.setFreeShipping(parseBoolean(value(values, hasDetailContentColumn ? 21 : 20)));
        product.setFreeShippingThreshold(parseDecimal(value(values, hasDetailContentColumn ? 22 : 21), false, "freeShippingThreshold"));
        product.setVariants(value(values, hasDetailContentColumn ? 23 : 22));
        return product;
    }

    private void mergeForImport(Product existing, Product imported) {
        existing.setName(imported.getName());
        existing.setDescription(imported.getDescription());
        existing.setPrice(imported.getPrice());
        existing.setStock(imported.getStock());
        existing.setCategoryId(imported.getCategoryId());
        existing.setImageUrl(imported.getImageUrl());
        existing.setIsFeatured(imported.getIsFeatured());
        existing.setBrand(imported.getBrand());
        existing.setOriginalPrice(imported.getOriginalPrice());
        existing.setDiscount(imported.getDiscount());
        existing.setLimitedTimePrice(imported.getLimitedTimePrice());
        existing.setLimitedTimeStartAt(imported.getLimitedTimeStartAt());
        existing.setLimitedTimeEndAt(imported.getLimitedTimeEndAt());
        existing.setTag(imported.getTag());
        existing.setStatus(imported.getStatus());
        existing.setImages(imported.getImages());
        existing.setSpecifications(imported.getSpecifications());
        existing.setDetailContent(imported.getDetailContent());
        existing.setVariants(imported.getVariants());
        existing.setWarranty(imported.getWarranty());
        existing.setShipping(imported.getShipping());
        existing.setFreeShipping(imported.getFreeShipping());
        existing.setFreeShippingThreshold(imported.getFreeShippingThreshold());
    }

    private String value(List<String> values, int index) {
        return index < values.size() ? values.get(index).trim() : null;
    }

    private String required(String value, String field) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }

    private Long parseLong(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        return Long.parseLong(value);
    }

    private Integer parseInteger(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        return Integer.parseInt(value);
    }

    private BigDecimal parseDecimal(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        return new BigDecimal(value);
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        return "true".equalsIgnoreCase(value) || "1".equals(value) || "yes".equalsIgnoreCase(value);
    }

    private LocalDateTime parseDateTime(String value, String field) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            return LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        }
    }

    private List<Long> collectCategoryIds(Long id) {
        List<Long> ids = new java.util.ArrayList<>();
        collectCategoryIds(id, ids);
        return ids;
    }

    private void collectCategoryIds(Long id, List<Long> ids) {
        ids.add(id);
        categoryRepository.findByParentId(id).forEach(child -> collectCategoryIds(child.getId(), ids));
    }

    private List<Product> enrichReviewStats(List<Product> products) {
        products.forEach(this::enrichReviewStats);
        return products;
    }

    private Product enrichReviewStats(Product product) {
        if (product == null || product.getId() == null) {
            return product;
        }
        long reviewCount = reviewRepository.countByProduct_IdAndStatus(product.getId(), "APPROVED");
        long positiveCount = reviewRepository.countByProduct_IdAndStatusAndRatingGreaterThanEqual(product.getId(), "APPROVED", 4);
        double positiveRate = reviewCount == 0 ? 0 : positiveCount * 100.0 / reviewCount;
        product.setReviewCount(reviewCount);
        product.setPositiveRate(Math.round(positiveRate * 10.0) / 10.0);
        product.setAverageRating(reviewRepository.findAverageRatingByProductId(product.getId()));
        return product;
    }
} 
