package com.example.shop.controller;

import com.example.shop.dto.LogisticsTrackRequest;
import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.service.LogisticsService;
import com.example.shop.service.GuestAccessRateLimitService;
import com.example.shop.service.GuestAccessTokenService;
import org.springframework.beans.factory.annotation.Autowired;
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
import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/logistics")
@RequiredArgsConstructor
public class LogisticsController {
    private final LogisticsService logisticsService;
    @Autowired
    private GuestAccessRateLimitService guestAccessRateLimitService;

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
        HttpServletRequest request = currentRequest();
        assertGuestAccessAllowed("logistics", body.getOrderNo(), body.getGuestEmail(), request);
        try {
            LogisticsTrackResponse response = logisticsService.track(
                    body.getTrackingNumber(),
                    body.getCarrier(),
                    body.getOrderId(),
                    body.getGuestEmail(),
                    body.getOrderNo(),
                    body.getGuestAccessToken() != null
                            ? body.getGuestAccessToken()
                            : request == null ? null : request.getHeader(GuestAccessTokenService.HEADER_NAME),
                    authentication);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            if (e.getStatus().value() == 403 || e.getStatus().value() == 404) {
                recordGuestAccessFailure("logistics", body.getOrderNo(), body.getGuestEmail(), request);
            }
            throw e;
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private void assertGuestAccessAllowed(String scope, String orderNo, String email, HttpServletRequest request) {
        if (guestAccessRateLimitService != null) {
            guestAccessRateLimitService.assertAllowed(scope, orderNo, email, request);
        }
    }

    private void recordGuestAccessFailure(String scope, String orderNo, String email, HttpServletRequest request) {
        if (guestAccessRateLimitService != null) {
            guestAccessRateLimitService.recordFailure(scope, orderNo, email, request);
        }
    }

    private HttpServletRequest currentRequest() {
        try {
            org.springframework.web.context.request.RequestAttributes attributes =
                    org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes();
            if (attributes instanceof org.springframework.web.context.request.ServletRequestAttributes) {
                return ((org.springframework.web.context.request.ServletRequestAttributes) attributes).getRequest();
            }
        } catch (IllegalStateException ignored) {
            // Direct service-level calls do not have a servlet request context.
        }
        return null;
    }
}
