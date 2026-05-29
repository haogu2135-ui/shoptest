package com.example.shop.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class PublicUserReferenceSerializationTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void reviewExposesPublicUserReferenceOnly() throws Exception {
        Review review = new Review();
        review.setId(11L);
        review.setRating(5);
        review.setComment("Great fit.");
        review.setUser(privateUser());

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(review));

        assertFalse(json.has("user"));
        assertEquals(7L, json.get("userId").asLong());
        assertEquals("mia", json.get("username").asText());
        assertFalse(json.toString().contains("mia@example.com"));
        assertFalse(json.toString().contains("5550100"));
        assertFalse(json.toString().contains("1 Main Street"));
        assertFalse(json.toString().contains("encoded-password"));
    }

    @Test
    void productQuestionExposesPublicUserReferenceOnly() throws Exception {
        ProductQuestion question = new ProductQuestion();
        question.setId(21L);
        question.setQuestion("Is this safe for puppies?");
        question.setUser(privateUser());

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(question));

        assertFalse(json.has("user"));
        assertEquals(7L, json.get("userId").asLong());
        assertEquals("mia", json.get("username").asText());
        assertFalse(json.toString().contains("mia@example.com"));
        assertFalse(json.toString().contains("5550100"));
        assertFalse(json.toString().contains("1 Main Street"));
        assertFalse(json.toString().contains("encoded-password"));
    }

    private User privateUser() {
        User user = new User();
        user.setId(7L);
        user.setUsername("mia");
        user.setPassword("encoded-password");
        user.setEmail("mia@example.com");
        user.setPhone("5550100");
        user.setAddress("1 Main Street");
        user.setRole("ADMIN");
        user.setRoleCode("SUPER_ADMIN");
        user.setStatus("ACTIVE");
        return user;
    }
}
