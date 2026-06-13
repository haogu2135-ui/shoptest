package com.example.shop.service;

import com.example.shop.dto.GuestCheckoutItemRequest;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.OrderItem;
import com.example.shop.entity.Product;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

import javax.persistence.EntityManager;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class OrderStockReservationServiceTest {
    private final ProductVariantService productVariantService = new ProductVariantService();

    @Test
    void guestCheckoutReservationLoadsProductsWithPessimisticLockBeforeStockMutation() {
        ProductRepository productRepository = mock(ProductRepository.class);
        EntityManager entityManager = managedEntityManager();
        OrderService service = serviceWith(productRepository, null, entityManager);
        Product product = product(7L, 3);
        GuestCheckoutItemRequest item = new GuestCheckoutItemRequest();
        item.setProductId(7L);
        item.setQuantity(2);
        when(productRepository.findAllByIdForUpdate(List.of(7L))).thenReturn(List.of(product));
        when(productRepository.decreaseStock(7L, 2)).thenReturn(1);

        ReflectionTestUtils.invokeMethod(service, "prepareGuestCheckoutItems", 99L, List.of(item), true);

        verify(productRepository).findAllByIdForUpdate(List.of(7L));
        verify(productRepository, never()).findAllById(List.of(7L));
        verify(productRepository).decreaseStock(7L, 2);
        verify(productRepository, never()).save(product);
        verify(entityManager).detach(product);
        assertEquals(1, product.getStock());
    }

    @Test
    void guestCheckoutReservationAtomicallyDecreasesSameProductAcrossMultipleLines() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = product(7L, 10);
        GuestCheckoutItemRequest first = guestItem(7L, 2, null);
        GuestCheckoutItemRequest second = guestItem(7L, 3, null);
        when(productRepository.findAllByIdForUpdate(List.of(7L))).thenReturn(List.of(product));
        when(productRepository.decreaseStock(7L, 2)).thenReturn(1);
        when(productRepository.decreaseStock(7L, 3)).thenReturn(1);

        ReflectionTestUtils.invokeMethod(service, "prepareGuestCheckoutItems", 99L, List.of(first, second), true);

        verify(productRepository).findAllByIdForUpdate(List.of(7L));
        verify(productRepository).decreaseStock(7L, 2);
        verify(productRepository).decreaseStock(7L, 3);
        verify(productRepository, never()).save(product);
        assertEquals(5, product.getStock());
    }

    @Test
    void simpleStockReservationDetachesManagedProductAfterAtomicDecrement() {
        ProductRepository productRepository = mock(ProductRepository.class);
        EntityManager entityManager = managedEntityManager();
        OrderService service = serviceWith(productRepository, null, entityManager);
        Product product = product(7L, 3);
        when(productRepository.decreaseStock(7L, 2)).thenReturn(1);

        ReflectionTestUtils.invokeMethod(service, "reserveProductStock", product, null, 2);

        verify(productRepository).decreaseStock(7L, 2);
        verify(entityManager).detach(product);
        verify(productRepository, never()).save(product);
        assertEquals(1, product.getStock());
    }

    @Test
    void memberCheckoutReservationAtomicallyDecreasesSameProductAcrossMultipleCartLines() {
        ProductRepository productRepository = mock(ProductRepository.class);
        CartItemMapper cartItemMapper = mock(CartItemMapper.class);
        OrderService service = serviceWith(productRepository, cartItemMapper);
        Product product = product(7L, 10);
        List<Long> cartItemIds = List.of(11L, 12L);
        List<CartItem> cartItems = List.of(cartItem(11L, 44L, 7L, 2, null), cartItem(12L, 44L, 7L, 3, null));
        when(cartItemMapper.findByIds(cartItemIds)).thenReturn(cartItems);
        when(cartItemMapper.findByIdsForUpdate(cartItemIds)).thenReturn(cartItems);
        when(productRepository.findAllByIdForUpdate(List.of(7L))).thenReturn(List.of(product));
        when(productRepository.decreaseStock(7L, 2)).thenReturn(1);
        when(productRepository.decreaseStock(7L, 3)).thenReturn(1);

        ReflectionTestUtils.invokeMethod(service, "prepareCheckoutItems", 44L, cartItemIds, true);

        verify(cartItemMapper).findByIdsForUpdate(cartItemIds);
        verify(productRepository).findAllByIdForUpdate(List.of(7L));
        verify(productRepository).decreaseStock(7L, 2);
        verify(productRepository).decreaseStock(7L, 3);
        verify(productRepository, never()).save(product);
        assertEquals(5, product.getStock());
    }

    @Test
    void simpleStockReservationFailsWhenAtomicDecrementDoesNotUpdateRow() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = product(7L, 3);
        when(productRepository.decreaseStock(7L, 2)).thenReturn(0);

        assertThrows(IllegalArgumentException.class,
                () -> ReflectionTestUtils.invokeMethod(service, "reserveProductStock", product, null, 2));

        verify(productRepository).decreaseStock(7L, 2);
        verify(productRepository, never()).save(product);
        assertEquals(3, product.getStock());
    }

    @Test
    void reservesVariantOnlyStockWithoutRequiringProductStockOrImmediateSave() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = variantOnlyProduct(5);

        ReflectionTestUtils.invokeMethod(service, "reserveProductStock", product, "{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}", 2);

        assertNull(product.getStock());
        assertEquals(3, product.getVariantsList().get(0).get("stock"));
        verify(productRepository, never()).save(product);
    }

    @Test
    void restoresSimpleProductStockWithAtomicRepositoryIncrement() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        when(productRepository.increaseStock(7L, 2)).thenReturn(1);

        OrderItem item = new OrderItem();
        item.setProductId(7L);
        item.setQuantity(2);

        ReflectionTestUtils.invokeMethod(service, "restoreStock", item);

        verify(productRepository).increaseStock(7L, 2);
        verify(productRepository, never()).findByIdForUpdate(7L);
        verify(productRepository, never()).findById(7L);
        verify(productRepository, never()).save(org.mockito.ArgumentMatchers.any(Product.class));
    }

    @Test
    void restoresSimpleProductStockGroupedByProductId() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        when(productRepository.increaseStock(7L, 5)).thenReturn(1);
        when(productRepository.increaseStock(8L, 4)).thenReturn(1);

        OrderItem first = item(1L, 7L, 2, null);
        OrderItem second = item(2L, 7L, 3, "");
        OrderItem third = item(3L, 8L, 4, null);

        ReflectionTestUtils.invokeMethod(service, "restoreStock", List.of(first, second, third));

        verify(productRepository).increaseStock(7L, 5);
        verify(productRepository).increaseStock(8L, 4);
        verify(productRepository, never()).findByIdForUpdate(any());
        verify(productRepository, never()).findById(any());
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void restoresVariantOnlyStockWithoutCreatingProductStock() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = variantOnlyProduct(3);
        when(productRepository.findByIdForUpdate(7L)).thenReturn(product);

        OrderItem item = new OrderItem();
        item.setProductId(7L);
        item.setQuantity(2);
        item.setSelectedSpecs("{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}");

        ReflectionTestUtils.invokeMethod(service, "restoreStock", item);

        assertNull(product.getStock());
        assertEquals(5, product.getVariantsList().get(0).get("stock"));
        verify(productRepository).findByIdForUpdate(7L);
        verify(productRepository).save(product);
    }

    @Test
    void restoresVariantStockGroupedByProductIdWithSingleLockAndSave() {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        Product product = variantOnlyProduct(3);
        when(productRepository.findByIdForUpdate(7L)).thenReturn(product);

        OrderItem first = item(1L, 7L, 2, "{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}");
        OrderItem second = item(2L, 7L, 4, "{\"Size\":\"S\",\"Color\":\"Red\",\"_variantSku\":\"SKU-S-RED\"}");

        ReflectionTestUtils.invokeMethod(service, "restoreStock", List.of(first, second));

        assertNull(product.getStock());
        assertEquals(9, product.getVariantsList().get(0).get("stock"));
        verify(productRepository, times(1)).findByIdForUpdate(7L);
        verify(productRepository, never()).findById(7L);
        verify(productRepository, times(1)).save(product);
    }

    @Test
    void stockRestorationCallSitesUseGroupedRestoreInsteadOfPerItemLoop() throws Exception {
        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));

        assertTrue(orderService.contains("private void restoreStock(List<OrderItem> items)"));
        assertFalse(orderService.contains("for (OrderItem item : items) {\n            restoreStock(item);\n        }"));
    }

    @Test
    void restoreStockLogsMissingProductInsteadOfSilentlySkipping(CapturedOutput output) {
        ProductRepository productRepository = mock(ProductRepository.class);
        OrderService service = serviceWith(productRepository);
        when(productRepository.increaseStock(7L, 2)).thenReturn(0);

        OrderItem item = new OrderItem();
        item.setId(11L);
        item.setProductId(7L);
        item.setQuantity(2);

        ReflectionTestUtils.invokeMethod(service, "restoreStock", item);

        verify(productRepository).increaseStock(7L, 2);
        verify(productRepository, never()).findByIdForUpdate(7L);
        verify(productRepository, never()).findById(7L);
        verify(productRepository, never()).save(org.mockito.ArgumentMatchers.any(Product.class));
        org.assertj.core.api.Assertions.assertThat(output.getOut())
                .contains("Stock restoration skipped because product was not found")
                .contains("productId=7")
                .contains("orderItemId=11")
                .contains("quantity=2");
    }

    private OrderService serviceWith(ProductRepository productRepository) {
        return serviceWith(productRepository, null);
    }

    private OrderService serviceWith(ProductRepository productRepository, CartItemMapper cartItemMapper) {
        return serviceWith(productRepository, cartItemMapper, null);
    }

    private OrderService serviceWith(
            ProductRepository productRepository,
            CartItemMapper cartItemMapper,
            EntityManager entityManager
    ) {
        OrderService service = new OrderService();
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        if (cartItemMapper != null) {
            ReflectionTestUtils.setField(service, "cartItemMapper", cartItemMapper);
        }
        if (entityManager != null) {
            ReflectionTestUtils.setField(service, "entityManager", entityManager);
        }
        ReflectionTestUtils.setField(service, "productVariantService", productVariantService);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("order.max-checkout-lines", 80)).thenReturn(80);
        when(runtimeConfig.getInt("order.max-quantity-per-line", 99)).thenReturn(99);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        return service;
    }

    private EntityManager managedEntityManager() {
        EntityManager entityManager = mock(EntityManager.class);
        when(entityManager.contains(any(Product.class))).thenReturn(true);
        return entityManager;
    }

    private Product product(Long id, int stock) {
        Product product = new Product();
        product.setId(id);
        product.setName("Harness");
        product.setPrice(new BigDecimal("20.00"));
        product.setStock(stock);
        return product;
    }

    private GuestCheckoutItemRequest guestItem(Long productId, Integer quantity, String selectedSpecs) {
        GuestCheckoutItemRequest item = new GuestCheckoutItemRequest();
        item.setProductId(productId);
        item.setQuantity(quantity);
        item.setSelectedSpecs(selectedSpecs);
        return item;
    }

    private CartItem cartItem(Long id, Long userId, Long productId, Integer quantity, String selectedSpecs) {
        CartItem item = new CartItem();
        item.setId(id);
        item.setUserId(userId);
        item.setProductId(productId);
        item.setQuantity(quantity);
        item.setSelectedSpecs(selectedSpecs);
        return item;
    }

    private Product variantOnlyProduct(int variantStock) {
        Product product = product(7L, 0);
        product.setStock(null);
        product.setSpecificationsMap(Map.of(
                "options.Size", "S,M",
                "options.Color", "Red,Blue"
        ));
        product.setVariantsList(List.of(
                Map.of("sku", "SKU-S-RED", "price", "18.00", "stock", variantStock, "options", Map.of("Size", "S", "Color", "Red"))
        ));
        return product;
    }

    private OrderItem item(Long id, Long productId, Integer quantity, String selectedSpecs) {
        OrderItem item = new OrderItem();
        item.setId(id);
        item.setProductId(productId);
        item.setQuantity(quantity);
        item.setSelectedSpecs(selectedSpecs);
        return item;
    }
}
