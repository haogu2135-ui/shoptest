package com.example.shop.controller;

import com.example.shop.dto.WishlistItemResponse;
import com.example.shop.entity.Wishlist;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/wishlist")
@RequiredArgsConstructor
public class WishlistController {
    private final WishlistService wishlistService;

    @GetMapping
    public List<WishlistItemResponse> getWishlist(@RequestParam(required = false) Long userId, Authentication authentication) {
        return toResponses(wishlistService.getWishlist(resolveWishlistUserId(userId, authentication)));
    }

    @GetMapping("/me")
    public List<WishlistItemResponse> getMyWishlist(Authentication authentication) {
        return toResponses(wishlistService.getWishlist(SecurityUtils.requireUser(authentication).getId()));
    }

    @GetMapping("/check")
    public Map<String, Boolean> check(@RequestParam(required = false) Long userId, @RequestParam Long productId, Authentication authentication) {
        return Map.of("wishlisted", wishlistService.isWishlisted(resolveWishlistUserId(userId, authentication), productId));
    }

    @GetMapping("/me/check")
    public Map<String, Boolean> checkMine(@RequestParam Long productId, Authentication authentication) {
        return Map.of("wishlisted", wishlistService.isWishlisted(SecurityUtils.requireUser(authentication).getId(), productId));
    }

    @GetMapping("/count")
    public Map<String, Integer> getCount(@RequestParam(required = false) Long userId, Authentication authentication) {
        return Map.of("count", wishlistService.getCount(resolveWishlistUserId(userId, authentication)));
    }

    @GetMapping("/me/count")
    public Map<String, Integer> getMyCount(Authentication authentication) {
        return Map.of("count", wishlistService.getCount(SecurityUtils.requireUser(authentication).getId()));
    }

    @PostMapping("/toggle")
    public Map<String, Object> toggle(@RequestParam(required = false) Long userId, @RequestParam Long productId, Authentication authentication) {
        Long effectiveUserId = resolveWishlistUserId(userId, authentication);
        wishlistService.toggleWishlist(effectiveUserId, productId);
        return Map.of("wishlisted", wishlistService.isWishlisted(effectiveUserId, productId));
    }

    @PostMapping("/me/toggle")
    public Map<String, Object> toggleMine(@RequestParam Long productId, Authentication authentication) {
        Long userId = SecurityUtils.requireUser(authentication).getId();
        wishlistService.toggleWishlist(userId, productId);
        return Map.of("wishlisted", wishlistService.isWishlisted(userId, productId));
    }

    @DeleteMapping
    public Map<String, String> remove(@RequestParam(required = false) Long userId, @RequestParam Long productId, Authentication authentication) {
        wishlistService.removeFromWishlist(resolveWishlistUserId(userId, authentication), productId);
        return Map.of("message", "Removed from wishlist");
    }

    @DeleteMapping("/me")
    public Map<String, String> removeMine(@RequestParam Long productId, Authentication authentication) {
        wishlistService.removeFromWishlist(SecurityUtils.requireUser(authentication).getId(), productId);
        return Map.of("message", "Removed from wishlist");
    }

    private Long resolveWishlistUserId(Long requestedUserId, Authentication authentication) {
        UserDetailsImpl currentUser = SecurityUtils.requireUser(authentication);
        if (requestedUserId == null) {
            return currentUser.getId();
        }
        SecurityUtils.assertSelf(authentication, requestedUserId);
        return requestedUserId;
    }

    private List<WishlistItemResponse> toResponses(List<Wishlist> items) {
        return items.stream()
                .map(WishlistItemResponse::from)
                .collect(Collectors.toList());
    }
}
