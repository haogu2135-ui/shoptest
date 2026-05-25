package com.example.shop.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class UserJsonSerializationTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void passwordIsAcceptedOnInputButNeverSerialized() throws Exception {
        User user = objectMapper.readValue(
                "{\"username\":\"buyer\",\"password\":\"plain-secret\",\"email\":\"buyer@example.com\",\"role\":\"USER\"}",
                User.class
        );

        assertEquals("plain-secret", user.getPassword());

        user.setId(9L);
        user.setPassword("$2a$10$hashed-password-value");

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(user));

        assertEquals("buyer", json.get("username").asText());
        assertFalse(json.has("password"));
    }
}
