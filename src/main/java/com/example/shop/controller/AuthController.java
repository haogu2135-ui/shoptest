package com.example.shop.controller;

import com.example.shop.dto.ForgotPasswordRequest;
import com.example.shop.entity.User;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import javax.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String PUBLIC_REGISTRATION_UNAVAILABLE_MESSAGE =
            "Registration could not be completed with the supplied account details";

    private final UserService userService;
    private final EmailLoginService emailLoginService;
    private final ClientIpResolver clientIpResolver;
    private final IpBlacklistService ipBlacklistService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody(required = false) RegisterRequest request,
                                      HttpServletRequest servletRequest) {
        User user = request == null ? null : request.toUser();
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Registration payload is required"));
        }
        List<String> missingFields = missingRegistrationFields(user);
        if (!missingFields.isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", registrationMissingFieldsMessage(missingFields));
            response.put("missingFields", missingFields);
            return ResponseEntity.badRequest().body(response);
        }
        try {
            boolean claimingGuestEmail = userService.isGuestEmailOwner(user.getEmail());
            boolean guestEmailVerified = false;
            if (claimingGuestEmail) {
                if (isBlank(request.getEmailCode())) {
                    throw new IllegalArgumentException("Email verification is required to claim guest checkout history");
                }
                User verifiedUser = emailLoginService.verifyLoginCode(
                        user.getEmail(),
                        request.getEmailCode(),
                        clientIpResolver.resolve(servletRequest));
                ensureRegisterEmailMatchesVerifiedUser(user.getEmail(), verifiedUser);
                guestEmailVerified = true;
            }
            User registeredUser = userService.register(user, guestEmailVerified);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Registered successfully");
            response.put("id", registeredUser != null ? registeredUser.getId() : null);
            response.put("username", registeredUser != null ? registeredUser.getUsername() : null);
            return ResponseEntity.ok(response);
        } catch (EmailLoginException e) {
            ipBlacklistService.recordLoginFailure(servletRequest, "register-email-claim:" + e.getCode());
            Map<String, Object> response = new HashMap<>();
            response.put("error", e.getMessage());
            response.put("code", e.getCode());
            response.put("emailCodeRequired", true);
            if (e.getRetryAfterSeconds() > 0) {
                response.put("retryAfterSeconds", e.getRetryAfterSeconds());
            }
            HttpStatus status = "TOO_MANY_ATTEMPTS".equals(e.getCode())
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(response);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            String message = e.getMessage();
            response.put("error", publicRegistrationError(message));
            if (isDuplicateAccountRegistrationError(message)) {
                response.put("code", "ACCOUNT_DETAILS_UNAVAILABLE");
            }
            if (message != null && message.toLowerCase(Locale.ROOT).contains("email verification")) {
                response.put("emailCodeRequired", true);
            }
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Registration failed. Please try again.", e);
        }
    }

    private List<String> missingRegistrationFields(User user) {
        List<String> fields = new ArrayList<>();
        if (isBlank(user.getUsername())) {
            fields.add("username");
        }
        if (isBlank(user.getEmail())) {
            fields.add("email");
        }
        if (isBlank(user.getPassword())) {
            fields.add("password");
        }
        return fields;
    }

    private String registrationMissingFieldsMessage(List<String> fields) {
        return String.join(", ", fields) + (fields.size() == 1 ? " is required" : " are required");
    }

    private String publicRegistrationError(String message) {
        if (isDuplicateAccountRegistrationError(message)) {
            return PUBLIC_REGISTRATION_UNAVAILABLE_MESSAGE;
        }
        return message == null || message.isBlank() ? "Registration failed. Please try again." : message;
    }

    private boolean isDuplicateAccountRegistrationError(String message) {
        return message != null && message.toLowerCase(Locale.ROOT).contains("already registered");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void ensureRegisterEmailMatchesVerifiedUser(String requestedEmail, User verifiedUser) {
        String normalizedEmail = normalizeEmail(requestedEmail);
        if (verifiedUser == null || normalizedEmail == null || !normalizedEmail.equalsIgnoreCase(normalize(verifiedUser.getEmail()))) {
            throw new IllegalArgumentException("Account information does not match");
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody(required = false) ForgotPasswordRequest request, HttpServletRequest servletRequest) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password reset payload is required"));
        }
        try {
            User verifiedUser = emailLoginService.verifyPasswordResetCode(
                    request.getEmail(),
                    request.getCode(),
                    clientIpResolver.resolve(servletRequest));
            ensureVerifiedAccountMatchesRequest(request, verifiedUser);
            userService.resetPassword(request.getLogin(), request.getEmail(), request.getNewPassword());
            Map<String, String> response = new HashMap<>();
            response.put("message", "Password reset successfully");
            return ResponseEntity.ok(response);
        } catch (EmailLoginException e) {
            ipBlacklistService.recordLoginFailure(servletRequest, "forgot-password:" + e.getCode());
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
        } catch (IllegalStateException e) {
            ipBlacklistService.recordLoginFailure(servletRequest, "forgot-password service unavailable");
            Map<String, String> response = new HashMap<>();
            response.put("error", "Password reset service is temporarily unavailable. Please try again later.");
            response.put("code", "RESET_SERVICE_UNAVAILABLE");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        } catch (Exception e) {
            ipBlacklistService.recordLoginFailure(servletRequest, "forgot-password failed");
            Map<String, String> response = new HashMap<>();
            response.put("error", "Password reset failed. Please verify the account information and code.");
            response.put("code", "RESET_FAILED");
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

    public static class RegisterRequest {
        @NotBlank(message = "Username is required")
        @Size(max = 50, message = "Username is too long")
        private String username;

        @NotBlank(message = "Password is required")
        @Size(min = 12, max = 128, message = "Password must be 12 to 128 characters")
        private String password;

        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        @Size(max = 100, message = "Email is too long")
        private String email;

        private String phone;

        @Size(max = 32, message = "Email verification code is too long")
        private String emailCode;

        public User toUser() {
            User user = new User();
            user.setUsername(username);
            user.setPassword(password);
            user.setEmail(email);
            user.setPhone(phone);
            user.setRole("USER");
            return user;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }

        public String getEmailCode() {
            return emailCode;
        }

        public void setEmailCode(String emailCode) {
            this.emailCode = emailCode;
        }
    }
}
