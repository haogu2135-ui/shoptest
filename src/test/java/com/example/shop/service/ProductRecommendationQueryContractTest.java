package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class ProductRecommendationQueryContractTest {

    @Test
    void productionCodeDoesNotUseStaleRecommendationServiceOrRecommendProductsFullScan() throws IOException {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/RecommendationService.java")));

        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectNeedle(path, "recommendProducts", offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Use ProductService bounded recommendation paths instead of stale recommendProducts:\n"
                + String.join("\n", offenders));
    }

    @Test
    void personalizedRecommendationEndpointDelegatesToCurrentProductServicePath() throws IOException {
        String controller = read("src/main/java/com/example/shop/controller/ProductController.java");
        String endpoint = methodBlock(controller,
                "public ResponseEntity<List<ProductPublicResponse>> getPersonalizedRecommendations(Authentication authentication)");

        assertTrue(endpoint.contains("productService.findPersonalizedRecommendations(userDetails.getId())"));
        assertFalse(endpoint.contains("RecommendationService"));
        assertFalse(endpoint.contains("recommendProducts"));
    }

    @Test
    void personalizedRecommendationsUseBoundedSqlCandidateWindows() throws IOException, InterruptedException {
        String service = trackedSource("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");

        String personalized = methodBlock(service, "private List<Product> findPersonalizedRecommendationsUncached(Long userId)");
        assertTrue(personalized.contains("int candidateWindow = recommendationCandidateWindow(12, 160)"));
        assertTrue(personalized.contains("boundedRecommendationCandidates(personalizedCandidateTerms(pets), candidateWindow)"));
        assertFalse(personalized.contains("productRepository.findAll("));
        assertFalse(personalized.contains("productRepository.findByCategoryIdIn("));
        assertFalse(personalized.contains("productRepository.findByNameContainingIgnoreCase("));

        String candidates = methodBlock(service,
                "private List<Product> boundedRecommendationCandidates(List<String> normalizedKeywords, int candidateWindow)");
        assertTrue(candidates.contains("productRepository.findPublicKeywordCandidateWindow("));
        assertTrue(candidates.contains("PageRequest.of(0, candidateWindow)"));
        assertTrue(candidates.contains("productRepository.findPublicSellableCandidateWindow(PageRequest.of(0, candidateWindow))"));
        assertTrue(candidates.contains(".limit(candidateWindow)"));
        assertFalse(candidates.contains("productRepository.findAll("));
        assertFalse(candidates.contains("findByCategoryIdIn("));
        assertFalse(candidates.contains("findByNameContainingIgnoreCase("));

        String window = methodBlock(service, "private int recommendationCandidateWindow(int responseLimit, int defaultWindow)");
        assertTrue(window.contains("runtimeConfig.getInt(\"product.recommendation-candidate-window\", defaultWindow)"));
        assertTrue(window.contains("Math.min(Math.max(boundedWindow, minimumWindow), 300)"));
    }

    @Test
    void productRepositoryProvidesFilteredPageableRecommendationCandidates() throws IOException, InterruptedException {
        String repository = trackedSource("src/main/java/com/example/shop/repository/ProductRepository.java");

        String sellableQuery = queryMethodBlock(repository, "List<Product> findPublicSellableCandidateWindow(Pageable pageable);");
        assertTrue(sellableQuery.contains("@Query(\"select p from Product p where"));
        assertTrue(sellableQuery.contains("upper(p.status) = 'ACTIVE'"));
        assertTrue(sellableQuery.contains("p.name is not null"));
        assertTrue(sellableQuery.contains("p.price is not null"));
        assertTrue(sellableQuery.contains("p.categoryId is not null"));
        assertTrue(sellableQuery.contains("(p.stock is null or p.stock > 0)"));
        assertTrue(sellableQuery.contains("Pageable pageable"));

        String keywordQuery = queryMethodBlock(repository,
                "List<Product> findPublicKeywordCandidateWindow(@Param(\"keyword\") String keyword, Pageable pageable);");
        assertTrue(keywordQuery.contains("lower(coalesce(p.name, '')) like"));
        assertTrue(keywordQuery.contains("lower(coalesce(p.description, '')) like"));
        assertTrue(keywordQuery.contains("lower(coalesce(p.brand, '')) like"));
        assertTrue(keywordQuery.contains("lower(coalesce(p.tag, '')) like"));
        assertTrue(keywordQuery.contains("Pageable pageable"));
    }

    private static void collectNeedle(Path path, String needle, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }
        int index = source.indexOf(needle);
        while (index >= 0) {
            offenders.add(path + ":" + lineNumber(source, index) + ": " + needle);
            index = source.indexOf(needle, index + needle.length());
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String trackedSource(String path) throws IOException, InterruptedException {
        return runGit("show", ":" + path);
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

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }

    private static String queryMethodBlock(String source, String signature) {
        int method = source.indexOf(signature);
        assertTrue(method >= 0, "Missing repository method: " + signature);
        int previousQuery = source.lastIndexOf("@Query", method);
        assertTrue(previousQuery >= 0, "Missing query annotation for: " + signature);
        return source.substring(previousQuery, method + signature.length());
    }

    private static int lineNumber(String source, int offset) {
        int line = 1;
        for (int index = 0; index < offset && index < source.length(); index++) {
            if (source.charAt(index) == '\n') {
                line++;
            }
        }
        return line;
    }
}
