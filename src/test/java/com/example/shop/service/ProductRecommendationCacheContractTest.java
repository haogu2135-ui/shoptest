package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

class ProductRecommendationCacheContractTest {

    @Test
    void productRecommendationsDoNotUseUnboundedDedicatedCaches() throws Exception {
        String source = productServiceSource();

        assertFalse(source.contains("productRecommendationsCache"));
        assertFalse(source.contains("categoryRecommendationsCache"));
        assertFalse(source.contains("new ConcurrentHashMap<Long, List<Product>>()"));
        assertFalse(source.contains("new ConcurrentHashMap<Long, List<Product>>();"));
        assertFalse(source.contains("new ConcurrentHashMap<String, List<Product>>()"));
        assertFalse(source.contains("new ConcurrentHashMap<String, List<Product>>();"));
    }

    @Test
    void recommendationCandidatesAndSharedResultCacheRemainBounded() throws Exception {
        String source = productServiceSource();

        assertTrue(source.contains("boundedRecommendationCandidates(personalizedCandidateTerms(pets), candidateWindow)"));
        assertTrue(source.contains("productRepository.findPublicKeywordCandidateWindow(escapeLikeTerm(term), PageRequest.of(0, candidateWindow))")
                || source.contains("productRepository.findPublicKeywordCandidateWindow(term, PageRequest.of(0, candidateWindow))"));
        assertTrue(source.contains("productRepository.findPublicSellableCandidateWindow(PageRequest.of(0, candidateWindow))"));
        assertTrue(source.contains("runtimeConfig.getInt(\"product.recommendation-candidate-window\", defaultWindow)"));
        assertTrue(source.contains("runtimeConfig.getLong(\"product.search-cache-ttl-ms\", 30000)"));
        assertTrue(source.contains("runtimeConfig.getInt(\"product.search-cache-max-entries\", 80)"));
        assertTrue(source.contains("productSearchCache.size() >= Math.max(1, runtimeConfig.getInt(\"product.search-cache-max-entries\", 80))"));
    }

    private static String productServiceSource() throws IOException, InterruptedException {
        return runGit("show", ":src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
    }

    private static String runGit(String... args) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException("git command failed: " + String.join(" ", command) + "\n" + output);
        }
        return output;
    }
}
