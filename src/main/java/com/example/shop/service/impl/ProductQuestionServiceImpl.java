package com.example.shop.service.impl;

import lombok.extern.slf4j.Slf4j;

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
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ProductQuestionServiceImpl implements ProductQuestionService {
    private static final int MAX_PUBLIC_ROWS = 100;
    private static final int MAX_SEARCH_CHARS = 120;
    private static final int RATE_WINDOW_SECONDS = 60;
    private static final int MIN_CONFIGURED_ADMIN_ROWS = 20;
    private static final int MAX_CONFIGURED_ADMIN_ROWS = 1000;
    private static final int MAX_STALE_HOURS = 24 * 30;
    private static final Pattern CONTROL_TEXT_PATTERN = Pattern.compile("[\\p{Cntrl}&&[^\\r\\n\\t]]");
    private static final Pattern WHITESPACE_TEXT_PATTERN = Pattern.compile("\\s+");

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
        int limit = Math.max(1, Math.min(runtimeConfig.getInt("product-question.public-max-rows", 20), MAX_PUBLIC_ROWS));
        List<ProductQuestion> questions = questionRepository.findAnsweredByProductId(productId, PageRequest.of(0, limit));
        List<ProductQuestionPublicResponse> responses = new ArrayList<>(questions.size());
        for (ProductQuestion question : questions) {
            responses.add(ProductQuestionPublicResponse.from(question, productId));
        }
        return responses;
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
        LocalDateTime checkedAt = LocalDateTime.now();
        ProductQuestionAdminSummaryResponse response = new ProductQuestionAdminSummaryResponse();
        List<Object[]> metricRows = questionRepository.summarizeAdminQuestionMetrics(
                answeredFilter, normalizedSearch, checkedAt.minusHours(staleHours));
        Object[] metrics = metricRows == null || metricRows.isEmpty() ? null : metricRows.get(0);
        response.setTotalQuestions(metricValue(metrics, 0));
        response.setUnansweredQuestions(metricValue(metrics, 1));
        response.setAnsweredQuestions(metricValue(metrics, 2));
        response.setStaleUnansweredQuestions(metricValue(metrics, 3));
        response.setStaleHours(staleHours);
        response.setMaxAdminRows(maxAdminRows);
        response.setResponseScore(calculateResponseScore(response));
        response.setCheckedAt(checkedAt.atZone(ZoneId.systemDefault()).toInstant().toString());
        return response;
    }

    private long metricValue(Object[] metrics, int index) {
        if (metrics == null || index < 0 || index >= metrics.length || !(metrics[index] instanceof Number)) {
            return 0L;
        }
        return ((Number) metrics[index]).longValue();
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
        LocalDateTime answeredAt = LocalDateTime.now();
        question.setAnsweredAt(answeredAt);
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
        String normalized = normalizeWhitespace(value);
        if (normalized.length() > maxChars) {
            throw new IllegalArgumentException(label + " is too long");
        }
        return normalized;
    }

    private String normalizeSearch(String value) {
        String normalized = normalizeWhitespace(value).toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        String bounded = normalized.length() > MAX_SEARCH_CHARS
                ? normalized.substring(0, MAX_SEARCH_CHARS).trim()
                : normalized;
        return escapeLikeLiteral(bounded);
    }

    private String normalizeWhitespace(String value) {
        String source = value == null ? "" : value;
        return WHITESPACE_TEXT_PATTERN.matcher(CONTROL_TEXT_PATTERN.matcher(source).replaceAll(" "))
                .replaceAll(" ")
                .trim();
    }

    private String escapeLikeLiteral(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character == '!' || character == '%' || character == '_') {
                escaped.append('!');
            }
            escaped.append(character);
        }
        return escaped.toString();
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
        long windowStart = now - Math.floorMod(now, RATE_WINDOW_SECONDS);
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
        int maxBuckets = Math.max(1, runtimeConfig.getInt("product-question.max-rate-buckets", 5000));
        if (askRateBuckets.size() > maxBuckets) {
            Iterator<java.util.Map.Entry<Long, RateBucket>> iterator = askRateBuckets.entrySet().iterator();
            while (iterator.hasNext()) {
                if (iterator.next().getValue().windowStart < windowStart) {
                    iterator.remove();
                }
            }
        }
    }

    private int normalizedMaxQuestionChars() {
        return Math.max(20, runtimeConfig.getInt("product-question.max-question-chars", 500));
    }

    private int normalizedMaxAnswerChars() {
        return Math.max(20, runtimeConfig.getInt("product-question.max-answer-chars", 1000));
    }

    private Boolean normalizedAnsweredFilter(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
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
        return Math.max(MIN_CONFIGURED_ADMIN_ROWS,
                Math.min(runtimeConfig.getInt("product-question.admin.max-rows", 200), MAX_CONFIGURED_ADMIN_ROWS));
    }

    private int normalizedStaleHours() {
        return Math.max(1, Math.min(runtimeConfig.getInt("product-question.admin.stale-hours", 24), MAX_STALE_HOURS));
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
