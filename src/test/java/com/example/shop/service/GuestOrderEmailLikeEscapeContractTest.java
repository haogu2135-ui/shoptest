package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GuestOrderEmailLikeEscapeContractTest {

    @Test
    void guestOrderEmailLookupEscapesLegacyShippingAddressLikeWildcards() throws Exception {
        OrderService service = new OrderService();
        String escapedEmail = ReflectionTestUtils.invokeMethod(
                service,
                "emailLikeTerm",
                " Buyer%_!Pet\\Shop@example.com ");

        assertEquals("buyer!%!_!!pet!\\shop@example.com", escapedEmail);

        String repository = read("src/main/java/com/example/shop/repository/OrderRepository.java");
        assertTrue(repository.contains("@Param(\"emailLike\") String emailLike"),
                "Repository should pass a separately escaped LIKE term");

        String mapper = read("src/main/resources/mapper/OrderMapper.xml");
        String lookup = sliceBetween(
                mapper,
                "<select id=\"findByOrderNoAndEmail\"",
                "</select>");

        assertTrue(lookup.contains("AND #{emailLike} IS NOT NULL"),
                "Legacy guest fallback should only use the LIKE branch when an escaped term exists");
        assertTrue(lookup.contains("LOWER(#{emailLike})"),
                "Legacy guest fallback should bind the escaped emailLike parameter");
        assertTrue(lookup.contains("ESCAPE '!'"),
                "Legacy guest fallback should declare the explicit LIKE escape character");
        assertFalse(lookup.contains("LIKE CONCAT('% / ', LOWER(TRIM(#{email}))"),
                "Legacy guest fallback should not reuse raw email in a LIKE pattern");
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
