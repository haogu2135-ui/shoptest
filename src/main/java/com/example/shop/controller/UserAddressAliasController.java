package com.example.shop.controller;

import com.example.shop.dto.UserAddressResponse;
import com.example.shop.entity.UserAddress;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.UserAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.ArrayList;

@RestController
@RequiredArgsConstructor
public class UserAddressAliasController {
    private final UserAddressService userAddressService;

    @GetMapping("/user/addresses")
    public List<UserAddressResponse> getMyAddresses(Authentication authentication) {
        List<UserAddress> addresses =
                userAddressService.getAddresses(SecurityUtils.requireUser(authentication).getId());
        List<UserAddressResponse> responses = new ArrayList<>(addresses.size());
        for (UserAddress address : addresses) {
            responses.add(UserAddressResponse.from(address));
        }
        return responses;
    }
}
