package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.service.ProductService;
import lombok.RequiredArgsConstructor;
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
    private final ProductService productService;

    @GetMapping("/search")
    public ResponseEntity<List<ProductPublicResponse>> searchProducts(
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
        query.setPage(page);
        query.setSize(size);
        query.setSort(sort);
        return ResponseEntity.ok(productService.findPublicProducts(query).stream()
                .map(ProductPublicResponse::from)
                .collect(Collectors.toList()));
    }
}
