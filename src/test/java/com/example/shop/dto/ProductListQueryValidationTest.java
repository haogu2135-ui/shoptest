package com.example.shop.dto;

import org.junit.jupiter.api.Test;

import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductListQueryValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsInvalidPaginationAndFilterBounds() {
        ProductListQuery query = new ProductListQuery();
        query.setPage(-1);
        query.setSize(501);
        query.setMinPrice(new BigDecimal("-0.01"));
        query.setKeyword("x".repeat(121));

        Set<String> invalidFields = validator.validate(query).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());

        assertTrue(invalidFields.contains("page"));
        assertTrue(invalidFields.contains("size"));
        assertTrue(invalidFields.contains("minPrice"));
        assertTrue(invalidFields.contains("keyword"));
    }

    @Test
    void rejectsZeroPageSize() {
        ProductListQuery query = new ProductListQuery();
        query.setSize(0);

        Set<String> invalidFields = validator.validate(query).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());

        assertTrue(invalidFields.contains("size"));
    }
}
