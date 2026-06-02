package com.example.shop.controller;

import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.service.LogisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/logistics")
@RequiredArgsConstructor
public class LogisticsController {
    private final LogisticsService logisticsService;

    @GetMapping("/track")
    public ResponseEntity<?> track(@RequestParam String trackingNumber,
                                   @RequestParam(required = false) String carrier,
                                   @RequestParam(required = false) Long orderId,
                                   @RequestParam(required = false) String guestEmail,
                                   @RequestParam(required = false) String orderNo,
                                   Authentication authentication) {
        try {
            LogisticsTrackResponse response = logisticsService.track(trackingNumber, carrier, orderId, guestEmail, orderNo, authentication);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
