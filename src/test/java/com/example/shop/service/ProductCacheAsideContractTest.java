package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductCacheAsideContractTest {
    @Test
    void productWritePathsInvalidateProductAndCategoryCaches() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");

        String save = methodBlock(source, "public Product save(Product product)");
        assertTrue(save.contains("Product saved = productRepository.save(product);"));
        assertTrue(save.contains("invalidateProductSearchCacheForProduct(saved);"));
        assertTrue(save.contains("evictCategoryReferenceCache();"));

        String updateStatus = methodBlock(source, "public int updateStatusByIds(List<Long> ids, String status)");
        assertTrue(updateStatus.contains("productRepository.updateStatusByIdIn(normalizedIds, normalizedStatus)"));
        assertTrue(updateStatus.contains("clearProductSearchCache();"));
        assertTrue(updateStatus.contains("evictCategoryReferenceCache();"));

        String delete = methodBlock(source, "public void deleteById(Long id)");
        assertTrue(delete.contains("productRepository.deleteById(id);"));
        assertTrue(delete.contains("invalidateProductSearchCacheForProductId(id);"));
        assertTrue(delete.contains("evictCategoryReferenceCache();"));

        String csvImport = methodBlock(source, "private ProductImportResult processCsvImport(MultipartFile file, boolean preview)");
        assertTrue(csvImport.contains("!preview && result.isReadyToImport()"));
        assertTrue(csvImport.contains(".map(this::saveImportRow)"));
        assertTrue(csvImport.contains(".forEach(this::invalidateProductSearchCacheForProduct);"));
        assertTrue(csvImport.contains("evictCategoryReferenceCache();"));
    }

    @Test
    void productCacheInvalidationRemovesAffectedEntriesOnly() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");

        String invalidate = methodBlock(source, "private void invalidateProductSearchCache(Long productId,");
        assertTrue(invalidate.contains("productSearchCache.entrySet().removeIf"));
        assertTrue(invalidate.contains("shouldInvalidateProductSearchCacheEntry("));

        String shouldInvalidate = methodBlock(source,
                "private boolean shouldInvalidateProductSearchCacheEntry(String cacheKey,");
        assertTrue(shouldInvalidate.contains("entry.containsProductId(productId)"));
        assertTrue(shouldInvalidate.contains("cacheKey.startsWith(\"related:\" + productId + \":\")"));
        assertTrue(shouldInvalidate.contains("cacheKey.startsWith(\"featured:\")"));
        assertTrue(shouldInvalidate.contains("cacheKey.startsWith(\"discount:\")"));
        assertTrue(shouldInvalidate.contains("cacheKey.contains(\":discount=true\")"));
        assertTrue(shouldInvalidate.contains("cacheKey.startsWith(\"add-on:\")"));
    }

    @Test
    void categoryWritePathsEvictReferenceDataCache() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/CategoryServiceImpl.java");

        assertTrue(source.contains("@Cacheable(cacheNames = \"categoryReferenceData\""));
        assertTrue(source.contains("@CacheEvict(cacheNames = \"categoryReferenceData\", allEntries = true)\n"
                + "    public Category save(Category category)"));
        assertTrue(source.contains("@CacheEvict(cacheNames = \"categoryReferenceData\", allEntries = true)\n"
                + "    public void deleteById(Long id)"));
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
}
