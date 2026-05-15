package com.example.shop.service;

import com.example.shop.entity.CartItem;
import com.example.shop.entity.Product;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import com.example.shop.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {
    private final CartItemMapper cartItemMapper;
    private final ProductRepository productRepository;
    private final ProductVariantService productVariantService;

    @Value("${cart.max-quantity-per-line:99}")
    private int maxQuantityPerLine;

    @Value("${cart.selected-specs-max-chars:2000}")
    private int selectedSpecsMaxChars;

    public List<CartItem> getCartItems(Long userId) {
        List<CartItem> items = cartItemMapper.findByUserId(userId);
        refreshCartItemSnapshots(items);
        return items;
    }

    public CartItem getCartItem(Long cartItemId) {
        return cartItemMapper.findById(cartItemId);
    }

    @Transactional
    public void addToCart(Long userId, Long productId, Integer quantity, String selectedSpecs) {
        int normalizedQuantity = normalizeQuantity(quantity);
        Product product = requirePurchasableProduct(productId, normalizedQuantity);
        String normalizedSpecs = normalizeSelectedSpecs(selectedSpecs);
        productVariantService.validateSelection(product, normalizedSpecs);
        if (productVariantService.resolvePrice(product, normalizedSpecs) == null) {
            throw new IllegalStateException("Invalid product price");
        }
        CartItem existingItem = cartItemMapper.findByUserIdAndProductIdAndSelectedSpecs(userId, productId, normalizedSpecs);
        int existingQuantity = existingItem != null && existingItem.getQuantity() != null ? existingItem.getQuantity() : 0;
        int requestedQuantity = normalizeQuantity(existingQuantity + normalizedQuantity);
        Integer availableStock = productVariantService.resolveStock(product, normalizedSpecs);
        if (availableStock == null || availableStock < requestedQuantity) {
            throw new IllegalStateException("Insufficient stock for product: " + product.getName());
        }
        if (existingItem != null) {
            existingItem.setQuantity(requestedQuantity);
            existingItem.setPrice(productVariantService.resolvePrice(product, normalizedSpecs));
            existingItem.setUpdatedAt(LocalDateTime.now());
            cartItemMapper.update(existingItem);
            return;
        }

        CartItem cartItem = new CartItem();
        cartItem.setUserId(userId);
        cartItem.setProductId(productId);
        cartItem.setQuantity(normalizedQuantity);
        cartItem.setPrice(productVariantService.resolvePrice(product, normalizedSpecs));
        cartItem.setSelectedSpecs(normalizedSpecs);
        cartItem.setCreatedAt(LocalDateTime.now());
        cartItem.setUpdatedAt(LocalDateTime.now());
        cartItemMapper.insert(cartItem);
    }

    @Transactional
    public void updateQuantity(Long cartItemId, Integer quantity) {
        CartItem cartItem = cartItemMapper.findById(cartItemId);
        if (cartItem != null) {
            int normalizedQuantity = normalizeQuantity(quantity);
            Product product = requirePurchasableProduct(cartItem.getProductId(), normalizedQuantity);
            productVariantService.validateSelection(product, cartItem.getSelectedSpecs());
            Integer availableStock = productVariantService.resolveStock(product, cartItem.getSelectedSpecs());
            if (availableStock == null || availableStock < normalizedQuantity) {
                throw new IllegalStateException("Insufficient stock for product: " + product.getName());
            }
            cartItem.setQuantity(normalizedQuantity);
            cartItem.setPrice(productVariantService.resolvePrice(product, cartItem.getSelectedSpecs()));
            cartItem.setUpdatedAt(LocalDateTime.now());
            cartItemMapper.update(cartItem);
        }
    }

    @Transactional
    public void removeFromCart(Long cartItemId) {
        cartItemMapper.deleteById(cartItemId);
    }

    @Transactional
    public void removeFromCart(List<Long> cartItemIds, Authentication authentication) {
        List<Long> normalizedIds = cartItemIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .limit(100)
                .collect(Collectors.toList());
        if (normalizedIds.isEmpty()) {
            throw new IllegalArgumentException("No cart items selected");
        }
        List<CartItem> items = cartItemMapper.findByIds(normalizedIds);
        if (items.size() != normalizedIds.size()) {
            throw new IllegalStateException("Some cart items were not found");
        }
        Set<Long> ownerIds = items.stream()
                .map(CartItem::getUserId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ownerIds.size() != 1) {
            throw new IllegalStateException("Cart items must belong to one user");
        }
        SecurityUtils.assertSelfOrAdmin(authentication, ownerIds.iterator().next());
        cartItemMapper.deleteByIds(normalizedIds);
    }

    @Transactional
    public void clearCart(Long userId) {
        cartItemMapper.deleteByUserId(userId);
    }

    public double calculateTotal(Long userId) {
        List<CartItem> items = getCartItems(userId);
        return items.stream()
                .mapToDouble(item -> item.getQuantity() * item.getPrice().doubleValue())
                .sum();
    }

    private void refreshCartItemSnapshots(List<CartItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        List<Long> productIds = items.stream()
                .map(CartItem::getProductId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Product> productById = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        items.forEach(item -> refreshCartItemSnapshot(item, productById.get(item.getProductId())));
    }

    private void refreshCartItemSnapshot(CartItem item, Product product) {
        if (product == null) {
            item.setProductStatus("INACTIVE");
            item.setStock(0);
            return;
        }
        item.setProductStatus(product.getStatus());
        try {
            productVariantService.validateSelection(product, item.getSelectedSpecs());
            item.setPrice(productVariantService.resolvePrice(product, item.getSelectedSpecs()));
            item.setStock(productVariantService.resolveStock(product, item.getSelectedSpecs()));
        } catch (RuntimeException ex) {
            item.setProductStatus("INACTIVE");
            item.setStock(0);
        }
    }

    private Product requirePurchasableProduct(Long productId, Integer quantity) {
        normalizeQuantity(quantity);
        Optional<Product> productOpt = productRepository.findById(productId);
        if (!productOpt.isPresent()) {
            throw new IllegalArgumentException("Product not found");
        }
        Product product = productOpt.get();
        if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new IllegalStateException("Product is not available");
        }
        if (product.getStock() == null || product.getStock() < quantity) {
            throw new IllegalStateException("Insufficient stock for product: " + product.getName());
        }
        return product;
    }

    private int normalizeQuantity(Integer quantity) {
        int normalized = quantity == null ? 0 : quantity;
        if (normalized <= 0 || normalized > Math.max(1, maxQuantityPerLine)) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        return normalized;
    }

    private String normalizeSelectedSpecs(String selectedSpecs) {
        if (selectedSpecs != null && selectedSpecs.length() > Math.max(100, selectedSpecsMaxChars)) {
            throw new IllegalArgumentException("Selected options are too large");
        }
        return productVariantService.normalizeSpecs(selectedSpecs);
    }

}
