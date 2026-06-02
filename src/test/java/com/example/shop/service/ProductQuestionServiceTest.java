package com.example.shop.service;

import com.example.shop.dto.ProductQuestionAdminSummaryResponse;
import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import com.example.shop.repository.ProductQuestionRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.impl.ProductQuestionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductQuestionServiceTest {
    private ProductQuestionRepository questionRepository;
    private RuntimeConfigService runtimeConfig;
    private ProductQuestionServiceImpl service;

    @BeforeEach
    void setUp() {
        questionRepository = mock(ProductQuestionRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("product-question.max-question-chars", 500)).thenReturn(80);
        when(runtimeConfig.getInt("product-question.max-answer-chars", 1000)).thenReturn(120);
        when(runtimeConfig.getInt("product-question.admin.max-rows", 200)).thenReturn(50);
        when(runtimeConfig.getInt("product-question.admin.stale-hours", 24)).thenReturn(2);
        when(runtimeConfig.getBoolean("product-question.rate-limit-enabled", true)).thenReturn(false);
        service = new ProductQuestionServiceImpl(questionRepository, productRepository, userRepository, runtimeConfig);

        Product product = new Product();
        product.setId(7L);
        product.setStatus("ACTIVE");
        User user = new User();
        user.setId(3L);
        user.setUsername("buyer");
        when(productRepository.findById(7L)).thenReturn(Optional.of(product));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(questionRepository.save(any(ProductQuestion.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void normalizesQuestionBeforeSaving() {
        ProductQuestion saved = service.ask(7L, 3L, "  Is\tthis\nsafe\u0000 for puppies?  ");

        assertEquals("Is this safe for puppies?", saved.getQuestion());
        verify(questionRepository).save(any(ProductQuestion.class));
    }

    @Test
    void rejectsOverlongQuestionBeforeSaving() {
        assertThrows(IllegalArgumentException.class, () -> service.ask(7L, 3L, "x".repeat(81)));
    }

    @Test
    void rateLimitsQuestionsBeforeSaving() {
        when(runtimeConfig.getBoolean("product-question.rate-limit-enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("product-question.max-asks-per-minute", 5)).thenReturn(2);

        service.ask(7L, 3L, "Is it good for kittens?");
        service.ask(7L, 3L, "Is it machine washable?");

        assertThrows(IllegalStateException.class, () -> service.ask(7L, 3L, "Does it include a warranty?"));
        verify(questionRepository, never()).save(org.mockito.ArgumentMatchers.argThat(question ->
                question instanceof ProductQuestion && "Does it include a warranty?".equals(((ProductQuestion) question).getQuestion())));
    }

    @Test
    void normalizesAnswerBeforeSaving() {
        ProductQuestion question = new ProductQuestion();
        question.setId(9L);
        when(questionRepository.findById(9L)).thenReturn(Optional.of(question));

        ProductQuestion saved = service.answer(9L, 99L, "  Ships\nwith\tcare instructions.  ");

        assertEquals("Ships with care instructions.", saved.getAnswer());
        assertEquals(99L, saved.getAnsweredBy());
    }

    @Test
    void rejectsOverlongAnswerBeforeSaving() {
        ProductQuestion question = new ProductQuestion();
        question.setId(9L);
        when(questionRepository.findById(9L)).thenReturn(Optional.of(question));

        assertThrows(IllegalArgumentException.class, () -> service.answer(9L, 99L, "x".repeat(121)));
    }

    @Test
    void adminQueueNormalizesStatusAndLimit() {
        when(questionRepository.findAdminQueue(eq(false), isNull(), any(Pageable.class))).thenReturn(List.of());

        service.getAdminQueue(" unanswered ", 999);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(questionRepository).findAdminQueue(eq(false), isNull(), captor.capture());
        assertEquals(50, captor.getValue().getPageSize());
    }

    @Test
    void adminSummaryCalculatesResponseScoreAndRuntimeLimits() {
        when(runtimeConfig.getInt("product-question.admin.stale-hours", 24)).thenReturn(0);
        when(runtimeConfig.getInt("product-question.admin.max-rows", 200)).thenReturn(5000);
        when(questionRepository.countAllQuestions()).thenReturn(12L);
        when(questionRepository.countUnansweredQuestions()).thenReturn(3L);
        when(questionRepository.countAnsweredQuestions()).thenReturn(9L);
        when(questionRepository.countStaleUnansweredQuestions(any(LocalDateTime.class))).thenReturn(2L);

        ProductQuestionAdminSummaryResponse summary = service.adminSummary();

        assertEquals(12L, summary.getTotalQuestions());
        assertEquals(3L, summary.getUnansweredQuestions());
        assertEquals(9L, summary.getAnsweredQuestions());
        assertEquals(2L, summary.getStaleUnansweredQuestions());
        assertEquals(1, summary.getStaleHours());
        assertEquals(1000, summary.getMaxAdminRows());
        assertEquals(40, summary.getResponseScore());
    }

    @Test
    void adminSummaryUsesActiveStatusAndSearchFilters() {
        when(questionRepository.countAdminQuestions(false, "puppy harness")).thenReturn(4L);
        when(questionRepository.countAdminUnansweredQuestions(false, "puppy harness")).thenReturn(4L);
        when(questionRepository.countAdminAnsweredQuestions(false, "puppy harness")).thenReturn(0L);
        when(questionRepository.countAdminStaleUnansweredQuestions(eq(false), eq("puppy harness"), any(LocalDateTime.class))).thenReturn(1L);

        ProductQuestionAdminSummaryResponse summary = service.adminSummary(" unanswered ", "  Puppy\tHarness  ");

        assertEquals(4L, summary.getTotalQuestions());
        assertEquals(4L, summary.getUnansweredQuestions());
        assertEquals(0L, summary.getAnsweredQuestions());
        assertEquals(1L, summary.getStaleUnansweredQuestions());
        verify(questionRepository).countAdminQuestions(false, "puppy harness");
        verify(questionRepository).countAdminUnansweredQuestions(false, "puppy harness");
        verify(questionRepository).countAdminAnsweredQuestions(false, "puppy harness");
        verify(questionRepository).countAdminStaleUnansweredQuestions(eq(false), eq("puppy harness"), any(LocalDateTime.class));
        verify(questionRepository, never()).countAllQuestions();
    }
}
