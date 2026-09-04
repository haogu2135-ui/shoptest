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
                "Category collection should retain set-based category scopes");

        String listCollector = sliceBetween(
                source,
                "private List<Long> collectCategoryIds(Long id)",
                "\n    private int scoreForPets");
        assertTrue(listCollector.contains("LinkedHashSet<Long> ids = rootIds == null ? new LinkedHashSet<>() : rootIds.stream()"),
                "Category collection should track visited ids in insertion order");
        assertTrue(listCollector.contains("return id == null ? List.of() : collectCategoryIds(List.of(id));"),
                "Category collection should delegate single roots to the batched traversal");
        assertTrue(listCollector.contains("return new ArrayList<>(ids);"),
                "Category collection should return a list view of the de-duplicated traversal");
        assertFalse(listCollector.contains("collectCategoryIds(id, ids);"),
                "The public collector should not call an unbounded recursive overload");

        String batchedCollector = sliceBetween(
                source,
                "private List<Long> collectCategoryIds(List<Long> rootIds)",
                "\n    private boolean matchesNormalizedKeyword");
        assertTrue(batchedCollector.contains("LinkedHashSet<Long> frontier = new LinkedHashSet<>(ids);"),
                "Category collection should track each breadth-first frontier");
        assertTrue(batchedCollector.contains("for (int depth = 1; depth < MAX_CATEGORY_TREE_DEPTH && !frontier.isEmpty(); depth++)"),
                "Batched category collection should stop at the hard depth limit");
        assertTrue(batchedCollector.contains("categoryRepository.findByParentIdIn(new ArrayList<>(frontier))"),
                "Category collection should load each depth with one batched parent query");
        assertTrue(batchedCollector.contains("if (ids.add(child.getId()))"),
                "Batched category collection should avoid duplicate and cyclic category ids");
        assertFalse(batchedCollector.contains("categoryRepository.findByParentId("),
                "Search category collection should not issue one child query per parent");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
