package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductCategoryTreeDepthContractTest {

    @Test
    void categoryTreeCollectionHasHardDepthGuard() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("private static final int MAX_CATEGORY_TREE_DEPTH = 10;"),
                "ProductServiceImpl should define a hard category tree depth limit");
        assertTrue(source.contains("import java.util.LinkedHashSet;"),
                "Category collection should preserve order while tracking visited category ids");
        assertTrue(source.contains("import java.util.Set;"),
                "Recursive category collection should accept a visited/output set");

        String listCollector = sliceBetween(
                source,
                "private List<Long> collectCategoryIds(Long id)",
                "\n    private int scoreForPets");
        assertTrue(listCollector.contains("LinkedHashSet<Long> ids = new LinkedHashSet<>();"),
                "Category collection should track visited ids in insertion order");
        assertTrue(listCollector.contains("collectCategoryIds(id, ids, 1);"),
                "Category collection should start recursion at level 1");
        assertTrue(listCollector.contains("return new ArrayList<>(ids);"),
                "Category collection should return a list view of the de-duplicated traversal");
        assertFalse(listCollector.contains("collectCategoryIds(id, ids);"),
                "The public collector should not call an unbounded recursive overload");

        String recursiveCollector = sliceBetween(
                source,
                "private void collectCategoryIds(Long id, Set<Long> ids, int depth)",
                "\n    private boolean matchesNormalizedKeyword");
        assertTrue(recursiveCollector.contains("if (id == null || depth > MAX_CATEGORY_TREE_DEPTH || !ids.add(id))"),
                "Recursive category collection should stop for null ids, excessive depth, or previously visited ids");
        assertTrue(recursiveCollector.contains("if (depth == MAX_CATEGORY_TREE_DEPTH)"),
                "Recursive category collection should stop querying children at the max depth");
        assertTrue(recursiveCollector.contains("categoryRepository.findByParentId(id).forEach(child -> collectCategoryIds(child.getId(), ids, depth + 1));"),
                "Recursive category collection should increment depth for child traversal");
        assertFalse(recursiveCollector.contains("ids.add(id);"),
                "Recursive category collection should add ids only through the visited guard");
        assertFalse(recursiveCollector.contains("collectCategoryIds(child.getId(), ids));"),
                "Recursive category collection should not use the old unbounded child traversal");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
