package com.example.shop.service;

import com.example.shop.entity.CartItem;
import com.example.shop.entity.Product;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CartService {
    private final CartItemMapper cartItemMapper;
    private final ProductRepository productRepository;
    private final ProductVariantService productVariantService;

    public List<CartItem> getCartItems(Long userId) {
        List<CartItem> items = cartItemMapper.findByUserId(userId);
        items.forEach(this::refreshCartItemSnapshot);
        return items;
    }

    public CartItem getCartItem(Long cartItemId) {
        return cartItemMapper.findById(cartItemId);
    }

    @Transactional
    public void addToCart(Long userId, Long productId, Integer quantity, String selectedSpecs) {
        Product product = requirePurchasableProduct(productId, quantity);
        String normalizedSpecs = productVariantService.normalizeSpecs(selectedSpecs);
        productVariantService.validateSelection(product, normalizedSpecs);
        if (productVariantService.resolvePrice(product, normalizedSpecs) == null) {
            throw new IllegalStateException("Invalid product price");
        }
        CartItem existingItem = cartItemMapper.findByUserIdAndProductIdAndSelectedSpecs(userId, productId, normalizedSpecs);
        int existingQuantity = existingItem != null && existingItem.getQuantity() != null ? existingItem.getQuantity() : 0;
        int requestedQuantity = existingQuantity + quantity;
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
        cartItem.setQuantity(quantity);
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
            Product product = requirePurchasableProduct(cartItem.getProductId(), quantity);
            productVariantService.validateSelection(product, cartItem.getSelectedSpecs());
            Integer availableStock = productVariantService.resolveStock(product, cartItem.getSelectedSpecs());
            if (availableStock == null || availableStock < quantity) {
                throw new IllegalStateException("Insufficient stock for product: " + product.getName());
            }
            cartItem.setQuantity(quantity);
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
    public void clearCart(Long userId) {
        cartItemMapper.deleteByUserId(userId);
    }

    public double calculateTotal(Long userId) {
        List<CartItem> items = getCartItems(userId);
        return items.stream()
                .mapToDouble(item -> item.getQuantity() * item.getPrice().doubleValue())
                .sum();
    }

    private void refreshCartItemSnapshot(CartItem item) {
        Optional<Product> productOpt = productRepository.findById(item.getProductId());
        if (!productOpt.isPresent()) {
            item.setProductStatus("INACTIVE");
            item.setStock(0);
            return;
        }
        Product product = productOpt.get();
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
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        Optional<Product> productOpt = productRepository.findById(productId);
        if (!productOpt.isPresent()) {
            throw new IllegalArgumentException("Product not found");
        }
        Product product = productOpt.get();
        if (!"ACTIVE".equals(product.getStatus())) {
            throw new IllegalStateException("Product is not available");
        }
        if (product.getStock() == null || product.getStock() < quantity) {
            throw new IllegalStateException("Insufficient stock for product: " + product.getName());
        }
        return product;
    }

}
