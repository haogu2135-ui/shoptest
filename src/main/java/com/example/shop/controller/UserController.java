package com.example.shop.controller;

import com.example.shop.entity.User;
import com.example.shop.service.UserService;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import javax.validation.Valid;

@RestController
@RequestMapping("/users")
@CrossOrigin(originPatterns = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://10.*:*",
        "http://172.*:*",
        "http://192.168.*:*"
})
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    
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
    public void createAdmin() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("123456");
        admin.setEmail("admin@example.com");
        admin.setRole("ADMIN");
        userService.registerAdmin(admin);
    }
} 
