package com.example.shop.service;

import com.example.shop.entity.ProductQuestion;

import java.util.List;

public interface ProductQuestionService {
    List<ProductQuestion> getByProductId(Long productId);
    ProductQuestion ask(Long productId, Long userId, String question);
    ProductQuestion answer(Long questionId, Long userId, String answer);
}
