package com.example.shop.controller;

import com.example.shop.entity.PetProfile;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.PetProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/pet-profiles")
@RequiredArgsConstructor
public class PetProfileController {
    private final PetProfileService petProfileService;

    @GetMapping
    public ResponseEntity<List<PetProfile>> mine(Authentication authentication) {
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return ResponseEntity.ok(petProfileService.findByUserId(userDetails.getId()));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            return ResponseEntity.ok(petProfileService.save(userDetails.getId(), request, null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            return ResponseEntity.ok(petProfileService.save(userDetails.getId(), request, id));
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
