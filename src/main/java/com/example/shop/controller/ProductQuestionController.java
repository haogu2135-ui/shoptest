package com.example.shop.controller;

import com.example.shop.security.UserDetailsImpl;
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
        return ResponseEntity.ok(questionService.getByProductId(productId));
    }

    @PostMapping("/product/{productId}")
    public ResponseEntity<?> askQuestion(
            @PathVariable Long productId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        try {
            UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
            return ResponseEntity.ok(questionService.ask(productId, userDetails.getId(), body.get("question")));
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        }
    }

    @PostMapping("/{questionId}/answer")
    public ResponseEntity<?> answerQuestion(
            @PathVariable Long questionId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        try {
            UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
            SecurityUtils.assertAdmin(authentication);
            return ResponseEntity.ok(questionService.answer(questionId, userDetails.getId(), body.get("answer")));
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        }
    }
}
