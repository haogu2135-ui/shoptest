package com.example.shop.service.impl;

import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.dto.ProductQuestionPublicResponse;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
public class ProductQuestionServiceImpl implements ProductQuestionService {
    private final ProductQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<Long, RateBucket> askRateBuckets = new ConcurrentHashMap<>();

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
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<ProductQuestionPublicResponse> getPublicByProductId(Long productId) {
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null || (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus()))) {
            return List.of();
        }
        int limit = Math.max(1, Math.min(runtimeConfig.getInt("product-question.public-max-rows", 20), 100));
        return questionRepository.findAnsweredByProductId(productId, PageRequest.of(0, limit)).stream()
                .map(question -> ProductQuestionPublicResponse.from(question, productId))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<ProductQuestion> getAdminQueue(String status, int limit) {
        return getAdminQueue(status, null, limit);
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<ProductQuestion> getAdminQueue(String status, String search, int limit) {
        return questionRepository.findAdminQueue(
                normalizedAnsweredFilter(status),
                normalizeSearch(search),
                PageRequest.of(0, normalizedAdminLimit(limit)));
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public ProductQuestionAdminSummaryResponse adminSummary() {
        return adminSummary(null, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public ProductQuestionAdminSummaryResponse adminSummary(String status, String search) {
        int staleHours = normalizedStaleHours();
        int maxAdminRows = normalizedMaxAdminRows();
        Boolean answeredFilter = normalizedAnsweredFilter(status);
        String normalizedSearch = normalizeSearch(search);
        ProductQuestionAdminSummaryResponse response = new ProductQuestionAdminSummaryResponse();
        if (answeredFilter == null && normalizedSearch == null) {
            response.setTotalQuestions(questionRepository.countAllQuestions());
            response.setUnansweredQuestions(questionRepository.countUnansweredQuestions());
            response.setAnsweredQuestions(questionRepository.countAnsweredQuestions());
            response.setStaleUnansweredQuestions(questionRepository.countStaleUnansweredQuestions(LocalDateTime.now().minusHours(staleHours)));
        } else {
            response.setTotalQuestions(questionRepository.countAdminQuestions(answeredFilter, normalizedSearch));
            response.setUnansweredQuestions(questionRepository.countAdminUnansweredQuestions(answeredFilter, normalizedSearch));
            response.setAnsweredQuestions(questionRepository.countAdminAnsweredQuestions(answeredFilter, normalizedSearch));
            response.setStaleUnansweredQuestions(questionRepository.countAdminStaleUnansweredQuestions(
                    answeredFilter, normalizedSearch, LocalDateTime.now().minusHours(staleHours)));
        }
        response.setStaleHours(staleHours);
        response.setMaxAdminRows(maxAdminRows);
        response.setResponseScore(calculateResponseScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
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
        consumeAskRate(userId);

        ProductQuestion question = new ProductQuestion();
        question.setProduct(product);
        question.setUser(user);
        question.setQuestion(normalizedQuestion);
        return questionRepository.save(question);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductQuestion delete(Long questionId) {
        ProductQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));
        questionRepository.delete(question);
        return question;
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

    private String normalizeSearch(String value) {
        String normalized = String.valueOf(value == null ? "" : value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() > 120 ? normalized.substring(0, 120).trim() : normalized;
    }

    private void consumeAskRate(Long userId) {
        if (!runtimeConfig.getBoolean("product-question.rate-limit-enabled", true)) {
            return;
        }
        int maxPerMinute = runtimeConfig.getInt("product-question.max-asks-per-minute", 5);
        if (maxPerMinute <= 0) {
            return;
        }
        long now = Instant.now().getEpochSecond();
        long windowStart = now - Math.floorMod(now, 60);
        RateBucket bucket = askRateBuckets.compute(userId, (ignored, current) -> {
            if (current == null || current.windowStart != windowStart) {
                return new RateBucket(windowStart, 1);
            }
            current.count++;
            return current;
        });
        if (bucket.count > maxPerMinute) {
            throw new IllegalStateException("Too many product questions. Please try again later.");
        }
        if (askRateBuckets.size() > runtimeConfig.getInt("product-question.max-rate-buckets", 5000)) {
            askRateBuckets.entrySet().removeIf(entry -> entry.getValue().windowStart < windowStart);
        }
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

    private static class RateBucket {
        private final long windowStart;
        private int count;

        private RateBucket(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
