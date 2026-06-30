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
import static org.junit.jupiter.api.Assertions.assertTrue;
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

    @Test
    void addToCartSerializesProductAndLineStockValidation() throws Exception {
        String cartService = Files.readString(Path.of("src/main/java/com/example/shop/service/CartService.java"));
        String productRepository = Files.readString(Path.of("src/main/java/com/example/shop/repository/ProductRepository.java"));
        String mapperXml = Files.readString(Path.of("src/main/resources/mapper/CartItemMapper.xml"));

        assertTrue(cartService.contains("@Transactional(rollbackFor = Exception.class)\n"
                + "    public void addToCart(Long userId, Long productId, Integer quantity, String selectedSpecs)"));
        assertTrue(cartService.contains("Product product = requirePurchasableProductForUpdate(productId, normalizedQuantity);"));
        assertTrue(cartService.contains("productRepository.findByIdForUpdate(productId);"));
        assertTrue(cartService.contains("cartItemMapper.findByUserIdAndProductIdAndSelectedSpecsForUpdate"));
        assertTrue(cartService.contains("productVariantService.validateSelection(product, normalizedSpecs);"));
        assertTrue(cartService.contains("Integer availableStock = productVariantService.resolveStock(product, normalizedSpecs);"));
        assertTrue(cartService.contains("if (availableStock == null || availableStock < requestedQuantity)"));
        assertTrue(productRepository.contains("@Lock(LockModeType.PESSIMISTIC_WRITE)\n"
                + "    @Query(\"select p from Product p where p.id = :id\")\n"
                + "    Product findByIdForUpdate(@Param(\"id\") Long id);"));
        assertTrue(mapperXml.contains("<select id=\"findByUserIdAndProductIdAndSelectedSpecsForUpdate\""));
        assertTrue(mapperXml.contains("LIMIT 1\n        FOR UPDATE"));
    }

    @Test
    void cartSnapshotRefreshBatchLoadsProducts() throws Exception {
        String cartService = Files.readString(Path.of("src/main/java/com/example/shop/service/CartService.java"));

        assertFalse(cartService.contains("convertSimpleVoToCartVo"));
        assertFalse(cartService.contains("getProductById("));
        assertTrue(cartService.contains("private void refreshCartItemSnapshots(List<CartItem> items)"));
        assertTrue(cartService.contains(".distinct()\n"
                + "                .collect(Collectors.toList());"));
        assertTrue(cartService.contains("productRepository.findAllById(productIds)"));
        assertTrue(cartService.contains("items.forEach(item -> refreshCartItemSnapshot(item, productById.get(item.getProductId())))"));
    }

    private CartItem cartItem(String price, Integer quantity) {
        CartItem item = new CartItem();
        item.setPrice(new BigDecimal(price));
        item.setQuantity(quantity);
        return item;
    }
}
