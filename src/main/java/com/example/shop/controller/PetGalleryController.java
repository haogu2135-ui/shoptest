package com.example.shop.controller;

import com.example.shop.dto.PetGalleryQuota;
import com.example.shop.dto.PetGalleryPhotoPublicResponse;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.PetGalleryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/pet-gallery")
@RequiredArgsConstructor
public class PetGalleryController {
    private final PetGalleryService petGalleryService;
    private final ClientIpResolver clientIpResolver;

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "24") Integer size,
            Authentication authentication,
            HttpServletRequest request) {
        UserDetailsImpl userDetails = optionalUser(authentication);
        Long viewerId = userDetails == null ? null : userDetails.getId();
        String clientIp = resolveClientIp(request);

        if (page != null && page > 0) {
            Page<PetGalleryPhoto> result = petGalleryService.findPublicPhotos(viewerId, clientIp, page - 1, size);
            Map<String, Object> response = new HashMap<>();
            response.put("items", publicPhotos(result.getContent()));
            response.put("page", result.getNumber() + 1);
            response.put("size", result.getSize());
            response.put("total", result.getTotalElements());
            response.put("pages", result.getTotalPages());
            return ResponseEntity.ok(response);
        }
        List<PetGalleryPhoto> photos = petGalleryService.findPublicPhotos(viewerId, clientIp);
        return ResponseEntity.ok(publicPhotos(photos));
    }

    @GetMapping("/quota")
    public ResponseEntity<PetGalleryQuota> quota(Authentication authentication, HttpServletRequest request) {
        UserDetailsImpl userDetails = requireUser(authentication);
        return ResponseEntity.ok(petGalleryService.getQuota(userDetails.getId(), resolveClientIp(request)));
    }

    @PostMapping
    public ResponseEntity<PetGalleryPhotoPublicResponse> upload(
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
        return ResponseEntity.ok(PetGalleryPhotoPublicResponse.from(photo));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<PetGalleryPhotoPublicResponse> like(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request) {
        UserDetailsImpl userDetails = optionalUser(authentication);
        Long userId = userDetails == null ? null : userDetails.getId();
        return ResponseEntity.ok(PetGalleryPhotoPublicResponse.from(petGalleryService.like(id, userId, resolveClientIp(request))));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        UserDetailsImpl userDetails = requireUser(authentication);
        petGalleryService.deleteOwnUpload(id, userDetails.getId());
        return ResponseEntity.noContent().build();
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
        return clientIpResolver.resolve(request);
    }

    private List<PetGalleryPhotoPublicResponse> publicPhotos(List<PetGalleryPhoto> photos) {
        return photos.stream()
                .map(PetGalleryPhotoPublicResponse::from)
                .collect(Collectors.toList());
    }
}
