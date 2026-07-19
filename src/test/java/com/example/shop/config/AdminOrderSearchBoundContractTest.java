package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class AdminOrderSearchBoundContractTest {

    @Test
    void adminOrderSearchIsLengthBoundedBeforeMapperLikeQueries() throws Exception {
        String adminController = read("src/main/java/com/example/shop/controller/AdminController.java");
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String orderMapper = read("src/main/resources/mapper/OrderMapper.xml");

        String pageBuilder = methodBlock(adminController,
                "private Map<String, Object> buildAdminOrdersPage(String status, String search, String quick, int page, int size)");
        assertTrue(pageBuilder.contains("String safeSearch = normalizeAdminFilter(search, 120);"));
        assertTrue(pageBuilder.contains("orderService.countAdminOrders(safeStatus, safeSearch, safeQuick)"));
        assertTrue(pageBuilder.contains("orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, safePage, safeSize)"));
        assertTrue(pageBuilder.contains("buildAdminOrdersSummary(safeSearch)"));

        String exportOrders = methodBlock(adminController,
                "public ResponseEntity<byte[]> exportOrders(@RequestParam(required = false) String status,");
        assertTrue(exportOrders.contains("String safeSearch = normalizeAdminFilter(search, 120);"));
        assertTrue(exportOrders.contains("orderService.countAdminOrders(safeStatus, safeSearch, safeQuick)"));
        assertTrue(exportOrders.contains("orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, 1, exportLimit)"));

        String normalizeAdminFilter = methodBlock(adminController,
                "private String normalizeAdminFilter(String value, int maxLength)");
        assertTrue(normalizeAdminFilter.contains("normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength)"));

        assertTrue(orderService.contains("orderRepository.searchAdminOrders(blankToNull(status), searchLikeTerm(search), blankToNull(quick), offset, safeSize)"));
        assertTrue(orderService.contains("orderRepository.countAdminOrders(blankToNull(status), searchLikeTerm(search), blankToNull(quick))"));
        assertTrue(orderService.contains("orderRepository.countAdminOrderSummary(searchTerm)")
                || orderService.contains("orderRepository.countAdminOrderSummary(searchLikeTerm(search))"));
        assertTrue(orderService.contains("if (ch == '!' || ch == '%' || ch == '_' || ch == '\\\\')"));

        String adminOrderFilters = xmlBlock(orderMapper, "<sql id=\"adminOrderFilters\">", "</sql>");
        assertTrue(adminOrderFilters.contains("<if test=\"search != null and search != ''\">"));
        assertTrue(adminOrderFilters.contains("LIKE CONCAT('%', #{search}, '%') ESCAPE '!'"));
        assertFalse(adminOrderFilters.contains("${search}"));
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String methodBlock(String source, String signaturePrefix) {
        int start = source.indexOf(signaturePrefix);
        assertTrue(start >= 0, "Missing method signature: " + signaturePrefix);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signaturePrefix);
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
        throw new AssertionError("Unterminated method body: " + signaturePrefix);
    }

    private static String xmlBlock(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing XML start marker: " + startMarker);
        int end = source.indexOf(endMarker, start);
        assertTrue(end > start, "Missing XML end marker after: " + startMarker);
        return source.substring(start, end + endMarker.length());
    }
}
