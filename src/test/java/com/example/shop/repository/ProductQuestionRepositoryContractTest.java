package com.example.shop.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductQuestionRepositoryContractTest {

    @Test
    void publicAnsweredQuestionQueryFetchesSerializedAssociations() throws NoSuchMethodException {
        Method method = ProductQuestionRepository.class.getMethod("findAnsweredByProductId", Long.class, Pageable.class);
        Query query = method.getAnnotation(Query.class);

        assertNotNull(query);
        String normalized = query.value().replaceAll("\\s+", " ").toLowerCase();
        assertTrue(normalized.contains("join fetch q.product"));
        assertTrue(normalized.contains("join fetch q.user"));
        assertTrue(normalized.contains("where p.id = :productid"));
    }
}
