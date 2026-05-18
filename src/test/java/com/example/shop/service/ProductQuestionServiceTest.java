package com.example.shop.service;

import com.example.shop.entity.Product;
import com.example.shop.entity.ProductQuestion;
import com.example.shop.entity.User;
import com.example.shop.repository.ProductQuestionRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.UserRepository;
import com.example.shop.service.impl.ProductQuestionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductQuestionServiceTest {
    private ProductQuestionRepository questionRepository;
    private ProductQuestionServiceImpl service;

    @BeforeEach
    void setUp() {
        questionRepository = mock(ProductQuestionRepository.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        service = new ProductQuestionServiceImpl(questionRepository, productRepository, userRepository);
        ReflectionTestUtils.setField(service, "maxQuestionChars", 80);
        ReflectionTestUtils.setField(service, "maxAnswerChars", 120);

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
}
