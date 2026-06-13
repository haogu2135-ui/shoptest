package com.example.shop.service;

import com.example.shop.entity.CartItem;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CartServiceTest {
    private CartItemMapper cartItemMapper;
    private CartService service;

    @BeforeEach
    void setUp() {
        cartItemMapper = mock(CartItemMapper.class);
        ProductRepository productRepository = mock(ProductRepository.class);
        ProductVariantService productVariantService = mock(ProductVariantService.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        service = new CartService(cartItemMapper, productRepository, productVariantService, runtimeConfig);
    }

    @Test
    void calculateTotalAmountKeepsMonetaryScale() {
        when(cartItemMapper.findByUserId(7L)).thenReturn(List.of(
                cartItem("33.33", 1),
                cartItem("33.33", 1),
                cartItem("33.33", 1)));

        assertEquals(new BigDecimal("99.99"), service.calculateTotalAmount(7L));
        assertEquals(new BigDecimal("99.99"), service.calculateTotal(7L));
    }

    @Test
    void calculateTotalAmountRoundsHalfUpToCents() {
        when(cartItemMapper.findByUserId(9L)).thenReturn(List.of(cartItem("10.005", 1)));

        assertEquals(new BigDecimal("10.01"), service.calculateTotalAmount(9L));
    }

    @Test
    void calculateTotalAmountRoundsEachLineBeforeSumming() {
        when(cartItemMapper.findByUserId(9L)).thenReturn(List.of(
                cartItem("10.005", 1),
                cartItem("10.005", 1)));

        assertEquals(new BigDecimal("20.02"), service.calculateTotalAmount(9L));
    }

    @Test
    void removeFromCartDeletesByCartItemIdOnly() {
        service.removeFromCart(123L);

        verify(cartItemMapper).deleteById(123L);
    }

    @Test
    void cartItemMapperHasNoLegacyVariantDeletePath() throws Exception {
        String mapperXml = Files.readString(Path.of("src/main/resources/mapper/CartItemMapper.xml"));
        String mapperInterface = Files.readString(Path.of("src/main/java/com/example/shop/repository/CartItemMapper.java"));

        assertFalse(mapperXml.contains("variant_id"));
        assertFalse(mapperXml.contains("variantId"));
        assertFalse(mapperInterface.contains("variantId"));
    }

    private CartItem cartItem(String price, Integer quantity) {
        CartItem item = new CartItem();
        item.setPrice(new BigDecimal(price));
        item.setQuantity(quantity);
        return item;
    }
}
