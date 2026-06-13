package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicListItemResponse;
import com.example.shop.dto.ProductPublicPageResponse;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class SearchController {
    private static final int DEFAULT_SEARCH_PAGE = 0;
    private static final int DEFAULT_SEARCH_PAGE_SIZE = 24;
    private static final int MAX_SEARCH_PAGE_SIZE = 100;

    private final ProductService productService;

    @GetMapping("/search")
    public ResponseEntity<ProductPublicPageResponse> searchProducts(
            @RequestParam(required = false, name = "q") String q,
            @RequestParam(required = false) String keyword,
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
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        String resolvedKeyword = resolveKeyword(keyword, q);
        int safePage = validateSearchPage(page);
        int safeSize = validateSearchPageSize(size);
        validateExplicitBlankSearch(q, keyword, resolvedKeyword, categoryId, discount, featured,
                minPrice, priceMin, maxPrice, priceMax, petSize, material, color);

        ProductListQuery query = new ProductListQuery();
        query.setKeyword(resolvedKeyword);
        query.setCategoryId(categoryId);
        query.setIncludeChildren(includeChildren);
        query.setDiscount(discount);
        query.setFeatured(featured);
        query.setMinPrice(minPrice == null ? priceMin : minPrice);
        query.setMaxPrice(maxPrice == null ? priceMax : maxPrice);
        query.setPetSizes(petSize);
        query.setMaterials(material);
        query.setColors(color);
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

    private String resolveKeyword(String keyword, String q) {
        if (keyword != null && !keyword.isBlank()) {
            return keyword;
        }
        if (q != null && !q.isBlank()) {
            return q;
        }
        return null;
    }

    private int validateSearchPage(Integer page) {
        if (page != null && page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be greater than or equal to 0");
        }
        return page == null ? DEFAULT_SEARCH_PAGE : page;
    }

    private int validateSearchPageSize(Integer size) {
        if (size != null && size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be greater than or equal to 1");
        }
        if (size != null && size > MAX_SEARCH_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "size must be less than or equal to " + MAX_SEARCH_PAGE_SIZE);
        }
        return size == null ? DEFAULT_SEARCH_PAGE_SIZE : size;
    }

    private List<ProductPublicListItemResponse> toPublicListItems(List<Product> products) {
        return products == null ? List.of() : products.stream()
                .map(ProductPublicListItemResponse::from)
                .collect(Collectors.toList());
    }

    private void validateExplicitBlankSearch(String q,
                                             String keyword,
                                             String resolvedKeyword,
                                             Long categoryId,
                                             Boolean discount,
                                             Boolean featured,
                                             BigDecimal minPrice,
                                             BigDecimal priceMin,
                                             BigDecimal maxPrice,
                                             BigDecimal priceMax,
                                             List<String> petSize,
                                             List<String> material,
                                             List<String> color) {
        if (resolvedKeyword != null || (!isExplicitBlank(q) && !isExplicitBlank(keyword))) {
            return;
        }
        if (hasSearchFilter(categoryId, discount, featured, minPrice, priceMin, maxPrice, priceMax,
                petSize, material, color)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "search query is required");
    }

    private boolean hasSearchFilter(Long categoryId,
                                    Boolean discount,
                                    Boolean featured,
                                    BigDecimal minPrice,
                                    BigDecimal priceMin,
                                    BigDecimal maxPrice,
                                    BigDecimal priceMax,
                                    List<String> petSize,
                                    List<String> material,
                                    List<String> color) {
        return categoryId != null
                || Boolean.TRUE.equals(discount)
                || featured != null
                || minPrice != null
                || priceMin != null
                || maxPrice != null
                || priceMax != null
                || hasAnyValue(petSize)
                || hasAnyValue(material)
                || hasAnyValue(color);
    }

    private boolean isExplicitBlank(String value) {
        return value != null && value.isBlank();
    }

    private boolean hasAnyValue(List<String> values) {
        return values != null && values.stream().anyMatch(value -> value != null && !value.isBlank());
    }
}
