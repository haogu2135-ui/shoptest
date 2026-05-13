package com.example.shop.controller;

import com.example.shop.entity.User;
import com.example.shop.service.UserService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import javax.validation.Valid;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @Value("${admin.bootstrap-token:}")
    private String adminBootstrapToken;
    
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
    public void updatePassword(@RequestParam Long userId,
                             @RequestParam String oldPassword,
                             @RequestParam String newPassword,
                             Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        userService.updatePassword(userId, oldPassword, newPassword);
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
        if (isBlank(adminBootstrapToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin bootstrap is not configured");
        }
        if (isBlank(bootstrapToken) || !adminBootstrapToken.equals(bootstrapToken.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid admin bootstrap token");
        }
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
