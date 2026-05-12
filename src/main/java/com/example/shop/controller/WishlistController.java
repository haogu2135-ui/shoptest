package com.example.shop.controller;

import com.example.shop.entity.Wishlist;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/wishlist")
@RequiredArgsConstructor
public class WishlistController {
    private final WishlistService wishlistService;

    @GetMapping
    public List<Wishlist> getWishlist(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return wishlistService.getWishlist(userId);
    }

    @GetMapping("/check")
    public Map<String, Boolean> check(@RequestParam Long userId, @RequestParam Long productId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return Map.of("wishlisted", wishlistService.isWishlisted(userId, productId));
    }

    @GetMapping("/count")
    public Map<String, Integer> getCount(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return Map.of("count", wishlistService.getCount(userId));
    }

    @PostMapping("/toggle")
    public Map<String, Object> toggle(@RequestParam Long userId, @RequestParam Long productId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        wishlistService.toggleWishlist(userId, productId);
        return Map.of("wishlisted", wishlistService.isWishlisted(userId, productId));
    }

    @DeleteMapping
    public Map<String, String> remove(@RequestParam Long userId, @RequestParam Long productId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        wishlistService.removeFromWishlist(userId, productId);
        return Map.of("message", "Removed from wishlist");
    }
}
