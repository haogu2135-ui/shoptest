package com.example.shop.controller;

import com.example.shop.entity.CartItem;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.CartService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/cart")
@RequiredArgsConstructor
public class CartController {
    private final CartService cartService;
    
    @GetMapping
    public List<CartItem> getCartItems(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return cartService.getCartItems(userId);
    }

    @GetMapping("/me")
    public List<CartItem> getMyCartItems(Authentication authentication) {
        return cartService.getCartItems(SecurityUtils.requireUser(authentication).getId());
    }
    
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestParam Long userId,
                         @RequestParam Long productId,
                         @RequestParam Integer quantity,
                         @RequestParam(required = false) String selectedSpecs,
                         Authentication authentication) {
        try {
            SecurityUtils.assertSelfOrAdmin(authentication, userId);
            cartService.addToCart(userId, productId, quantity, selectedSpecs);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/me/add")
    public ResponseEntity<?> addToMyCart(@RequestParam Long productId,
                         @RequestParam Integer quantity,
                         @RequestParam(required = false) String selectedSpecs,
                         Authentication authentication) {
        try {
            cartService.addToCart(SecurityUtils.requireUser(authentication).getId(), productId, quantity, selectedSpecs);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @PutMapping("/update")
    public ResponseEntity<?> updateQuantity(@RequestParam Long cartItemId,
                             @RequestParam Integer quantity,
                             Authentication authentication) {
        try {
            CartItem item = cartService.getCartItem(cartItemId);
            if (item == null) {
                return ResponseEntity.notFound().build();
            }
            SecurityUtils.assertSelfOrAdmin(authentication, item.getUserId());
            cartService.updateQuantity(cartItemId, quantity);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/remove/{cartItemId}")
    public ResponseEntity<?> removeFromCart(@PathVariable Long cartItemId, Authentication authentication) {
        CartItem item = cartService.getCartItem(cartItemId);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelfOrAdmin(authentication, item.getUserId());
        cartService.removeFromCart(cartItemId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/remove")
    public ResponseEntity<?> removeCartItems(@RequestParam List<Long> cartItemIds, Authentication authentication) {
        if (cartItemIds == null || cartItemIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No cart items selected"));
        }
        try {
            cartService.removeFromCart(cartItemIds, authentication);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/clear")
    public void clearCart(@RequestParam Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        cartService.clearCart(userId);
    }

    @DeleteMapping("/me/clear")
    public void clearMyCart(Authentication authentication) {
        cartService.clearCart(SecurityUtils.requireUser(authentication).getId());
    }
} 
