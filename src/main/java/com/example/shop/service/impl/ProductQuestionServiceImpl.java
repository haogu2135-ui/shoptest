package com.example.shop.service.impl;

import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import com.example.shop.repository.ProductQuestionRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.ProductQuestionService;
import com.example.shop.service.RuntimeConfigService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class ProductQuestionServiceImpl implements ProductQuestionService {
    private final ProductQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final RuntimeConfigService runtimeConfig;

    public ProductQuestionServiceImpl(
            ProductQuestionRepository questionRepository,
            ProductRepository productRepository,
            UserRepository userRepository,
            RuntimeConfigService runtimeConfig) {
        this.questionRepository = questionRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.runtimeConfig = runtimeConfig;
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
    @Transactional(readOnly = true)
    public List<ProductQuestion> getAdminQueue(String status, int limit) {
        return questionRepository.findAdminQueue(normalizedAnsweredFilter(status), PageRequest.of(0, normalizedAdminLimit(limit)));
    }

    @Override
    @Transactional(readOnly = true)
    public ProductQuestionAdminSummaryResponse adminSummary() {
        int staleHours = normalizedStaleHours();
        int maxAdminRows = normalizedMaxAdminRows();
        ProductQuestionAdminSummaryResponse response = new ProductQuestionAdminSummaryResponse();
        response.setTotalQuestions(questionRepository.countAllQuestions());
        response.setUnansweredQuestions(questionRepository.countUnansweredQuestions());
        response.setAnsweredQuestions(questionRepository.countAnsweredQuestions());
        response.setStaleUnansweredQuestions(questionRepository.countStaleUnansweredQuestions(LocalDateTime.now().minusHours(staleHours)));
        response.setStaleHours(staleHours);
        response.setMaxAdminRows(maxAdminRows);
        response.setResponseScore(calculateResponseScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
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
        return Math.max(20, runtimeConfig.getInt("product-question.max-question-chars", 500));
    }

    private int normalizedMaxAnswerChars() {
        return Math.max(20, runtimeConfig.getInt("product-question.max-answer-chars", 1000));
    }

    private Boolean normalizedAnsweredFilter(String status) {
        String normalized = String.valueOf(status == null ? "" : status).trim().toUpperCase(Locale.ROOT);
        if ("ANSWERED".equals(normalized)) {
            return true;
        }
        if ("UNANSWERED".equals(normalized)) {
            return false;
        }
        return null;
    }

    private int normalizedAdminLimit(int limit) {
        int configuredMax = normalizedMaxAdminRows();
        int requested = limit > 0 ? limit : configuredMax;
        return Math.max(1, Math.min(requested, configuredMax));
    }

    private int normalizedMaxAdminRows() {
        return Math.max(20, Math.min(runtimeConfig.getInt("product-question.admin.max-rows", 200), 1000));
    }

    private int normalizedStaleHours() {
        return Math.max(1, Math.min(runtimeConfig.getInt("product-question.admin.stale-hours", 24), 24 * 30));
    }

    private int calculateResponseScore(ProductQuestionAdminSummaryResponse summary) {
        long rawScore = 100
                - summary.getUnansweredQuestions() * 8
                - summary.getStaleUnansweredQuestions() * 18;
        return (int) Math.max(0, Math.min(100, rawScore));
    }
}
