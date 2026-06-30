package com.example.shop.dto;

import com.example.shop.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserProfileResponseTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void profileResponseOmitsRoleCodeForNonAdminUsers() throws Exception {
        UserProfileResponse response = UserProfileResponse.from(user("USER", "SUPER_ADMIN"));

        assertEquals("USER", response.getRole());
        assertNull(response.getRoleCode());
        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));
        assertFalse(json.has("roleCode"));
    }

    @Test
    void profileResponseIncludesRoleCodeForAdminUsers() throws Exception {
        UserProfileResponse response = UserProfileResponse.from(user("ADMIN", "SUPER_ADMIN"));

        assertEquals("ADMIN", response.getRole());
        assertEquals("SUPER_ADMIN", response.getRoleCode());
        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));
        assertTrue(json.has("roleCode"));
        assertEquals("SUPER_ADMIN", json.get("roleCode").asText());
    }

    private User user(String role, String roleCode) {
        User user = new User();
        user.setId(7L);
        user.setUsername("mia");
        user.setEmail("mia@example.com");
        user.setPhone("5550100");
        user.setRole(role);
        user.setRoleCode(roleCode);
        return user;
    }
}
