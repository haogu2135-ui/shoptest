package com.example.shop.service;

import com.example.shop.entity.Wishlist;
import com.example.shop.entity.Product;
import com.example.shop.repository.WishlistMapper;
import com.example.shop.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WishlistService {
    private final WishlistMapper wishlistMapper;
    private final ProductRepository productRepository;

    public List<Wishlist> getWishlist(Long userId) {
        List<Wishlist> items = wishlistMapper.findByUserId(userId);
        attachSelectionRequirements(items);
        return items;
    }

    public boolean isWishlisted(Long userId, Long productId) {
        return wishlistMapper.findByUserAndProduct(userId, productId) != null;
    }

    @Transactional
    public void addToWishlist(Long userId, Long productId) {
        if (isWishlisted(userId, productId)) return;
        Wishlist w = new Wishlist();
        w.setUserId(userId);
        w.setProductId(productId);
        w.setCreatedAt(LocalDateTime.now());
        wishlistMapper.insert(w);
    }

    @Transactional
    public void removeFromWishlist(Long userId, Long productId) {
        wishlistMapper.deleteByUserAndProduct(userId, productId);
    }

    @Transactional
    public void toggleWishlist(Long userId, Long productId) {
        if (isWishlisted(userId, productId)) {
            removeFromWishlist(userId, productId);
        } else {
            addToWishlist(userId, productId);
        }
    }

    public int getCount(Long userId) {
        return wishlistMapper.countByUserId(userId);
    }

    private void attachSelectionRequirements(List<Wishlist> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        Set<Long> productIds = items.stream()
                .map(Wishlist::getProductId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Product> productsById = productIds.isEmpty()
                ? Collections.emptyMap()
                : productRepository.findAllById(productIds).stream()
                        .filter(product -> product.getId() != null)
                        .collect(Collectors.toMap(Product::getId, Function.identity(), (left, right) -> left));
        items.forEach(item -> attachSelectionRequirement(item, productsById.get(item.getProductId())));
    }

    private void attachSelectionRequirement(Wishlist item, Product product) {
        if (product == null) {
            item.setRequiresSelection(false);
            return;
        }
        Map<String, String> specs = product.getSpecificationsMap();
        boolean hasOptions = specs != null && specs.entrySet().stream()
                .anyMatch(entry -> entry.getKey() != null
                        && entry.getKey().startsWith("options.")
                        && entry.getValue() != null
                        && !entry.getValue().trim().isEmpty());
        boolean hasVariants = product.getVariantsList() != null && !product.getVariantsList().isEmpty();
        boolean hasBundle = specs != null && "true".equalsIgnoreCase(specs.getOrDefault("bundle.enabled", "false"));
        item.setRequiresSelection(hasOptions || hasVariants || hasBundle);
    }
}
