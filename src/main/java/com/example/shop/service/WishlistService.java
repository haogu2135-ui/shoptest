package com.example.shop.service;

import com.example.shop.entity.Wishlist;
import com.example.shop.entity.Product;
import com.example.shop.repository.WishlistMapper;
import com.example.shop.repository.ProductRepository;
import com.example.shop.util.ProductStatusUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class WishlistService {
    private static final int DEFAULT_MAX_ITEMS_PER_USER = 500;
    private static final int HARD_MAX_ITEMS_PER_USER = 1000;

    private final WishlistMapper wishlistMapper;
    private final ProductRepository productRepository;
    private final RuntimeConfigService runtimeConfig;

    @Autowired
    public WishlistService(WishlistMapper wishlistMapper,
                           ProductRepository productRepository,
                           RuntimeConfigService runtimeConfig) {
        this.wishlistMapper = wishlistMapper;
        this.productRepository = productRepository;
        this.runtimeConfig = runtimeConfig;
    }

    WishlistService(WishlistMapper wishlistMapper, ProductRepository productRepository) {
        this(wishlistMapper, productRepository, null);
    }

    public List<Wishlist> getWishlist(Long userId) {
        List<Wishlist> items = wishlistMapper.findByUserId(userId);
        attachSelectionRequirements(items);
        return items;
    }

    public boolean isWishlisted(Long userId, Long productId) {
        requirePositiveId(userId, "User");
        requirePositiveId(productId, "Product");
        return wishlistMapper.findByUserAndProduct(userId, productId) != null;
    }

    @Transactional
    public void addToWishlist(Long userId, Long productId) {
        requirePositiveId(userId, "User");
        requirePositiveId(productId, "Product");
        if (isWishlisted(userId, productId)) return;
        requireWishlistEligibleProduct(productId);
        enforceWishlistItemLimit(userId);
        Wishlist w = new Wishlist();
        w.setUserId(userId);
        w.setProductId(productId);
        w.setCreatedAt(LocalDateTime.now());
        try {
            wishlistMapper.insert(w);
        } catch (DuplicateKeyException e) {
            // A concurrent add for the same user/product is equivalent to success.
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException("Product is no longer available for wishlist", e);
        }
    }

    @Transactional
    public void removeFromWishlist(Long userId, Long productId) {
        requirePositiveId(userId, "User");
        requirePositiveId(productId, "Product");
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
        requirePositiveId(userId, "User");
        return wishlistMapper.countByUserId(userId);
    }

    private void requireWishlistEligibleProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (!ProductStatusUtils.isPublicProduct(product)) {
            throw new IllegalStateException("Product is not available for wishlist");
        }
    }

    private void requirePositiveId(Long id, String fieldName) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }

    private void enforceWishlistItemLimit(Long userId) {
        if (wishlistMapper.countByUserId(userId) >= maxItemsPerUser()) {
            throw new IllegalStateException("Wishlist item limit reached");
        }
    }

    private int maxItemsPerUser() {
        int configured = runtimeConfig == null
                ? DEFAULT_MAX_ITEMS_PER_USER
                : runtimeConfig.getInt("wishlist.max-items-per-user", DEFAULT_MAX_ITEMS_PER_USER);
        return Math.max(1, Math.min(configured, HARD_MAX_ITEMS_PER_USER));
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
        item.setProductName(product.getName());
        item.setImageUrl(resolveProductImageUrl(product));
        item.setProductPrice(product.getPrice());
        item.setStock(product.getStock());
        item.setProductStatus(product.getStatus());
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

    private String resolveProductImageUrl(Product product) {
        if (product == null) {
            return null;
        }
        if (product.getImageUrl() != null && !product.getImageUrl().trim().isEmpty()) {
            return product.getImageUrl().trim();
        }
        for (String image : product.getImagesList()) {
            if (image != null && !image.trim().isEmpty()) {
                return image.trim();
            }
        }
        return null;
    }
}
