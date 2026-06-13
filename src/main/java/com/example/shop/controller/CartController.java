package com.example.shop.controller;

import com.example.shop.dto.CartAddRequest;
import com.example.shop.dto.CartItemResponse;
import com.example.shop.entity.CartItem;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.CartService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.validation.annotation.Validated;

@RestController
@RequestMapping("/cart")
@RequiredArgsConstructor
@Validated
public class CartController {
    private static final int MAX_CART_REQUEST_QUANTITY = 999;

    private final CartService cartService;

    @GetMapping
    public List<CartItemResponse> getCartItems(@RequestParam(required = false) Long userId, Authentication authentication) {
        Long effectiveUserId = resolveCartUserId(userId, authentication);
        return toResponses(cartService.getCartItems(effectiveUserId));
    }

    @GetMapping("/me")
    public List<CartItemResponse> getMyCartItems(Authentication authentication) {
        return toResponses(cartService.getCartItems(SecurityUtils.requireUser(authentication).getId()));
    }

    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestParam @Min(1) Long userId,
                         @RequestParam @Min(1) Long productId,
                         @RequestParam @Min(1) @Max(MAX_CART_REQUEST_QUANTITY) Integer quantity,
                         @RequestParam(required = false) String selectedSpecs,
                         Authentication authentication) {
        try {
            SecurityUtils.assertSelf(authentication, userId);
            cartService.addToCart(userId, productId, quantity, selectedSpecs);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> addToCart(@Valid @RequestBody(required = false) CartAddRequest request,
                                       Authentication authentication) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cart item payload is required"));
        }
        try {
            Long userId = resolveCartUserId(request.getUserId(), authentication);
            cartService.addToCart(userId, request.getProductId(), request.getQuantity(), request.getSelectedSpecs());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/me/add")
    public ResponseEntity<?> addToMyCart(@RequestParam @Min(1) Long productId,
                         @RequestParam @Min(1) @Max(MAX_CART_REQUEST_QUANTITY) Integer quantity,
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
    public ResponseEntity<?> updateQuantity(@RequestParam @Min(1) Long cartItemId,
                             @RequestParam @Min(1) @Max(MAX_CART_REQUEST_QUANTITY) Integer quantity,
                             Authentication authentication) {
        try {
            CartItem item = cartService.getCartItem(cartItemId);
            if (item == null) {
                return ResponseEntity.notFound().build();
            }
            SecurityUtils.assertSelf(authentication, item.getUserId());
            cartService.updateQuantity(cartItemId, quantity);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/remove/{cartItemId}")
    public ResponseEntity<?> removeFromCart(@PathVariable Long cartItemId, Authentication authentication) {
        return removeSingleCartItem(cartItemId, authentication);
    }

    @DeleteMapping("/{cartItemId}")
    public ResponseEntity<?> removeFromCartById(@PathVariable Long cartItemId, Authentication authentication) {
        CartItem item = cartService.getCartItem(cartItemId);
        if (item == null) {
            return ResponseEntity.ok(Map.of("message", "Cart item already removed"));
        }
        SecurityUtils.assertSelf(authentication, item.getUserId());
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
    public ResponseEntity<Map<String, String>> clearCart(@RequestParam(required = false) Long userId,
                                                         Authentication authentication) {
        cartService.clearCart(resolveCartUserId(userId, authentication));
        return ResponseEntity.ok(Map.of("message", "Cart cleared"));
    }

    @DeleteMapping("/me/clear")
    public ResponseEntity<Map<String, String>> clearMyCart(Authentication authentication) {
        cartService.clearCart(SecurityUtils.requireUser(authentication).getId());
        return ResponseEntity.ok(Map.of("message", "Cart cleared"));
    }

    private Long resolveCartUserId(Long requestedUserId, Authentication authentication) {
        UserDetailsImpl currentUser = SecurityUtils.requireUser(authentication);
        if (requestedUserId == null) {
            return currentUser.getId();
        }
        SecurityUtils.assertSelf(authentication, requestedUserId);
        return requestedUserId;
    }

    private ResponseEntity<?> removeSingleCartItem(Long cartItemId, Authentication authentication) {
        CartItem item = cartService.getCartItem(cartItemId);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        SecurityUtils.assertSelf(authentication, item.getUserId());
        cartService.removeFromCart(cartItemId);
        return ResponseEntity.ok().build();
    }

    private List<CartItemResponse> toResponses(List<CartItem> items) {
        return items.stream()
                .map(CartItemResponse::from)
                .collect(Collectors.toList());
    }
}
