package com.example.shop.controller;

import com.example.shop.dto.UserAddressRequest;
import com.example.shop.dto.UserAddressResponse;
import com.example.shop.entity.UserAddress;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.UserAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/addresses")
@RequiredArgsConstructor
public class UserAddressController {
    private final UserAddressService userAddressService;

    @GetMapping
    public List<UserAddressResponse> getAddresses(@RequestParam(required = false) Long userId, Authentication authentication) {
        return toResponses(userAddressService.getAddresses(resolveAddressUserId(userId, authentication)));
    }

    @GetMapping("/me")
    public List<UserAddressResponse> getMyAddresses(Authentication authentication) {
        return toResponses(userAddressService.getAddresses(SecurityUtils.requireUser(authentication).getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserAddressResponse> getAddress(@PathVariable Long id, Authentication authentication) {
        UserAddress address = userAddressService.getAddress(id);
        if (address != null) {
            SecurityUtils.assertSelf(authentication, address.getUserId());
        }
        return address == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(UserAddressResponse.from(address));
    }

    @GetMapping("/default")
    public ResponseEntity<UserAddressResponse> getDefaultAddress(@RequestParam(required = false) Long userId, Authentication authentication) {
        UserAddress address = userAddressService.getDefaultAddress(resolveAddressUserId(userId, authentication));
        return address == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(UserAddressResponse.from(address));
    }

    @GetMapping("/me/default")
    public ResponseEntity<UserAddressResponse> getMyDefaultAddress(Authentication authentication) {
        UserAddress address = userAddressService.getDefaultAddress(SecurityUtils.requireUser(authentication).getId());
        return address == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(UserAddressResponse.from(address));
    }

    @PostMapping
    public ResponseEntity<?> addAddress(@Valid @RequestBody(required = false) UserAddressRequest request, Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Address is required");
        }
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        UserAddress address = request.toEntity(user.getId());
        try {
            userAddressService.addAddress(address);
            UserAddress saved = address.getId() == null ? address : userAddressService.getAddress(address.getId());
            return ResponseEntity.ok(UserAddressResponse.from(saved));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAddress(@PathVariable Long id, @Valid @RequestBody(required = false) UserAddressRequest request, Authentication authentication) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Address is required");
        }
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, existing.getUserId());
        UserAddress address = request.toEntity(existing.getUserId());
        address.setId(id);
        address.setIsDefault(existing.getIsDefault());
        try {
            userAddressService.updateAddress(address);
            UserAddress updated = userAddressService.getAddress(id);
            return ResponseEntity.ok(UserAddressResponse.from(updated == null ? address : updated));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAddress(@PathVariable Long id, Authentication authentication) {
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, existing.getUserId());
        try {
            userAddressService.deleteAddress(id);
            return ResponseEntity.ok(Map.of("message", "Deleted"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/default")
    public ResponseEntity<?> setDefault(@PathVariable Long id, Authentication authentication) {
        UserAddress existing = userAddressService.getAddress(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, existing.getUserId());
        userAddressService.setDefault(id);
        return ResponseEntity.ok(Map.of("message", "Default address set"));
    }

    private Long resolveAddressUserId(Long requestedUserId, Authentication authentication) {
        UserDetailsImpl currentUser = SecurityUtils.requireUser(authentication);
        if (requestedUserId == null) {
            return currentUser.getId();
        }
        SecurityUtils.assertSelf(authentication, requestedUserId);
        return requestedUserId;
    }

    private List<UserAddressResponse> toResponses(List<UserAddress> addresses) {
        return addresses.stream()
                .map(UserAddressResponse::from)
                .collect(Collectors.toList());
    }
}
