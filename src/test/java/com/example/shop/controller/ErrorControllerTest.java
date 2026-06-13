package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ErrorControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/ErrorController.java");

    @Test
    void errorControllerKeepsUniformErrorFactoryResponses() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/error\")"));
        assertTrue(source.contains("@GetMapping(\"/403\")"));
        assertTrue(source.contains("errorResponses.buildResponse(HttpStatus.FORBIDDEN, \"Forbidden\", request)"));
        assertTrue(source.contains("@GetMapping(\"/404\")"));
        assertTrue(source.contains("errorResponses.buildResponse(HttpStatus.NOT_FOUND, \"Not Found\", request)"));
        assertTrue(source.contains("@GetMapping(\"/500\")"));
        assertTrue(source.contains("errorResponses.buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, \"Internal server error\", request)"));
    }
}
