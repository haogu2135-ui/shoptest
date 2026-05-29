package com.example.shop.controller;

import com.example.shop.dto.ForgotPasswordRequest;
import com.example.shop.entity.User;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserService userService;
    private final EmailLoginService emailLoginService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody(required = false) User user) {
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Registration payload is required"));
        }
        try {
            User registeredUser = userService.register(user);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Registered successfully");
            response.put("id", registeredUser != null ? registeredUser.getId() : null);
            response.put("username", registeredUser != null ? registeredUser.getUsername() : null);
            response.put("email", registeredUser != null ? registeredUser.getEmail() : null);
            response.put("phone", registeredUser != null ? registeredUser.getPhone() : null);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> response = new HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Registration failed. Please try again.");
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody(required = false) ForgotPasswordRequest request, HttpServletRequest servletRequest) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password reset payload is required"));
        }
        try {
            User verifiedUser = emailLoginService.verifyLoginCode(
                    request.getEmail(),
                    request.getCode(),
                    clientIpResolver.resolve(servletRequest));
            ensureVerifiedAccountMatchesRequest(request, verifiedUser);
            userService.resetPassword(request.getLogin(), request.getEmail(), request.getNewPassword());
            Map<String, String> response = new HashMap<>();
            response.put("message", "Password reset successfully");
            return ResponseEntity.ok(response);
        } catch (EmailLoginException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", e.getMessage());
            response.put("code", e.getCode());
            if (e.getRetryAfterSeconds() > 0) {
                response.put("retryAfterSeconds", e.getRetryAfterSeconds());
            }
            HttpStatus status = "TOO_MANY_ATTEMPTS".equals(e.getCode())
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(response);
        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    private void ensureVerifiedAccountMatchesRequest(ForgotPasswordRequest request, User verifiedUser) {
        String login = normalize(request.getLogin());
        String email = normalizeEmail(request.getEmail());
        if (verifiedUser == null || email == null || !email.equalsIgnoreCase(normalize(verifiedUser.getEmail()))) {
            throw new IllegalArgumentException("Account information does not match");
        }
        if (login == null
                || (!login.equalsIgnoreCase(normalize(verifiedUser.getEmail()))
                && !login.equals(normalize(verifiedUser.getUsername()))
                && !login.equals(normalize(verifiedUser.getPhone())))) {
            throw new IllegalArgumentException("Account information does not match");
        }
    }

    private String normalize(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeEmail(String value) {
        String normalized = normalize(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }
}
