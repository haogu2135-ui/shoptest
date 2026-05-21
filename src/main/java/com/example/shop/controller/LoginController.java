package com.example.shop.controller;

import com.example.shop.dto.EmailLoginCodeRequest;
import com.example.shop.dto.EmailLoginRequest;
import com.example.shop.entity.User;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.UserService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User loginRequest, HttpServletRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                    loginRequest.getUsername(),
                    loginRequest.getPassword()
                )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String jwt = jwtService.generateToken(userDetails);

            User user = userService.findByUsernameOrPhone(loginRequest.getUsername());

            auditLogService.record("LOGIN", "SUCCESS",
                    userDetails.getId(),
                    userDetails.getUsername(),
                    user != null ? user.getRole() : null,
                    "USER",
                    userDetails.getId(),
                    request,
                    "User login succeeded",
                    "login=" + safe(loginRequest.getUsername()));
            return ResponseEntity.ok(buildLoginResponse(jwt, userDetails, user));
        } catch (Exception e) {
            auditLogService.record("LOGIN", "FAILURE",
                    null,
                    safe(loginRequest.getUsername()),
                    null,
                    "USER",
                    null,
                    request,
                    "User login failed",
                    null);
            return ResponseEntity.badRequest().body("Invalid username or password");
        }
    }

    @PostMapping("/email-code")
    public ResponseEntity<?> sendEmailCode(@Valid @RequestBody EmailLoginCodeRequest codeRequest) {
        try {
            emailLoginService.sendLoginCode(codeRequest.getEmail());
            return ResponseEntity.ok(emailCodeResponse("Verification code sent"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(emailCodeError("RATE_LIMITED", "Please wait before requesting another code"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(emailCodeError("SEND_FAILED", "Unable to send verification code"));
        }
    }

    @PostMapping("/email-login")
    public ResponseEntity<?> emailLogin(@Valid @RequestBody EmailLoginRequest loginRequest, HttpServletRequest request) {
        try {
            User user = emailLoginService.verifyLoginCode(loginRequest.getEmail(), loginRequest.getCode());
            UserDetailsImpl userDetails = UserDetailsImpl.build(user);
            String jwt = jwtService.generateToken(userDetails);

            auditLogService.record("EMAIL_LOGIN", "SUCCESS",
                    userDetails.getId(),
                    userDetails.getUsername(),
                    user.getRole(),
                    "USER",
                    userDetails.getId(),
                    request,
                    "User email login succeeded",
                    "email=" + safe(loginRequest.getEmail()));
            return ResponseEntity.ok(buildLoginResponse(jwt, userDetails, user));
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
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_CODE",
                    "error", "Verification code expired or invalid"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(Authentication authentication, HttpServletRequest request) {
        auditLogService.record("LOGOUT", "SUCCESS", authentication, "USER", null, request, "User logout", null);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    private String safe(String value) {
        return value == null ? null : value.trim();
    }

    private Map<String, Object> emailCodeResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", message);
        response.put("codeTtlMinutes", emailLoginService.codeTtlMinutes());
        response.put("resendIntervalSeconds", emailLoginService.resendIntervalSeconds());
        return response;
    }

    private Map<String, Object> emailCodeError(String code, String error) {
        Map<String, Object> response = emailCodeResponse(error);
        response.put("code", code);
        response.put("error", error);
        return response;
    }

    private Map<String, Object> buildLoginResponse(String jwt, UserDetailsImpl userDetails, User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", jwt);
        response.put("id", userDetails.getId());
        response.put("username", userDetails.getUsername());
        response.put("email", userDetails.getEmail());
        response.put("phone", user != null ? user.getPhone() : null);
        response.put("role", user != null ? user.getRole() : null);
        response.put("roleCode", user != null ? user.getRoleCode() : null);
        return response;
    }
} 
