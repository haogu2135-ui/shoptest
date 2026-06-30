package com.example.shop.controller;

import com.example.shop.dto.CartItemResponse;
import com.example.shop.entity.CartItem;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.CartService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CartControllerClearResponseTest {

    @Test
    void cartItemResponseIncludesProductFreeShippingPolicy() {
        CartItem item = new CartItem();
        item.setId(10L);
        item.setProductId(20L);
        item.setQuantity(2);
        item.setPrice(new BigDecimal("19.99"));
        item.setFreeShipping(Boolean.TRUE);
        item.setFreeShippingThreshold(new BigDecimal("49.00"));

        CartItemResponse response = CartItemResponse.from(item);

        assertEquals(Boolean.TRUE, response.getFreeShipping());
        assertEquals(new BigDecimal("49.00"), response.getFreeShippingThreshold());
    }

    @Test
    void clearCartReturnsMessageBodyForResolvedUser() {
        CartService cartService = mock(CartService.class);
        CartController controller = new CartController(cartService);

        ResponseEntity<Map<String, String>> response = controller.clearCart(null, authentication(42L));

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(Map.of("message", "Cart cleared"), response.getBody());
        verify(cartService).clearCart(42L);
    }

    @Test
    void clearMyCartReturnsMessageBody() {
        CartService cartService = mock(CartService.class);
        CartController controller = new CartController(cartService);

        ResponseEntity<Map<String, String>> response = controller.clearMyCart(authentication(7L));

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(Map.of("message", "Cart cleared"), response.getBody());
        verify(cartService).clearCart(7L);
    }

    @Test
    void cartWriteEndpointsDeclareQuantityBoundsBeforeServiceCalls() throws Exception {
        String controllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/CartController.java"));
        String requestSource = Files.readString(Path.of("src/main/java/com/example/shop/dto/CartAddRequest.java"));

        assertTrue(controllerSource.contains("@Validated"));
        assertTrue(controllerSource.contains("private static final int MAX_CART_REQUEST_QUANTITY = 999;"));
        assertTrue(controllerSource.contains("private static final int MAX_SELECTED_SPECS_LENGTH = 1000;"));
        assertTrue(controllerSource.contains("@RequestParam @Min(1) @Max(MAX_CART_REQUEST_QUANTITY) Integer quantity"));
        assertTrue(controllerSource.contains("@RequestParam(required = false) @Size(max = MAX_SELECTED_SPECS_LENGTH) String selectedSpecs"));
        assertTrue(requestSource.contains("@Max(MAX_CART_REQUEST_QUANTITY)"));
        assertTrue(requestSource.contains("@Size(max = 1000)"));
    }

    private static Authentication authentication(Long userId) {
        UserDetailsImpl principal = new UserDetailsImpl(
                userId,
                "user-" + userId,
                "user" + userId + "@example.com",
                "ACTIVE",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
