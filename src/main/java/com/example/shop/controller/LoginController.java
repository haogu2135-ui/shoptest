package com.example.shop.controller;

import com.example.shop.entity.User;
import com.example.shop.service.UserService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import javax.servlet.http.HttpServletRequest;
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

            Map<String, Object> response = new HashMap<>();
            response.put("token", jwt);
            response.put("id", userDetails.getId());
            response.put("username", userDetails.getUsername());
            response.put("email", userDetails.getEmail());
            response.put("phone", user != null ? user.getPhone() : null);
            response.put("role", user != null ? user.getRole() : null);
            response.put("roleCode", user != null ? user.getRoleCode() : null);

            auditLogService.record("LOGIN", "SUCCESS",
                    userDetails.getId(),
                    userDetails.getUsername(),
                    user != null ? user.getRole() : null,
                    "USER",
                    userDetails.getId(),
                    request,
                    "User login succeeded",
                    "login=" + safe(loginRequest.getUsername()));
            return ResponseEntity.ok(response);
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

    @PostMapping("/logout")
    public ResponseEntity<?> logout(Authentication authentication, HttpServletRequest request) {
        auditLogService.record("LOGOUT", "SUCCESS", authentication, "USER", null, request, "User logout", null);
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    private String safe(String value) {
        return value == null ? null : value.trim();
    }
} 
