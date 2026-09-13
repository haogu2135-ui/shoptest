package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicListItemResponse;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.ArrayList;

@RestController
public class PageController {
    private static final int HOME_PRODUCT_PAGE_SIZE = 24;

    @Autowired
    private ProductService productService;

    @GetMapping("/home/products")
    public ResponseEntity<List<ProductPublicListItemResponse>> getHomeProducts() {
        ProductListQuery query = new ProductListQuery();
        query.setPage(0);
        query.setSize(HOME_PRODUCT_PAGE_SIZE);
        List<Product> products = productService.findPublicProducts(query);
        if (products.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<ProductPublicListItemResponse> responses = new ArrayList<>(products.size());
        for (com.example.shop.entity.Product product : products) {
            responses.add(ProductPublicListItemResponse.from(product));
        }
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/home/products/{id}")
    public ResponseEntity<ProductPublicResponse> getHomeProductById(@PathVariable Long id) {
        return productService.findPublicById(id)
                .map(ProductPublicResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
