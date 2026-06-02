package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.dto.ProductPublicResponse;
import com.example.shop.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
public class PageController {

    @Autowired
    private ProductService productService;

    @GetMapping("/home/products")
    public ResponseEntity<List<ProductPublicResponse>> getHomeProducts() {
        ProductListQuery query = new ProductListQuery();
        query.setPage(0);
        query.setSize(24);
        return ResponseEntity.ok(productService.findPublicProducts(query).stream()
                .map(ProductPublicResponse::from)
                .collect(Collectors.toList()));
    }

    @GetMapping("/home/products/{id}")
    public ResponseEntity<ProductPublicResponse> getHomeProductById(@PathVariable Long id) {
        return productService.findPublicById(id)
                .map(ProductPublicResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
