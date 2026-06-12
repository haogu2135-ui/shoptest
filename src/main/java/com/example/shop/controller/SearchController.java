package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicPageResponse;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class SearchController {
    private static final int DEFAULT_SEARCH_PAGE = 0;
    private static final int DEFAULT_SEARCH_PAGE_SIZE = 24;

    private final ProductService productService;

    @GetMapping("/search")
    public ResponseEntity<ProductPublicPageResponse> searchProducts(
            @RequestParam(required = false, name = "q") String q,
            @RequestParam(required = false) String keyword,
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
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        ProductListQuery query = new ProductListQuery();
        query.setKeyword(keyword != null && !keyword.isBlank() ? keyword : q);
        query.setCategoryId(categoryId);
        query.setDiscount(discount);
        query.setFeatured(featured);
        query.setMinPrice(minPrice == null ? priceMin : minPrice);
        query.setMaxPrice(maxPrice == null ? priceMax : maxPrice);
        query.setPetSizes(petSize);
        query.setMaterials(material);
        query.setColors(color);
        query.setPage(page == null ? DEFAULT_SEARCH_PAGE : page);
        query.setSize(size == null ? DEFAULT_SEARCH_PAGE_SIZE : size);
        query.setSort(sort);
        Page<Product> result = productService.findPublicProductPage(query);
        return ResponseEntity.ok(ProductPublicPageResponse.of(
                toPublicProducts(result.getContent()),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize()));
    }

    private List<ProductPublicResponse> toPublicProducts(List<Product> products) {
        return products == null ? List.of() : products.stream()
                .map(ProductPublicResponse::from)
                .collect(Collectors.toList());
    }
}
