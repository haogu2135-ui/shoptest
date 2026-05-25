package com.example.shop.service;

import com.example.shop.entity.Product;
import com.example.shop.entity.Wishlist;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.WishlistMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.StreamSupport;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WishlistServiceTest {
    private WishlistMapper wishlistMapper;
    private ProductRepository productRepository;
    private WishlistService service;

    @BeforeEach
    void setUp() {
        wishlistMapper = mock(WishlistMapper.class);
        productRepository = mock(ProductRepository.class);
        service = new WishlistService(wishlistMapper, productRepository);
    }

    @Test
    void getWishlistLoadsProductsInOneBatchForSelectionRequirements() {
        Wishlist simple = wishlist(10L);
        Wishlist configurable = wishlist(20L);
        Wishlist variant = wishlist(30L);
        Wishlist missingProduct = wishlist(40L);
        when(wishlistMapper.findByUserId(7L)).thenReturn(List.of(simple, configurable, variant, missingProduct));

        Product simpleProduct = product(10L);
        Product configurableProduct = product(20L);
        configurableProduct.setSpecificationsMap(Map.of("options.Size", "Small,Medium"));
        Product variantProduct = product(30L);
        variantProduct.setVariantsList(List.of(Map.of("sku", "SKU-30")));
        when(productRepository.findAllById(any())).thenReturn(List.of(simpleProduct, configurableProduct, variantProduct));

        List<Wishlist> result = service.getWishlist(7L);

        assertFalse(result.get(0).getRequiresSelection());
        assertTrue(result.get(1).getRequiresSelection());
        assertTrue(result.get(2).getRequiresSelection());
        assertFalse(result.get(3).getRequiresSelection());
        ArgumentCaptor<Iterable<Long>> idsCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(productRepository).findAllById(idsCaptor.capture());
        Set<Long> loadedIds = iterableToSet(idsCaptor.getValue());
        assertEquals(Set.of(10L, 20L, 30L, 40L), loadedIds);
        verify(productRepository, never()).findById(any());
    }

    @Test
    void getWishlistSkipsProductLookupWhenThereAreNoProductIds() {
        Wishlist item = wishlist(null);
        when(wishlistMapper.findByUserId(7L)).thenReturn(List.of(item));

        List<Wishlist> result = service.getWishlist(7L);

        assertFalse(result.get(0).getRequiresSelection());
        verify(productRepository, never()).findAllById(any());
        verify(productRepository, never()).findById(any());
    }

    private Wishlist wishlist(Long productId) {
        Wishlist item = new Wishlist();
        item.setProductId(productId);
        return item;
    }

    private Product product(Long id) {
        Product product = new Product();
        product.setId(id);
        product.setName("Product " + id);
        return product;
    }

    private Set<Long> iterableToSet(Iterable<Long> values) {
        return StreamSupport.stream(values.spliterator(), false)
                .collect(Collectors.toSet());
    }
}
