package com.example.shop.service.impl;

import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import com.example.shop.repository.ProductQuestionRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.ProductQuestionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProductQuestionServiceImpl implements ProductQuestionService {
    private final ProductQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ProductQuestionServiceImpl(
            ProductQuestionRepository questionRepository,
            ProductRepository productRepository,
            UserRepository userRepository) {
        this.questionRepository = questionRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductQuestion> getByProductId(Long productId) {
        return questionRepository.findByProduct_IdOrderByCreatedAtDesc(productId);
    }

    @Override
    @Transactional
    public ProductQuestion ask(Long productId, Long userId, String questionText) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (questionText == null || questionText.trim().isEmpty()) {
            throw new IllegalArgumentException("Question is required");
        }

        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion(questionText.trim());
        return questionRepository.save(question);
    }

    @Override
    @Transactional
    public ProductQuestion answer(Long questionId, Long userId, String answerText) {
        ProductQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));
        if (answerText == null || answerText.trim().isEmpty()) {
            throw new IllegalArgumentException("Answer is required");
        }

        question.setAnswer(answerText.trim());
        question.setAnsweredBy(userId);
        question.setAnsweredAt(LocalDateTime.now());
        return questionRepository.save(question);
    }
}
