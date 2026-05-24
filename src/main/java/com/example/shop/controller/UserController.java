package com.example.shop.controller;

import com.example.shop.dto.UpdatePasswordRequest;
import com.example.shop.entity.User;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.UserService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import javax.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final RuntimeConfigService runtimeConfig;
    
    @PostMapping("/register")
    public void register(@Valid @RequestBody User user) {
        userService.register(user);
    }
    
    @PutMapping("/profile")
    public void updateProfile(@RequestBody User user, Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        user.setId(userDetails.getId());
        user.setRole(null);
        user.setStatus(null);
        user.setPassword(null);
        userService.update(user);
    }
    
    @PutMapping("/password")
    public void updatePassword(@Valid @RequestBody UpdatePasswordRequest request,
                               Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        userService.updatePassword(userDetails.getId(), request.getOldPassword(), request.getNewPassword());
    }
    
    @GetMapping("/profile")
    public User getProfile(Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return userService.findById(userDetails.getId());
    }

    @PostMapping("/create-admin")
    public void createAdmin(@Valid @RequestBody AdminBootstrapRequest request,
                            @RequestHeader(value = "X-Bootstrap-Token", required = false) String bootstrapToken) {
        assertAdminBootstrapToken(bootstrapToken);
        User admin = new User();
        admin.setUsername(request.getUsername().trim());
        admin.setPassword(request.getPassword());
        admin.setEmail(request.getEmail().trim());
        admin.setRole("ADMIN");
        userService.registerAdmin(admin);
    }

    private void assertAdminBootstrapToken(String bootstrapToken) {
        String adminBootstrapToken = runtimeConfig.getString("admin.bootstrap-token", "");
        if (isBlank(adminBootstrapToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin bootstrap is not configured");
        }
        if (isBlank(bootstrapToken) || !constantTimeEquals(adminBootstrapToken, bootstrapToken.trim())) {
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
