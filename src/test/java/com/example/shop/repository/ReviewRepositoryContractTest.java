package com.example.shop.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReviewRepositoryContractTest {
    @Test
    void legacyFindByProductIdFetchesSerializedAssociations() throws NoSuchMethodException {
        Method method = ReviewRepository.class.getMethod("findByProduct_Id", Long.class);
        Query query = method.getAnnotation(Query.class);

        assertNotNull(query);
        String normalized = query.value().replaceAll("\\s+", " ").toLowerCase();
        assertTrue(normalized.contains("join fetch r.product"));
        assertTrue(normalized.contains("join fetch r.user"));
        assertTrue(normalized.contains("where p.id = :productid"));
    }
}
