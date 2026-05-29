package com.example.shop.controller;

import com.example.shop.dto.PetProfileResponse;
import com.example.shop.entity.PetProfile;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.PetProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/pet-profiles")
@RequiredArgsConstructor
public class PetProfileController {
    private final PetProfileService petProfileService;

    @GetMapping
    public ResponseEntity<List<PetProfileResponse>> mine(Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        List<PetProfileResponse> responses = petProfileService.findByUserId(userDetails.getId()).stream()
                .map(PetProfileResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody(required = false) PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            PetProfile saved = petProfileService.save(userDetails.getId(), request, null);
            return ResponseEntity.ok(PetProfileResponse.from(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody(required = false) PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            PetProfile saved = petProfileService.save(userDetails.getId(), request, id);
            return ResponseEntity.ok(PetProfileResponse.from(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        petProfileService.delete(userDetails.getId(), id);
        return ResponseEntity.ok().build();
    }
}
