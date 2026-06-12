package com.example.shop.controller;

import com.example.shop.dto.AdminUserResponse;
import com.example.shop.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminUserPasswordExposureContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void adminUserJsonResponsesNeverExposePasswordMaterial() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setUsername("operator");
        user.setPassword("$2a$10$encoded-password-hash");
        user.setEmail("operator@example.com");
        user.setPhone("15551234567");
        user.setAddress("front desk");
        user.setRole("ADMIN");
        user.setRoleCode("SUPER_ADMIN");
        user.setStatus("ACTIVE");

        JsonNode entityJson = objectMapper.readTree(objectMapper.writeValueAsString(user));
        AdminUserResponse response = AdminUserResponse.from(user);
        JsonNode responseJson = objectMapper.readTree(objectMapper.writeValueAsString(response));
        String responseSource = Files.readString(Path.of("src/main/java/com/example/shop/dto/AdminUserResponse.java"),
                StandardCharsets.UTF_8);
        String controllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"),
                StandardCharsets.UTF_8);

        assertFalse(hasDeclaredField(AdminUserResponse.class, "password"),
                "Admin user response DTO must not declare a password field");
        assertFalse(responseSource.contains("getPassword()"),
                "Admin user response mapping must not read password hashes");
        assertFalse(entityJson.has("password"),
                "User.password must remain write-only for any legacy User response paths");
        assertFalse(entityJson.has("passwordHash"));
        assertFalse(entityJson.toString().contains("$2a$10$encoded-password-hash"));
        assertFalse(responseJson.has("password"));
        assertFalse(responseJson.has("passwordHash"));
        assertFalse(responseJson.toString().contains("$2a$10$encoded-password-hash"));

        assertTrue(controllerSource.contains(".map(AdminUserResponse::from)"),
                "Admin user list responses must map users through the safe response DTO");
        assertTrue(controllerSource.contains("ResponseEntity.ok(AdminUserResponse.from(updated))"),
                "Admin role update responses must map users through the safe response DTO");
        assertTrue(controllerSource.contains("ResponseEntity.ok(AdminUserResponse.from(updated == null ? existing : updated))"),
                "Admin user update responses must map users through the safe response DTO");
    }

    @Test
    void adminUserCsvExportOmitsPasswordColumnsAndValues() throws Exception {
        String controllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"),
                StandardCharsets.UTF_8);
        String exportSection = section(controllerSource, "@GetMapping(\"/users/export\")", "@PutMapping(\"/users/{id}/role-code\")");
        String lowerExportSection = exportSection.toLowerCase();

        assertFalse(lowerExportSection.contains("password"),
                "Admin user CSV export must not include password or passwordHash columns");
        assertFalse(exportSection.contains("getPassword()"),
                "Admin user CSV export must not read password hashes");
    }

    private static boolean hasDeclaredField(Class<?> type, String fieldName) {
        for (Field field : type.getDeclaredFields()) {
            if (field.getName().equals(fieldName)) {
                return true;
            }
        }
        return false;
    }

    private static String section(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        int end = source.indexOf(endMarker, Math.max(start, 0));
        assertTrue(start >= 0, "Missing source marker: " + startMarker);
        assertTrue(end > start, "Missing source marker: " + endMarker);
        return source.substring(start, end);
    }
}
