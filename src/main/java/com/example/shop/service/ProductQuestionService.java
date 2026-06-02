package com.example.shop.service;

import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.dto.ProductQuestionPublicResponse;
import com.example.shop.entity.ProductQuestion;

import java.util.List;

public interface ProductQuestionService {
    List<ProductQuestionPublicResponse> getPublicByProductId(Long productId);
    List<ProductQuestion> getAdminQueue(String status, int limit);
    List<ProductQuestion> getAdminQueue(String status, String search, int limit);
    ProductQuestionAdminSummaryResponse adminSummary();
    ProductQuestionAdminSummaryResponse adminSummary(String status, String search);
    ProductQuestion ask(Long productId, Long userId, String question);
    ProductQuestion answer(Long questionId, Long userId, String answer);
    ProductQuestion delete(Long questionId);
}
