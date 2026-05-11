package com.example.shop.controller;

import com.example.shop.entity.UserAddress;
import com.example.shop.service.UserAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/addresses")
@RequiredArgsConstructor
public class UserAddressController {
    private final UserAddressService userAddressService;

    @GetMapping
    public List<UserAddress> getAddresses(@RequestParam Long userId) {
        return userAddressService.getAddresses(userId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserAddress> getAddress(@PathVariable Long id) {
        UserAddress address = userAddressService.getAddress(id);
        return address == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(address);
    }

    @GetMapping("/default")
    public ResponseEntity<UserAddress> getDefaultAddress(@RequestParam Long userId) {
        UserAddress address = userAddressService.getDefaultAddress(userId);
        return address == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(address);
    }

    @PostMapping
    public UserAddress addAddress(@RequestBody UserAddress address) {
        userAddressService.addAddress(address);
        return address;
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAddress(@PathVariable Long id, @RequestBody UserAddress address) {
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        address.setId(id);
        address.setUserId(existing.getUserId());
        userAddressService.updateAddress(address);
        return ResponseEntity.ok(address);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAddress(@PathVariable Long id) {
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        userAddressService.deleteAddress(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    @PutMapping("/{id}/default")
    public ResponseEntity<?> setDefault(@PathVariable Long id, @RequestParam Long userId) {
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        userAddressService.setDefault(id, userId);
        return ResponseEntity.ok(Map.of("message", "Default address set"));
    }
}
