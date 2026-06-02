package com.example.shop.controller;

import com.example.shop.dto.EmailLoginCodeRequest;
import com.example.shop.dto.EmailLoginRequest;
import com.example.shop.dto.LoginRequest;
import com.example.shop.entity.User;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.TokenBlacklistService;
import com.example.shop.service.UserService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class LoginController {
    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final SecurityAuditLogService auditLogService;
    private final EmailLoginService emailLoginService;
    private final IpBlacklistService ipBlacklistService;
    private final TokenBlacklistService tokenBlacklistService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody(required = false) LoginRequest loginRequest, HttpServletRequest request) {
        String clientIp = clientKey(request);
        String login = normalizeLogin(loginRequest == null ? null : loginRequest.getUsername());
        String password = loginRequest == null ? null : loginRequest.getPassword();
        if (login == null || login.isBlank() || password == null || password.isBlank()) {
            auditLogService.record("LOGIN", "FAILURE",
                    null,
                    login,
                    null,
                    "USER",
                    null,
                    request,
                    "User login failed",
                    "missing_credentials=true");
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid username or password"));
        }
        User loginAccount = login == null ? null : userService.findByUsernameOrPhoneOrEmail(login);
        String authenticationLogin = loginAccount != null && loginAccount.getUsername() != null && !loginAccount.getUsername().isBlank()
                ? normalizeLogin(loginAccount.getUsername())
                : login;

        // Check IP-based rate limiting
        if (tokenBlacklistService.isLoginRateLimited(clientIp)) {
            auditLogService.record("LOGIN", "BLOCKED", null, login, null,
                    "USER", null, request, "Login rate limited", "ip=" + clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many login attempts. Please try again later."));
        }

        // Check account lockout
        if (isLoginAccountLocked(login, loginAccount)) {
            auditLogService.record("LOGIN", "BLOCKED", null, login, null,
                    "USER", null, request, "Account locked", null);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Account temporarily locked due to too many failed attempts. Please try again later."));
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    authenticationLogin,
                    password
                )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String jwt = jwtService.generateToken(userDetails);
            String refreshToken = tokenBlacklistService.generateRefreshToken();
            String accountKey = normalizeLogin(userDetails.getUsername());
            tokenBlacklistService.storeRefreshToken(refreshToken, accountKey);

            // Clear login failures on successful login
            tokenBlacklistService.clearLoginFailures(clientIp);
            clearAccountFailureKeys(login, loginAccount);

            User user = userService.findById(userDetails.getId());

            auditLogService.record("LOGIN", "SUCCESS",
                    userDetails.getId(),
                    userDetails.getUsername(),
                    user != null ? user.getRole() : null,
                    "USER",
                    userDetails.getId(),
                    request,
                    "User login succeeded",
                    "login=" + login);
            return ResponseEntity.ok(buildLoginResponse(jwt, refreshToken, userDetails, user));
        } catch (AuthenticationException e) {
            auditLogService.record("LOGIN", "FAILURE",
                    null,
                    login,
                    null,
                    "USER",
                    null,
                    request,
                    "User login failed",
                    null);
            ipBlacklistService.recordLoginFailure(request, "Invalid username or password");
            tokenBlacklistService.recordLoginFailure(clientIp, accountLockKey(login, loginAccount));
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid username or password"));
        } catch (IllegalStateException e) {
            auditLogService.record("LOGIN", "FAILURE",
                    loginAccount != null ? loginAccount.getId() : null,
                    login,
                    loginAccount != null ? loginAccount.getRole() : null,
                    "USER",
                    loginAccount != null ? loginAccount.getId() : null,
                    request,
                    "Login service unavailable",
                    e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "error", "Login service is temporarily unavailable. Please try again later.",
                            "code", "LOGIN_SERVICE_UNAVAILABLE"));
        } catch (Exception e) {
            auditLogService.record("LOGIN", "FAILURE",
                    loginAccount != null ? loginAccount.getId() : null,
                    login,
                    loginAccount != null ? loginAccount.getRole() : null,
                    "USER",
                    loginAccount != null ? loginAccount.getId() : null,
                    request,
                    "Login failed after credentials were accepted",
                    e.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "error", "Login service is temporarily unavailable. Please try again later.",
                            "code", "LOGIN_SERVICE_UNAVAILABLE"));
        }
    }

    @PostMapping("/email-code")
    public ResponseEntity<?> sendEmailCode(@Valid @RequestBody(required = false) EmailLoginCodeRequest codeRequest, HttpServletRequest request) {
        if (codeRequest == null) {
            return ResponseEntity.badRequest().body(emailCodeError("INVALID_REQUEST", "Email payload is required"));
        }
        try {
            emailLoginService.sendLoginCode(codeRequest.getEmail(), clientKey(request));
            return ResponseEntity.ok(emailCodeResponse("Verification code sent"));
        } catch (EmailLoginException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(emailCodeError(e.getCode(), e.getMessage(), e.getRetryAfterSeconds()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(emailCodeError("SEND_FAILED", "Unable to send verification code"));
        }
    }

    @PostMapping("/password-reset-code")
    public ResponseEntity<?> sendPasswordResetCode(@Valid @RequestBody(required = false) EmailLoginCodeRequest codeRequest, HttpServletRequest request) {
        if (codeRequest == null) {
            return ResponseEntity.badRequest().body(emailCodeError("INVALID_REQUEST", "Email payload is required"));
        }
        try {
            emailLoginService.sendPasswordResetCode(codeRequest.getEmail(), clientKey(request));
            return ResponseEntity.ok(emailCodeResponse("Verification code sent"));
        } catch (EmailLoginException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(emailCodeError(e.getCode(), e.getMessage(), e.getRetryAfterSeconds()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(emailCodeError("SEND_FAILED", "Unable to send verification code"));
        }
    }

    @PostMapping("/email-login")
    public ResponseEntity<?> emailLogin(@Valid @RequestBody(required = false) EmailLoginRequest loginRequest, HttpServletRequest request) {
        if (loginRequest == null) {
            return ResponseEntity.badRequest().body(emailCodeError("INVALID_REQUEST", "Email login payload is required"));
        }
        try {
            User user = emailLoginService.verifyLoginCode(loginRequest.getEmail(), loginRequest.getCode(), clientKey(request));
            UserDetailsImpl userDetails = UserDetailsImpl.build(user);
            String jwt = jwtService.generateToken(userDetails);
            String refreshToken = tokenBlacklistService.generateRefreshToken();
            tokenBlacklistService.storeRefreshToken(refreshToken, normalizeLogin(userDetails.getUsername()));

            auditLogService.record("EMAIL_LOGIN", "SUCCESS",
                    userDetails.getId(),
                    userDetails.getUsername(),
                    user.getRole(),
                    "USER",
                    userDetails.getId(),
                    request,
                    "User email login succeeded",
                    "email=" + safe(loginRequest.getEmail()));
            return ResponseEntity.ok(buildLoginResponse(jwt, refreshToken, userDetails, user));
        } catch (Exception e) {
            auditLogService.record("EMAIL_LOGIN", "FAILURE",
                    null,
                    safe(loginRequest.getEmail()),
                    null,
                    "USER",
                    null,
                    request,
                    "User email login failed",
                    null);
            ipBlacklistService.recordLoginFailure(request, e instanceof EmailLoginException ? ((EmailLoginException) e).getCode() : "Invalid email login code");
            if (e instanceof EmailLoginException) {
                EmailLoginException loginException = (EmailLoginException) e;
                HttpStatus status = "TOO_MANY_ATTEMPTS".equals(loginException.getCode())
                        ? HttpStatus.TOO_MANY_REQUESTS
                        : HttpStatus.BAD_REQUEST;
                return ResponseEntity.status(status)
                        .body(emailCodeError(loginException.getCode(), loginException.getMessage(), loginException.getRetryAfterSeconds()));
            }
            if (e instanceof IllegalStateException) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(emailCodeError("CODE_SERVICE_UNAVAILABLE", "Verification service is temporarily unavailable"));
            }
            return ResponseEntity.badRequest().body(emailCodeError("INVALID_CODE", "Verification code expired or invalid"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody(required = false) Map<String, String> body,
                                    Authentication authentication,
                                    HttpServletRequest request) {
        // Blacklist the current access token
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7);
                String jti = jwtService.extractJti(token);
                if (jti != null) {
                    long remainingMs = jwtService.getExpirationMs(token);
                    tokenBlacklistService.blacklistAccessToken(jti, remainingMs);
                }
            } catch (Exception ignored) {
            }
        }

        String refreshToken = body == null ? null : body.get("refreshToken");
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokenBlacklistService.revokeRefreshToken(refreshToken.trim());
        }
        auditLogService.record("LOGOUT", "SUCCESS", authentication, "USER", null, request, "User logout", null);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody(required = false) Map<String, String> body, HttpServletRequest request) {
        String refreshToken = body == null ? null : safe(body.get("refreshToken"));
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "refreshToken is required"));
        }
        String username = normalizeLogin(tokenBlacklistService.consumeRefreshToken(refreshToken));
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired refresh token"));
        }
        User user = userService.findByUsernameOrPhoneOrEmail(username);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "User not found"));
        }
        UserDetailsImpl userDetails = UserDetailsImpl.build(user);
        String newAccessToken = jwtService.generateToken(userDetails);
        String newRefreshToken = tokenBlacklistService.generateRefreshToken();
        tokenBlacklistService.storeRefreshToken(newRefreshToken, username);

        auditLogService.record("TOKEN_REFRESH", "SUCCESS",
                userDetails.getId(), userDetails.getUsername(), user.getRole(),
                "USER", userDetails.getId(), request, "Token refreshed", null);
        return ResponseEntity.ok(buildLoginResponse(newAccessToken, newRefreshToken, userDetails, user));
    }

    private String safe(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeLogin(String value) {
        String login = value == null ? null : value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (login == null) {
            return null;
        }
        return login.contains("@") ? login.toLowerCase() : login;
    }

    private boolean isLoginAccountLocked(String login, User account) {
        String primaryKey = accountLockKey(login, account);
        if (primaryKey != null && tokenBlacklistService.isAccountLocked(primaryKey)) {
            return true;
        }
        return isLockedIfPresent(login)
                || isLockedIfPresent(account != null ? account.getEmail() : null)
                || isLockedIfPresent(account != null ? account.getPhone() : null);
    }

    private boolean isLockedIfPresent(String value) {
        String normalized = normalizeLogin(value);
        return normalized != null && tokenBlacklistService.isAccountLocked(normalized);
    }

    private String accountLockKey(String login, User account) {
        if (account != null && account.getUsername() != null && !account.getUsername().isBlank()) {
            return normalizeLogin(account.getUsername());
        }
        return normalizeLogin(login);
    }

    private void clearAccountFailureKeys(String login, User account) {
        tokenBlacklistService.clearAccountFailures(accountLockKey(login, account));
        tokenBlacklistService.clearAccountFailures(login);
        if (account != null) {
            tokenBlacklistService.clearAccountFailures(account.getEmail());
            tokenBlacklistService.clearAccountFailures(account.getPhone());
        }
    }

    private Map<String, Object> emailCodeResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", message);
        response.put("codeTtlMinutes", emailLoginService.codeTtlMinutes());
        response.put("resendIntervalSeconds", emailLoginService.resendIntervalSeconds());
        return response;
    }

    private Map<String, Object> emailCodeError(String code, String error) {
        return emailCodeError(code, error, 0);
    }

    private Map<String, Object> emailCodeError(String code, String error, long retryAfterSeconds) {
        Map<String, Object> response = emailCodeResponse(error);
        response.put("code", code);
        response.put("error", error);
        if (retryAfterSeconds > 0) {
            response.put("retryAfterSeconds", retryAfterSeconds);
        }
        return response;
    }

    private String clientKey(HttpServletRequest request) {
        return clientIpResolver.resolve(request);
    }

    private Map<String, Object> buildLoginResponse(String jwt, String refreshToken, UserDetailsImpl userDetails, User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        response.put("refreshToken", refreshToken);
        response.put("id", userDetails.getId());
        response.put("username", userDetails.getUsername());
        response.put("email", userDetails.getEmail());
        response.put("phone", user != null ? user.getPhone() : null);
        response.put("role", user != null ? user.getRole() : null);
        response.put("roleCode", user != null ? user.getRoleCode() : null);
        return response;
    }
} 
