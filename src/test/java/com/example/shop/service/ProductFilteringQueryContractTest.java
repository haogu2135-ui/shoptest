package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductFilteringQueryContractTest {
    @Test
    void publicProductListPushesCatalogFiltersIntoPagedJpaQuery() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String pageQuery = methodBlock(source,
                "private Page<Product> findPublicProductPageUncached(ProductListQuery normalizedQuery, String normalizedKeyword)");
        String specification = methodBlock(source,
                "private Specification<Product> publicProductSpecification(ProductListQuery query,");

        assertTrue(pageQuery.contains("PageRequest.of(normalizedPage, normalizedSize, productPageSort(normalizedQuery.getSort()))"));
        assertTrue(pageQuery.contains("productRepository.findAll(publicProductSpecification("));
        assertTrue(pageQuery.contains(", pageRequest)"));
        assertTrue(pageQuery.contains("page.getContent()"),
                "Any defensive Java filtering must operate only on the current database page");
        assertTrue(pageQuery.contains("new PageImpl<>(visibleProducts, page.getPageable(), visibleProducts.size())"),
                "Post-query visibility filters must not reuse the unfiltered database total");

        assertTrue(specification.contains("Expression<BigDecimal> effectivePrice = effectivePriceExpression(criteriaBuilder, root)"));
        assertTrue(specification.contains("criteriaBuilder.greaterThanOrEqualTo(effectivePrice, minPrice)"));
        assertTrue(specification.contains("criteriaBuilder.lessThanOrEqualTo(effectivePrice, maxPrice)"));
        assertTrue(specification.contains("addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get(\"specifications\"), query.getPetSizes())"));
        assertTrue(specification.contains("addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get(\"specifications\"), query.getMaterials())"));
        assertTrue(specification.contains("addColorPredicates(predicates, criteriaBuilder, root.get(\"name\"), root.get(\"specifications\"), query.getColors())"));
        assertTrue(specification.contains("containsLike(criteriaBuilder, root.get(\"specifications\"), term)"));
        assertFalse(pageQuery.contains("productRepository.findAll()"),
                "Public product filters must not start from an unbounded product load");
    }

    @Test
    void adminProductListPushesCatalogFiltersIntoPagedJpaQuery() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String pageQuery = methodBlock(source, "public Page<Product> findAdminProductPage(ProductListQuery query)");
        String specification = methodBlock(source,
                "private Specification<Product> adminProductSpecification(ProductListQuery query,");

        assertTrue(pageQuery.contains("PageRequest.of(normalizedPage, normalizedSize, productPageSort(normalizedQuery.getSort()))"));
        assertTrue(pageQuery.contains("productRepository.findAll(adminProductSpecification("));
        assertTrue(pageQuery.contains(", pageRequest)"));
        assertFalse(pageQuery.contains(".stream().filter("),
                "Admin filtering must be applied before pagination by the JPA specification");
        assertFalse(pageQuery.contains("productRepository.findAll()"),
                "Admin product filters must not start from an unbounded product load");

        assertTrue(specification.contains("Expression<BigDecimal> effectivePrice = effectivePriceExpression(criteriaBuilder, root)"));
        assertTrue(specification.contains("criteriaBuilder.greaterThanOrEqualTo(effectivePrice, minPrice)"));
        assertTrue(specification.contains("criteriaBuilder.lessThanOrEqualTo(effectivePrice, maxPrice)"));
        assertTrue(specification.contains("addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get(\"specifications\"), query.getPetSizes())"));
        assertTrue(specification.contains("addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get(\"specifications\"), query.getMaterials())"));
        assertTrue(specification.contains("addColorPredicates(predicates, criteriaBuilder, root.get(\"name\"), root.get(\"specifications\"), query.getColors())"));
        assertTrue(specification.contains("containsLike(criteriaBuilder, root.get(\"specifications\"), term)"));
    }

    @Test
    void refinementPredicateHelpersUseEscapedSqlLikePredicates() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String refinementPredicates = methodBlock(source,
                "private void addSpecificationRefinementPredicates(List<Predicate> predicates,");
        String colorPredicates = methodBlock(source,
                "private void addColorPredicates(List<Predicate> predicates,");

        assertTrue(refinementPredicates.contains("containsLike(criteriaBuilder, specificationsPath, value)"));
        assertTrue(colorPredicates.contains("containsLike(criteriaBuilder, namePath, value)"));
        assertTrue(colorPredicates.contains("containsLike(criteriaBuilder, specificationsPath, value)"));
        assertFalse(refinementPredicates.contains("\"%\" + value + \"%\""));
        assertFalse(colorPredicates.contains("\"%\" + value + \"%\""));
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
