package com.example.shop.service;

import com.example.shop.dto.ProductUrlImportPreview;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductUrlImportServiceTest {
    private final ProductUrlImportService service = new ProductUrlImportService();

    @Test
    void parsesJsonLdProductMetadata() {
        String html = "<html><head>"
                + "<script type=\"application/ld+json\">"
                + "{"
                + "\"@context\":\"https://schema.org\","
                + "\"@type\":\"Product\","
                + "\"name\":\"Reflective Dog Harness\","
                + "\"description\":\"Secure harness for night walks\","
                + "\"image\":[\"https://cdn.example.com/harness.jpg\",\"https://cdn.example.com/harness-side.jpg\"],"
                + "\"brand\":{\"@type\":\"Brand\",\"name\":\"PawCo\"},"
                + "\"offers\":{\"@type\":\"Offer\",\"price\":\"29.90\",\"highPrice\":\"39.90\",\"priceCurrency\":\"USD\"}"
                + "}"
                + "</script>"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/harness", html);

        assertEquals("Reflective Dog Harness", preview.getName());
        assertEquals("Secure harness for night walks", preview.getDescription());
        assertEquals(new BigDecimal("29.90"), preview.getPrice());
        assertEquals(new BigDecimal("39.90"), preview.getOriginalPrice());
        assertEquals("USD", preview.getCurrency());
        assertEquals("PawCo", preview.getBrand());
        assertEquals("https://cdn.example.com/harness.jpg", preview.getImageUrl());
        assertEquals(2, preview.getImages().size());
        assertEquals(100, preview.getConfidenceScore());
    }

    @Test
    void fallsBackToOpenGraphMetadata() {
        String html = "<html><head>"
                + "<meta property=\"og:title\" content=\"Cat Window Perch &amp; Hammock\">"
                + "<meta name=\"description\" content=\"Soft perch for sunny windows\">"
                + "<meta property=\"og:image\" content=\"https://cdn.example.com/perch.jpg\">"
                + "<meta property=\"product:price:amount\" content=\"$18.50\">"
                + "<meta property=\"product:price:currency\" content=\"MXN\">"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/perch", html);

        assertEquals("Cat Window Perch & Hammock", preview.getName());
        assertEquals("Soft perch for sunny windows", preview.getDescription());
        assertEquals(new BigDecimal("18.50"), preview.getPrice());
        assertEquals("MXN", preview.getCurrency());
        assertEquals("https://cdn.example.com/perch.jpg", preview.getImageUrl());
    }

    @Test
    void resolvesRelativeImagesAndEuropeanPriceText() {
        String html = "<html><head>"
                + "<meta property=\"og:title\" content=\"Travel Bowl\">"
                + "<meta property=\"og:image\" content=\"/assets/bowl.jpg\">"
                + "<meta itemprop=\"price\" content=\"1.299,95\">"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/bowl", html);

        assertEquals("Travel Bowl", preview.getName());
        assertEquals(new BigDecimal("1299.95"), preview.getPrice());
        assertEquals("https://shop.example.com/assets/bowl.jpg", preview.getImageUrl());
        assertEquals("missing_description", preview.getWarnings().get(0));
    }

    @Test
    void fallsBackToEmbeddedProductDataWhenMetaIsMissing() {
        String html = "<html><body><script>"
                + "window.__DATA__={\"itemTitle\":\"Cooling Mat\",\"salePrice\":\"88.00\",\"picUrl\":\"https:\\/\\/cdn.example.com\\/mat.jpg\"};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://item.example.com/item/1", html);

        assertEquals("Cooling Mat", preview.getName());
        assertEquals(new BigDecimal("88.00"), preview.getPrice());
        assertEquals("https://cdn.example.com/mat.jpg", preview.getImageUrl());
    }

    @Test
    void rejectsLocalUrlsBeforeFetching() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.importFromUrl("http://127.0.0.1/admin/products"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void rejectsNonStandardWebPortsBeforeFetching() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.importFromUrl("https://example.com:8443/products/1"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }
}
