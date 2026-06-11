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

class ProductRepositoryFindAllContractTest {
    @Test
    void productionCodeDoesNotCallNoArgProductRepositoryFindAll() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectNoArgProductFindAll(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Use a bounded Pageable query instead of productRepository.findAll():\n"
                + String.join("\n", offenders));
    }

    @Test
    void productServiceLegacyAllProductsPathUsesBoundedPageableQuery() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String legacyFindAll = methodBlock(source, "public List<Product> findAll()");

        assertTrue(legacyFindAll.contains("legacyProductListLimit(\"product.legacy-list-max-rows\", 500, HARD_LEGACY_PRODUCT_LIST_LIMIT)"));
        assertTrue(legacyFindAll.contains("productRepository"));
        assertTrue(legacyFindAll.contains(".findAll(PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, \"id\")))"));
        assertTrue(source.contains("HARD_LEGACY_PRODUCT_LIST_LIMIT = 500"));
        assertFalse(legacyFindAll.contains("productRepository.findAll()"));
    }

    private static void collectNoArgProductFindAll(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }

        int index = source.indexOf("productRepository.findAll()");
        while (index >= 0) {
            offenders.add(path + ":" + lineNumber(source, index));
            index = source.indexOf("productRepository.findAll()", index + 1);
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
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
