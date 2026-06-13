package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.shop.entity.CartItem;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CartMoneyPrecisionContractTest {

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
    void calculateTotalAmountUsesDecimalMoneyInsteadOfDoubleAccumulation() {
        when(cartItemMapper.findByUserId(7L)).thenReturn(List.of(
                cartItem("33.33", 1),
                cartItem("33.33", 1),
                cartItem("33.33", 1)));

        assertEquals(new BigDecimal("99.99"), service.calculateTotalAmount(7L));
        assertEquals(new BigDecimal("99.99"), service.calculateTotal(7L));
    }

    @Test
    void calculateTotalAmountRoundsEachCartLineToCentsBeforeSumming() {
        when(cartItemMapper.findByUserId(9L)).thenReturn(List.of(
                cartItem("10.005", 1),
                cartItem("10.005", 1)));

        assertEquals(new BigDecimal("20.02"), service.calculateTotalAmount(9L));
    }

    @Test
    void cartServiceKeepsInternalMoneyMathOnBigDecimal() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/service/CartService.java"), StandardCharsets.UTF_8);
        String totalAmount = methodBlock(source, "public BigDecimal calculateTotalAmount(Long userId)");
        String total = methodBlock(source, "public BigDecimal calculateTotal(Long userId)");

        assertFalse(source.contains("public double calculateTotal("));
        assertTrue(totalAmount.contains(".map(this::calculateLineAmount)"));
        assertTrue(totalAmount.contains(".reduce(BigDecimal.ZERO, BigDecimal::add)"));
        assertFalse(totalAmount.contains("mapToDouble"));
        assertFalse(totalAmount.contains(".doubleValue()"));
        assertTrue(total.contains("return calculateTotalAmount(userId);"));
        assertFalse(total.contains(".doubleValue()"));
    }

    private static CartItem cartItem(String price, Integer quantity) {
        CartItem item = new CartItem();
        item.setPrice(new BigDecimal(price));
        item.setQuantity(quantity);
        return item;
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
