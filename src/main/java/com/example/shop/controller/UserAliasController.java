package com.example.shop.controller;

import com.example.shop.dto.UserProfileResponse;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class UserAliasController {
    private final UserService userService;

    @GetMapping("/user/profile")
    public UserProfileResponse getProfile(Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        return UserProfileResponse.from(userService.findById(userDetails.getId()));
    }
}
