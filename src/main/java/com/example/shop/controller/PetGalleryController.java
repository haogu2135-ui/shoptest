package com.example.shop.controller;

import com.example.shop.dto.PetGalleryQuota;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.PetGalleryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/pet-gallery")
@RequiredArgsConstructor
public class PetGalleryController {
    private final PetGalleryService petGalleryService;

    @GetMapping
    public ResponseEntity<List<PetGalleryPhoto>> list(Authentication authentication, HttpServletRequest request) {
        UserDetailsImpl userDetails = optionalUser(authentication);
        Long viewerId = userDetails == null ? null : userDetails.getId();
        return ResponseEntity.ok(petGalleryService.findPublicPhotos(viewerId, resolveClientIp(request)));
    }

    @GetMapping("/quota")
    public ResponseEntity<PetGalleryQuota> quota(Authentication authentication, HttpServletRequest request) {
        UserDetailsImpl userDetails = requireUser(authentication);
        return ResponseEntity.ok(petGalleryService.getQuota(userDetails.getId(), resolveClientIp(request)));
    }

    @PostMapping
    public ResponseEntity<PetGalleryPhoto> upload(
            @RequestParam("file") MultipartFile file,
            Authentication authentication,
            HttpServletRequest request) {
        UserDetailsImpl userDetails = requireUser(authentication);
        PetGalleryPhoto photo = petGalleryService.upload(
            userDetails.getId(),
            userDetails.getUsername(),
            resolveClientIp(request),
            file
        );
        return ResponseEntity.ok(photo);
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<PetGalleryPhoto> like(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request) {
        UserDetailsImpl userDetails = optionalUser(authentication);
        Long userId = userDetails == null ? null : userDetails.getId();
        return ResponseEntity.ok(petGalleryService.like(id, userId, resolveClientIp(request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        UserDetailsImpl userDetails = requireUser(authentication);
        petGalleryService.deleteOwnUpload(id, userDetails.getId());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getReason()));
    }

    private UserDetailsImpl requireUser(Authentication authentication) {
        UserDetailsImpl userDetails = optionalUser(authentication);
        if (userDetails == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return userDetails;
    }

    private UserDetailsImpl optionalUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            return null;
        }
        return (UserDetailsImpl) authentication.getPrincipal();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.trim().isEmpty()) {
            String first = forwardedFor.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.trim().isEmpty()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
