package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GuestAccessTokenContractTest {
    @Test
    void guestTokenIsIssuedAndAcceptedAcrossGuestSurfaces() throws Exception {
        String tokenService = source("../service/GuestAccessTokenService.java");
        String order = source("OrderController.java");
        String payment = source("PaymentController.java");
        String logistics = source("LogisticsController.java");
        String support = source("SupportController.java");

        assertTrue(tokenService.contains("X-Guest-Access-Token"));
        assertTrue(tokenService.contains("guestEmailFingerprint"));
        assertTrue(tokenService.contains("guestOrderNo"));
        assertTrue(tokenService.contains("TOKEN_TYPE"));
        assertFalse(tokenService.contains("claims.put(\"email\""));
        assertFalse(tokenService.contains("claims.put(\"guestEmail\""));

        assertTrue(order.contains("guestAccessTokenService.issue(body.getOrderNo(), body.getEmail())"));
        assertTrue(order.contains("GuestAccessTokenService.HEADER_NAME"));
        assertTrue(payment.contains("GuestAccessTokenService.HEADER_NAME"));
        assertTrue(payment.contains("access.getGuestAccessToken()"));
        assertTrue(payment.contains("request.getGuestAccessToken()"));
        assertTrue(logistics.contains("body.getGuestAccessToken()"));
        assertTrue(support.contains("GuestAccessTokenService.HEADER_NAME"));
    }

    private String source(String relative) throws Exception {
        Path path = relative.startsWith("../")
                ? Path.of("src/main/java/com/example/shop/controller").resolve(relative).normalize()
                : Path.of("src/main/java/com/example/shop/controller", relative);
        return Files.readString(path);
    }
}
