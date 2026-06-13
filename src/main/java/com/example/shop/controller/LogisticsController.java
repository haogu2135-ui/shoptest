package com.example.shop.controller;

import com.example.shop.dto.LogisticsTrackRequest;
import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.service.LogisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
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
                                   Authentication authentication) {
        try {
            LogisticsTrackResponse response = logisticsService.track(trackingNumber, carrier, orderId, null, null, authentication);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/track")
    public ResponseEntity<?> trackWithGuestAccess(@Valid @RequestBody(required = false) LogisticsTrackRequest body,
                                                  Authentication authentication) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Logistics tracking payload is required"));
        }
        try {
            LogisticsTrackResponse response = logisticsService.track(
                    body.getTrackingNumber(),
                    body.getCarrier(),
                    body.getOrderId(),
                    body.getGuestEmail(),
                    body.getOrderNo(),
                    authentication);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
