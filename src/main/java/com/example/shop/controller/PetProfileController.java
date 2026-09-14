package com.example.shop.controller;

import com.example.shop.dto.PetProfileResponse;
import com.example.shop.entity.PetProfile;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.PetProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@RestController
@RequestMapping("/pet-profiles")
@RequiredArgsConstructor
public class PetProfileController {
    private static final Function<PetProfile, PetProfileResponse> PROFILE_RESPONSE_FACTORY = PetProfileResponse::from;

    private final PetProfileService petProfileService;

    @GetMapping
    public ResponseEntity<List<PetProfileResponse>> mine(Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        List<PetProfile> profiles = petProfileService.findByUserId(userDetails.getId());
        if (profiles.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<PetProfileResponse> responses = new ArrayList<>(profiles.size());
        for (PetProfile profile : profiles) {
            responses.add(PROFILE_RESPONSE_FACTORY.apply(profile));
        }
        return ResponseEntity.ok(responses);
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody(required = false) PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
            PetProfile saved = petProfileService.save(userDetails.getId(), request, null);
            return ResponseEntity.ok(PetProfileResponse.from(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody(required = false) PetProfile request, Authentication authentication) {
        try {
            UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
            PetProfile saved = petProfileService.save(userDetails.getId(), request, id);
            return ResponseEntity.ok(PetProfileResponse.from(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);
        petProfileService.delete(userDetails.getId(), id);
        return ResponseEntity.ok().build();
    }
}
