package com.example.shop.controller;

import com.example.shop.dto.UpdateProfileRequest;
import com.example.shop.dto.UpdatePasswordRequest;
import com.example.shop.dto.UserProfileResponse;
import com.example.shop.entity.User;
import com.example.shop.config.AdminBootstrapTokenPolicy;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import javax.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private static final String ADMIN_BOOTSTRAP_FAILURE_MESSAGE = "Admin bootstrap failed";

    private final UserService userService;
    private final RuntimeConfigService runtimeConfig;
    private final SecurityAuditLogService auditLogService;
    private final EmailLoginService emailLoginService;
    private final ClientIpResolver clientIpResolver;
    private final IpBlacklistService ipBlacklistService;

    @PutMapping("/profile")
    public void updateProfile(@Valid @RequestBody(required = false) UpdateProfileRequest request, Authentication authentication, HttpServletRequest servletRequest) {
        if (request == null) {
            auditLogService.record("USER_PROFILE_UPDATE", "FAILURE", authentication, "USER", null, servletRequest,
                    "Profile payload is required", null);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile payload is required");
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        try {
            User before = userService.findById(userDetails.getId());
            assertProfileEmailVerifiedIfChanged(userDetails.getId(), request, servletRequest);
            userService.updateProfileContact(userDetails.getId(), request.getEmail(), request.getPhone());
            auditLogService.record("USER_PROFILE_UPDATE", "SUCCESS", authentication, "USER", userDetails.getId(), servletRequest,
                    "User profile updated", profileAuditMetadata(before, request));
        } catch (RuntimeException e) {
            auditLogService.record("USER_PROFILE_UPDATE", "FAILURE", authentication, "USER", userDetails.getId(), servletRequest,
                    e.getMessage(), profileAuditMetadata(null, request));
            throw e;
        }
    }

    @PostMapping("/profile/email-code")
    public ResponseEntity<?> sendProfileEmailCode(@Valid @RequestBody(required = false) UpdateProfileRequest request,
                                                  Authentication authentication,
                                                  HttpServletRequest servletRequest) {
        if (request == null) {
            auditLogService.record("USER_PROFILE_EMAIL_CODE", "FAILURE", authentication, "USER", null, servletRequest,
                    "Profile payload is required", null);
            return ResponseEntity.badRequest().body(Map.of("error", "Profile payload is required"));
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        try {
            String normalizedEmail = normalizeEmail(request.getEmail());
            User current = userService.findById(userDetails.getId());
            if (current == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
            }
            if (normalizedEmail.equals(normalizeEmail(current.getEmail()))) {
                auditLogService.record("USER_PROFILE_EMAIL_CODE", "SUCCESS", authentication, "USER", userDetails.getId(), servletRequest,
                        "Profile email already verified", "emailChanged=false,emailDomain=" + emailDomain(normalizedEmail));
                return ResponseEntity.ok(emailCodeResponse("Current email is already verified"));
            }
            emailLoginService.sendProfileEmailChangeCode(
                    userDetails.getId(),
                    normalizedEmail,
                    clientIpResolver.resolve(servletRequest));
            auditLogService.record("USER_PROFILE_EMAIL_CODE", "SUCCESS", authentication, "USER", userDetails.getId(), servletRequest,
                    "Profile email verification code sent", "emailChanged=true,emailDomain=" + emailDomain(normalizedEmail));
            return ResponseEntity.ok(emailCodeResponse("Verification code sent"));
        } catch (EmailLoginException e) {
            auditLogService.record("USER_PROFILE_EMAIL_CODE", "FAILURE", authentication, "USER", userDetails.getId(), servletRequest,
                    e.getMessage(), "code=" + e.getCode());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(emailCodeError(e.getCode(), e.getMessage(), e.getRetryAfterSeconds()));
        } catch (IllegalArgumentException e) {
            auditLogService.record("USER_PROFILE_EMAIL_CODE", "FAILURE", authentication, "USER", userDetails.getId(), servletRequest,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            auditLogService.record("USER_PROFILE_EMAIL_CODE", "FAILURE", authentication, "USER", userDetails.getId(), servletRequest,
                    e.getMessage(), null);
            throw e;
        }
    }

    @PutMapping("/password")
    public void updatePassword(@Valid @RequestBody(required = false) UpdatePasswordRequest request,
                               Authentication authentication,
                               HttpServletRequest servletRequest) {
        if (request == null) {
            auditLogService.record("USER_PASSWORD_UPDATE", "FAILURE", authentication, "USER", null, servletRequest,
                    "Password payload is required", null);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password payload is required");
        }
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        try {
            userService.updatePassword(userDetails.getId(), request.getOldPassword(), request.getNewPassword());
            auditLogService.record("USER_PASSWORD_UPDATE", "SUCCESS", authentication, "USER", userDetails.getId(), servletRequest,
                    "User password updated", null);
        } catch (RuntimeException e) {
            auditLogService.record("USER_PASSWORD_UPDATE", "FAILURE", authentication, "USER", userDetails.getId(), servletRequest,
                    e.getMessage(), null);
            throw e;
        }
    }

    @GetMapping("/profile")
    public UserProfileResponse getProfile(Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        return UserProfileResponse.from(userService.findById(userDetails.getId()));
    }

    @PostMapping("/create-admin")
    public void createAdmin(@Valid @RequestBody(required = false) AdminBootstrapRequest request,
                            @RequestHeader(value = "X-Bootstrap-Token", required = false) String bootstrapToken,
                            HttpServletRequest httpRequest) {
        if (request == null) {
            auditLogService.record("ADMIN_BOOTSTRAP", "FAILURE", null, null,
                    null, "USER", null, httpRequest, "Admin payload is required", null);
            ipBlacklistService.recordLoginFailure(httpRequest, "admin-bootstrap payload missing");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin payload is required");
        }
        try {
            assertAdminBootstrapToken(bootstrapToken);
            User admin = new User();
            admin.setUsername(request.getUsername().trim());
            admin.setPassword(request.getPassword());
            admin.setEmail(request.getEmail().trim());
            admin.setRole("ADMIN");
            userService.registerAdmin(admin);
            auditLogService.record("ADMIN_BOOTSTRAP", "SUCCESS", null, request.getUsername().trim(),
                    "ADMIN", "USER", null, httpRequest, "Admin account created",
                    "username=" + request.getUsername().trim());
        } catch (RuntimeException e) {
            auditLogService.record("ADMIN_BOOTSTRAP", "FAILURE", null, safeBootstrapUsername(request),
                    null, "USER", null, httpRequest, "Admin bootstrap failed: " + e.getMessage(), null);
            ipBlacklistService.recordLoginFailure(httpRequest, "admin-bootstrap failed");
            throw sanitizeAdminBootstrapFailure(e);
        }
    }

    private RuntimeException sanitizeAdminBootstrapFailure(RuntimeException exception) {
        if (exception instanceof ResponseStatusException) {
            ResponseStatusException responseStatusException = (ResponseStatusException) exception;
            if (responseStatusException.getStatus().is4xxClientError()) {
                return new ResponseStatusException(HttpStatus.FORBIDDEN, ADMIN_BOOTSTRAP_FAILURE_MESSAGE);
            }
            return exception;
        }
        if (exception instanceof IllegalArgumentException || exception instanceof IllegalStateException) {
            return new ResponseStatusException(HttpStatus.FORBIDDEN, ADMIN_BOOTSTRAP_FAILURE_MESSAGE);
        }
        return exception;
    }

    private String safeBootstrapUsername(AdminBootstrapRequest request) {
        if (request == null || request.getUsername() == null) {
            return null;
        }
        String username = request.getUsername().trim();
        return username.isEmpty() ? null : username;
    }

    private void assertAdminBootstrapToken(String bootstrapToken) {
        String adminBootstrapToken = runtimeConfig.getString("admin.bootstrap-token", "");
        if (isBlank(adminBootstrapToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin bootstrap is not configured");
        }
        String normalizedConfiguredToken = AdminBootstrapTokenPolicy.normalize(adminBootstrapToken);
        if (!AdminBootstrapTokenPolicy.isStrongConfiguredToken(normalizedConfiguredToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin bootstrap token is not strong enough");
        }
        if (isBlank(bootstrapToken)
                || !constantTimeEquals(normalizedConfiguredToken, AdminBootstrapTokenPolicy.normalize(bootstrapToken))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid admin bootstrap token");
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8)
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void assertProfileEmailVerifiedIfChanged(Long userId, UpdateProfileRequest request, HttpServletRequest servletRequest) {
        User current = userService.findById(userId);
        if (current == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        String currentEmail = normalizeEmail(current.getEmail());
        String requestedEmail = normalizeEmail(request.getEmail());
        if (requestedEmail.equals(currentEmail)) {
            return;
        }
        emailLoginService.verifyProfileEmailChangeCode(
                userId,
                requestedEmail,
                request.getEmailCode(),
                clientIpResolver.resolve(servletRequest));
    }

    private String normalizeEmail(String value) {
        if (isBlank(value)) {
            throw new IllegalArgumentException("Email is required");
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private Map<String, Object> emailCodeResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", message);
        response.put("codeTtlMinutes", emailLoginService.codeTtlMinutes());
        response.put("resendIntervalSeconds", emailLoginService.resendIntervalSeconds());
        return response;
    }

    private Map<String, Object> emailCodeError(String code, String message, long retryAfterSeconds) {
        Map<String, Object> response = new HashMap<>();
        response.put("error", message);
        response.put("code", code);
        if (retryAfterSeconds > 0) {
            response.put("retryAfterSeconds", retryAfterSeconds);
        }
        return response;
    }

    private String profileAuditMetadata(User before, UpdateProfileRequest request) {
        if (request == null) {
            return null;
        }
        String beforeEmail = before == null ? null : normalizeNullableEmail(before.getEmail());
        String requestedEmail = normalizeNullableEmail(request.getEmail());
        boolean emailChanged = beforeEmail != null && requestedEmail != null && !beforeEmail.equals(requestedEmail);
        boolean phoneChanged = before != null && request.getPhone() != null && !request.getPhone().trim().equals(String.valueOf(before.getPhone()).trim());
        return "emailChanged=" + emailChanged
                + ",phoneChanged=" + phoneChanged
                + ",emailDomain=" + emailDomain(requestedEmail);
    }

    private String normalizeNullableEmail(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String emailDomain(String email) {
        if (email == null) {
            return "";
        }
        int at = email.indexOf('@');
        return at >= 0 && at < email.length() - 1 ? email.substring(at + 1) : "";
    }

    @ExceptionHandler(EmailLoginException.class)
    public ResponseEntity<?> handleEmailLoginException(EmailLoginException e) {
        HttpStatus status = "TOO_MANY_ATTEMPTS".equals(e.getCode())
                ? HttpStatus.TOO_MANY_REQUESTS
                : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(emailCodeError(e.getCode(), e.getMessage(), e.getRetryAfterSeconds()));
    }

    public static class AdminBootstrapRequest {
        @NotBlank
        @Size(min = 3, max = 50)
        private String username;

        @NotBlank
        @Size(min = 10, max = 128)
        private String password;

        @NotBlank
        @Email
        @Size(max = 120)
        private String email;

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
    }
}
