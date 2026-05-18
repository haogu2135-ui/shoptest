package com.example.shop.service.impl;

import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import com.example.shop.repository.ProductQuestionRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.ProductQuestionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProductQuestionServiceImpl implements ProductQuestionService {
    private final ProductQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Value("${product-question.max-question-chars:500}")
    private int maxQuestionChars;

    @Value("${product-question.max-answer-chars:1000}")
    private int maxAnswerChars;

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
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null || (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus()))) {
            return List.of();
        }
        return questionRepository.findByProduct_IdOrderByCreatedAtDesc(productId);
    }

    @Override
    @Transactional
    public ProductQuestion ask(Long productId, Long userId, String questionText) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new IllegalStateException("Product is not available");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String normalizedQuestion = normalizeText(questionText, normalizedMaxQuestionChars(), "Question");
        if (normalizedQuestion.isEmpty()) {
            throw new IllegalArgumentException("Question is required");
        }

        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion(normalizedQuestion);
        return questionRepository.save(question);
    }

    @Override
    @Transactional
    public ProductQuestion answer(Long questionId, Long userId, String answerText) {
        ProductQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));
        String normalizedAnswer = normalizeText(answerText, normalizedMaxAnswerChars(), "Answer");
        if (normalizedAnswer.isEmpty()) {
            throw new IllegalArgumentException("Answer is required");
        }

        question.setAnswer(normalizedAnswer);
        question.setAnsweredBy(userId);
        question.setAnsweredAt(LocalDateTime.now());
        return questionRepository.save(question);
    }

    private String normalizeText(String value, int maxChars, String label) {
        String normalized = String.valueOf(value == null ? "" : value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException(label + " is too long");
        }
        return normalized;
    }

    private int normalizedMaxQuestionChars() {
        return Math.max(20, maxQuestionChars);
    }

    private int normalizedMaxAnswerChars() {
        return Math.max(20, maxAnswerChars);
    }
}
