package com.example.shop.controller;

import com.example.shop.dto.ProductQuestionPublicResponse;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.ProductQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/product-questions")
@RequiredArgsConstructor
public class ProductQuestionController {
    private final ProductQuestionService questionService;

    @GetMapping("/product/{productId}")
    public ResponseEntity<?> getQuestions(@PathVariable Long productId) {
        return ResponseEntity.ok(questionService.getPublicByProductId(productId));
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<?> askQuestion(
            @PathVariable Long productId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {
        try {
            ProductQuestion question = questionService.ask(
                    productId,
                    SecurityUtils.requireUser(authentication).getId(),
                    body == null ? null : body.get("question"));
            return ResponseEntity.ok(ProductQuestionPublicResponse.from(question, productId));
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        }
    }
}
