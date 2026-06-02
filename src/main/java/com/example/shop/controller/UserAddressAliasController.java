package com.example.shop.controller;

import com.example.shop.dto.UserAddressResponse;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.UserAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class UserAddressAliasController {
    private final UserAddressService userAddressService;

    @GetMapping("/user/addresses")
    public List<UserAddressResponse> getMyAddresses(Authentication authentication) {
        return userAddressService.getAddresses(SecurityUtils.requireUser(authentication).getId()).stream()
                .map(UserAddressResponse::from)
                .collect(Collectors.toList());
    }
}
