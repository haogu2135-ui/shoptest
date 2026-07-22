package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SitemapControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/SitemapController.java");
    private static final Path SECURITY = Path.of("src/main/java/com/example/shop/config/SecurityConfig.java");

    @Test
    void sitemapExposesPublicMarketingAndProductDetailUrls() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);
        String security = Files.readString(SECURITY, StandardCharsets.UTF_8);

        assertTrue(source.contains("/sitemap.xml"));
        assertTrue(source.contains("RequestMethod.GET") || source.contains("@GetMapping"));
        assertTrue(source.contains("RequestMethod.HEAD"));
        assertTrue(source.contains("MediaType.APPLICATION_XML_VALUE"));
        assertTrue(source.contains("productService.findPublicProductPage"));
        assertTrue(source.contains("/products/\""));
        assertTrue(source.contains("\"/privacy\""));
        assertTrue(source.contains("\"/terms\""));
        assertTrue(source.contains("MAX_PRODUCT_URLS"));
        assertTrue(security.contains("\"/sitemap.xml\""));
        assertTrue(security.contains("HttpMethod.HEAD"));
        assertTrue(security.contains("permitAll()"));
    }
}
