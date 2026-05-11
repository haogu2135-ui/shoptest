package com.example.shop.controller;

import com.example.shop.entity.CartItem;
import com.example.shop.service.CartService;
import org.springframework.http.ResponseEntity;
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
    public List<CartItem> getCartItems(@RequestParam Long userId) {
        return cartService.getCartItems(userId);
    }
    
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestParam Long userId,
                         @RequestParam Long productId,
                         @RequestParam Integer quantity,
                         @RequestParam(required = false) String selectedSpecs) {
        try {
            cartService.addToCart(userId, productId, quantity, selectedSpecs);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @PutMapping("/update")
    public ResponseEntity<?> updateQuantity(@RequestParam Long cartItemId,
                             @RequestParam Integer quantity) {
        try {
            cartService.updateQuantity(cartItemId, quantity);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/remove/{cartItemId}")
    public void removeFromCart(@PathVariable Long cartItemId) {
        cartService.removeFromCart(cartItemId);
    }
    
    @DeleteMapping("/clear")
    public void clearCart(@RequestParam Long userId) {
        cartService.clearCart(userId);
    }
} 
