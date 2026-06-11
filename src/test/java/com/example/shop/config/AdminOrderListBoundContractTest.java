package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminOrderListBoundContractTest {

    @Test
    void legacyAdminOrderListsAreBoundedAndRateLimited() throws Exception {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String orderController = read("src/main/java/com/example/shop/controller/OrderController.java");
        String rateLimitService = read("src/main/java/com/example/shop/service/RateLimitService.java");
        String applicationProperties = read("src/main/resources/application.properties");
        String configCenterService = read("src/main/java/com/example/shop/service/ConfigCenterService.java");
        String backendEnvExample = read("deploy/backend.env.example");

        assertTrue(orderService.contains("private static final int HARD_LEGACY_ADMIN_ORDER_LIST_LIMIT = 500;"),
                "OrderService legacy admin list ceiling should be capped well below the export ceiling");
        String getAllOrders = sliceBetween(orderService, "public List<Order> getAllOrders()", "public LocalDateTime currentDatabaseTime()");
        assertTrue(getAllOrders.contains("runtimeConfig.getInt(\"admin.orders.legacy-list-max-rows\", 100)"),
                "Legacy list should stay configurable below the hard ceiling");
        assertTrue(getAllOrders.contains("HARD_LEGACY_ADMIN_ORDER_LIST_LIMIT"),
                "Legacy list should enforce the service hard ceiling");
        assertFalse(getAllOrders.contains(", 5000)"),
                "Legacy getAllOrders must not allow 5000 rows in one response");

        assertTrue(orderController.contains("private static final int HARD_LEGACY_ADMIN_ORDER_LIST_LIMIT = 500;"),
                "Legacy /orders admin compatibility path should enforce the same hard ceiling");

        assertTrue(rateLimitService.contains("positiveInt(\"traffic.rate-limit.admin-order-list-per-minute\", 60)"),
                "Admin order list endpoint limit should be configurable");
        assertTrue(rateLimitService.contains("return new EndpointLimit(\"GET\", \"admin:orders:list\", config.adminOrderListPerMinute, 60);"),
                "Admin order list endpoints should use a dedicated per-minute bucket");
        assertTrue(rateLimitService.contains("path.equals(\"/admin/orders\")"),
                "Admin order list limiter should cover /admin/orders");
        assertTrue(rateLimitService.contains("path.equals(\"/admin/orders/page\")"),
                "Admin order list limiter should cover /admin/orders/page");
        assertTrue(rateLimitService.indexOf("isAdminOrderListPath(path)") < rateLimitService.indexOf("if (!\"POST\".equals(method))"),
                "GET admin order list paths should be checked before non-POST endpoints return no dedicated limit");

        assertTrue(applicationProperties.contains("traffic.rate-limit.admin-order-list-per-minute=${TRAFFIC_RATE_LIMIT_ADMIN_ORDER_LIST_PER_MINUTE:60}"),
                "application.properties should expose the admin order list endpoint limit");
        assertTrue(configCenterService.contains("\"traffic.rate-limit.admin-order-list-per-minute=60\""),
                "Config Center default runtime content should expose the admin order list endpoint limit");
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_ADMIN_ORDER_LIST_PER_MINUTE=60"),
                "Production env example should expose the admin order list endpoint limit");
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
