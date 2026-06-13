package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminActionPermissionContractTest {
    private static final Path ADMIN_CONTROLLER = Path.of(
            "src/main/java/com/example/shop/controller/AdminController.java");
    private static final Path ADMIN_ROLE_SERVICE = Path.of(
            "src/main/java/com/example/shop/service/AdminRoleService.java");

    @Test
    void coreAdminMutationsRequireFineGrainedActionPermissions() throws IOException {
        String source = Files.readString(ADMIN_CONTROLLER);

        assertMethodContains(source, "createProduct(", "AdminRoleService.PRODUCTS_WRITE_PERMISSION");
        assertMethodContains(source, "updateProduct(", "AdminRoleService.PRODUCTS_WRITE_PERMISSION");
        assertMethodContains(source, "createCoupon(", "AdminRoleService.COUPONS_WRITE_PERMISSION");
        assertMethodContains(source, "updateCoupon(", "AdminRoleService.COUPONS_WRITE_PERMISSION");
        assertMethodContains(source, "updateUser(", "AdminRoleService.USERS_STATUS_PERMISSION");
        assertMethodContains(source, "updateUser(", "AdminRoleService.USERS_WRITE_PERMISSION");
        assertMethodContains(source, "updateOrderStatus(", "permissionForOrderStatusAction(order.getStatus(), newStatus)");
        assertMethodContains(source, "String deniedMessage)", "adminRoleService.hasPermission(user.getId(), permission)");
        assertMethodContains(source, "String deniedMessage)", "HttpStatus.FORBIDDEN");
    }

    @Test
    void orderStatusTransitionsUseSpecificActionPermissions() throws IOException {
        String source = Files.readString(ADMIN_CONTROLLER);
        String body = methodBody(source, "private String permissionForOrderStatusAction(");

        assertTrue(body.contains("AdminRoleService.ORDER_PAYMENT_PERMISSION"),
                "Payment confirmation transitions must require the payment action permission");
        assertTrue(body.contains("AdminRoleService.ORDER_FULFILLMENT_PERMISSION"),
                "Shipment transitions must require the fulfillment action permission");
        assertTrue(body.contains("AdminRoleService.ORDER_REFUND_PERMISSION"),
                "Return/refund transitions must require the refund action permission");
        assertTrue(body.contains("AdminRoleService.ORDER_STATUS_PERMISSION"),
                "Generic status transitions must still require the status action permission");
    }

    @Test
    void adminActionPermissionRegistryIncludesCoreMutationPermissions() throws IOException {
        String source = Files.readString(ADMIN_ROLE_SERVICE);
        String body = sourceFragment(source, "ADMIN_ACTION_PERMISSIONS = List.of(", "private static final List<String> ALL_ADMIN_PERMISSIONS");

        assertTrue(body.contains("PRODUCTS_WRITE_PERMISSION"));
        assertTrue(body.contains("COUPONS_WRITE_PERMISSION"));
        assertTrue(body.contains("USERS_WRITE_PERMISSION"));
        assertTrue(body.contains("USERS_STATUS_PERMISSION"));
        assertTrue(body.contains("ORDER_STATUS_PERMISSION"));
        assertTrue(body.contains("ORDER_PAYMENT_PERMISSION"));
        assertTrue(body.contains("ORDER_FULFILLMENT_PERMISSION"));
        assertTrue(body.contains("ORDER_REFUND_PERMISSION"));
    }

    private static void assertMethodContains(String source, String methodSignature, String expected) {
        String body = methodBody(source, methodSignature);
        assertTrue(body.contains(expected), () -> methodSignature + " must contain " + expected);
    }

    private static String methodBody(String source, String marker) {
        int start = source.indexOf(marker);
        assertTrue(start >= 0, () -> "Missing source marker: " + marker);
        int braceStart = source.indexOf('{', start);
        assertTrue(braceStart >= 0, () -> "Missing method body for marker: " + marker);
        int depth = 0;
        for (int i = braceStart; i < source.length(); i++) {
            char current = source.charAt(i);
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(braceStart, i + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body for marker: " + marker);
    }

    private static String sourceFragment(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, () -> "Missing source marker: " + startMarker);
        int end = source.indexOf(endMarker, start);
        assertTrue(end > start, () -> "Missing end marker: " + endMarker);
        return source.substring(start, end);
    }
}
