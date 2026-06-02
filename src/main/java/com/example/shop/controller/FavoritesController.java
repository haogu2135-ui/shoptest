package com.example.shop.controller;

import com.example.shop.dto.WishlistItemResponse;
import com.example.shop.entity.Wishlist;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class FavoritesController {
    private final WishlistService wishlistService;

    @GetMapping("/favorites")
    public List<WishlistItemResponse> getFavorites(Authentication authentication) {
        return toResponses(wishlistService.getWishlist(currentUserId(authentication)));
    }

    @PostMapping("/favorites")
    public Map<String, Object> addFavorite(@RequestBody(required = false) Map<String, Object> body,
                                           @RequestParam(required = false) Long productId,
                                           Authentication authentication) {
        Long effectiveProductId = productId == null ? toLong(body == null ? null : body.get("productId")) : productId;
        if (effectiveProductId == null || effectiveProductId <= 0) {
            throw new IllegalArgumentException("productId is required");
        }
        Long userId = currentUserId(authentication);
        wishlistService.addToWishlist(userId, effectiveProductId);
        return Map.of("wishlisted", wishlistService.isWishlisted(userId, effectiveProductId));
    }

    @DeleteMapping("/favorites")
    public Map<String, String> removeFavorite(@RequestParam Long productId, Authentication authentication) {
        wishlistService.removeFromWishlist(currentUserId(authentication), productId);
        return Map.of("message", "Removed from favorites");
    }

    private Long currentUserId(Authentication authentication) {
        return SecurityUtils.requireUser(authentication).getId();
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private List<WishlistItemResponse> toResponses(List<Wishlist> items) {
        return items.stream()
                .map(WishlistItemResponse::from)
                .collect(Collectors.toList());
    }
}
