package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductMapperContractTest {

    @Test
    void productMapperDoesNotExposeUnboundedFindAll() throws Exception {
        assertThrows(NoSuchMethodException.class, () -> ProductMapper.class.getMethod("findAll"));

        String mapper = Files.readString(
                Paths.get("src/main/resources/mapper/ProductMapper.xml"),
                StandardCharsets.UTF_8);
        assertFalse(mapper.contains("id=\"findAll\""),
                "ProductMapper must not expose a no-arg full-catalog findAll statement");
    }
}
