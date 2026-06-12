package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ReviewableOrdersIndexContractTest {

    @Test
    void reviewableOrdersLookupHasCoveringReviewCompositeIndex() throws Exception {
        String mapper = read("src/main/resources/mapper/OrderMapper.xml");
        String query = sliceBetween(
                mapper,
                "<select id=\"findReviewableOrdersByUserAndProduct\"",
                "</select>");

        assertTrue(query.contains("FROM reviews r"));
        assertTrue(query.contains("r.order_id = o.id"));
        assertTrue(query.contains("r.product_id = #{productId}"));
        assertTrue(query.contains("r.user_id = #{userId}"));

        String baselineMigration = read("src/main/resources/db/migration/V1__init.sql");
        assertTrue(baselineMigration.contains("UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Fresh Flyway schema should include a composite review index covering product/user/order equality lookups");

        String schemaSql = read("src/main/resources/schema.sql");
        assertTrue(schemaSql.contains("UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Schema bootstrap should include a composite review index covering product/user/order equality lookups");

        String uniqueMigration = read("src/main/resources/db/migration/V6__review_unique_product_user_order.sql");
        assertTrue(uniqueMigration.contains("ALTER TABLE reviews ADD UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Existing Flyway databases should be upgraded to the covering composite review index");

        String schemaConfig = read("src/main/java/com/example/shop/config/CommerceSchemaConfig.java");
        assertTrue(schemaConfig.contains("ALTER TABLE reviews ADD INDEX idx_reviews_product_user_order (product_id, user_id, order_id)")
                        || schemaConfig.contains("ALTER TABLE reviews ADD UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)"),
                "Startup schema hardening should keep a product/user/order review index available");
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
