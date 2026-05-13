package com.example.shop.controller;

import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class PageController {

    @Autowired
    private ProductService productService;

    @GetMapping("/home/products")
    public ResponseEntity<List<Product>> getHomeProducts() {
        return ResponseEntity.ok(productService.findAll());
    }

    @GetMapping("/home/products/{id}")
    public ResponseEntity<Product> getHomeProductById(@PathVariable Long id) {
        return productService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
} 
