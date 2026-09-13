package com.example.shop.service;

import com.example.shop.entity.CartItem;
import com.example.shop.entity.Product;
import com.example.shop.repository.CartItemMapper;
import com.example.shop.repository.ProductRepository;
import com.example.shop.security.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartService {
    private static final int DEFAULT_MAX_QUANTITY_PER_LINE = 99;
    private static final int HARD_MAX_QUANTITY_PER_LINE = 999;
    private static final int DEFAULT_MAX_LINES_PER_USER = 200;
    private static final int HARD_MAX_LINES_PER_USER = 500;
    private static final int DEFAULT_BATCH_DELETE_MAX_SIZE = 100;
    private static final int HARD_BATCH_DELETE_MAX_SIZE = 500;
    private static final int DEFAULT_SELECTED_SPECS_MAX_CHARS = 2000;
    private static final int HARD_SELECTED_SPECS_MAX_CHARS = 8000;

    private final CartItemMapper cartItemMapper;
    private final ProductRepository productRepository;
    private final ProductVariantService productVariantService;
    private final RuntimeConfigService runtimeConfig;

    public List<CartItem> getCartItems(Long userId) {
        List<CartItem> items = cartItemMapper.findByUserIdLimited(userId, maxLinesPerUser());
        refreshCartItemSnapshots(items);
        return items;
    }

    public CartItem getCartItem(Long cartItemId) {
        return cartItemMapper.findById(cartItemId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void addToCart(Long userId, Long productId, Integer quantity, String selectedSpecs) {
        int normalizedQuantity = normalizeQuantity(quantity);
        Product product = requirePurchasableProductForUpdate(productId, normalizedQuantity);
        String normalizedSpecs = normalizeSelectedSpecs(selectedSpecs);
        productVariantService.validateSelection(product, normalizedSpecs);
        BigDecimal resolvedPrice = productVariantService.resolvePrice(product, normalizedSpecs);
        if (resolvedPrice == null) {
            throw new IllegalStateException("Invalid product price");
        }
        CartItem existingItem = cartItemMapper.findByUserIdAndProductIdAndSelectedSpecsForUpdate(userId, productId, normalizedSpecs);
        int existingQuantity = existingItem != null && existingItem.getQuantity() != null ? existingItem.getQuantity() : 0;
        int requestedQuantity = normalizeQuantity(existingQuantity + normalizedQuantity);
        Integer availableStock = productVariantService.resolveStock(product, normalizedSpecs);
        if (availableStock == null || availableStock < requestedQuantity) {
            throw new IllegalStateException("Insufficient stock for product: " + product.getName());
        }
        if (existingItem != null) {
            existingItem.setQuantity(requestedQuantity);
            existingItem.setPrice(resolvedPrice);
            existingItem.setUpdatedAt(LocalDateTime.now());
            cartItemMapper.update(existingItem);
            return;
        }
        enforceCartLineLimit(userId);

        CartItem cartItem = new CartItem();
        cartItem.setUserId(userId);
        cartItem.setProductId(productId);
        cartItem.setQuantity(normalizedQuantity);
        cartItem.setPrice(resolvedPrice);
        cartItem.setSelectedSpecs(normalizedSpecs);
        LocalDateTime now = LocalDateTime.now();
        cartItem.setCreatedAt(now);
        cartItem.setUpdatedAt(now);
        cartItemMapper.insert(cartItem);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateQuantity(Long cartItemId, Integer quantity) {
        CartItem cartItemSnapshot = cartItemMapper.findById(cartItemId);
        if (cartItemSnapshot == null) {
            return false;
        }
        Product product = requirePurchasableProductForUpdate(cartItemSnapshot.getProductId(), quantity);
        CartItem cartItem = cartItemMapper.findByIdForUpdate(cartItemId);
        if (cartItem == null) {
            return false;
        }
        int normalizedQuantity = normalizeQuantity(quantity);
        if (!cartItemSnapshot.getProductId().equals(cartItem.getProductId())) {
            throw new IllegalStateException("Cart item changed while updating");
        }
        String selectedSpecs = cartItem.getSelectedSpecs();
        productVariantService.validateSelection(product, selectedSpecs);
        Integer availableStock = productVariantService.resolveStock(product, selectedSpecs);
        if (availableStock == null || availableStock < normalizedQuantity) {
            throw new IllegalStateException("Insufficient stock for product: " + product.getName());
        }
        cartItem.setQuantity(normalizedQuantity);
        cartItem.setPrice(productVariantService.resolvePrice(product, selectedSpecs));
        cartItem.setUpdatedAt(LocalDateTime.now());
        cartItemMapper.update(cartItem);
        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public void removeFromCart(Long cartItemId) {
        cartItemMapper.deleteById(cartItemId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void removeFromCart(List<Long> cartItemIds, Authentication authentication) {
        int maxBatchSize = maxBatchDeleteSize();
        List<Long> normalizedIds = new ArrayList<>(Math.min(cartItemIds.size(), maxBatchSize));
        Set<Long> seenIds = new LinkedHashSet<>(Math.min(cartItemIds.size(), maxBatchSize));
        for (Long id : cartItemIds) {
            if (id == null || id <= 0 || !seenIds.add(id)) {
                continue;
            }
            normalizedIds.add(id);
            if (normalizedIds.size() > maxBatchSize) {
                throw new IllegalArgumentException("Too many cart items selected");
            }
        }
        if (normalizedIds.isEmpty()) {
            throw new IllegalArgumentException("No cart items selected");
        }
        List<CartItem> items = cartItemMapper.findByIds(normalizedIds);
        if (items.size() != normalizedIds.size()) {
            throw new IllegalStateException("Some cart items were not found");
        }
        Set<Long> ownerIds = new LinkedHashSet<>(Math.min(items.size(), 2));
        for (CartItem item : items) {
            ownerIds.add(item.getUserId());
            if (ownerIds.size() > 1) {
                break;
            }
        }
        if (ownerIds.size() != 1) {
            throw new IllegalStateException("Cart items must belong to one user");
        }
        SecurityUtils.assertSelf(authentication, ownerIds.iterator().next());
        cartItemMapper.deleteByIds(normalizedIds);
    }

    @Transactional(rollbackFor = Exception.class)
    public void clearCart(Long userId) {
        cartItemMapper.deleteByUserId(userId);
    }

    public BigDecimal calculateTotal(Long userId) {
        return calculateTotalAmount(userId);
    }

    public BigDecimal calculateTotalAmount(Long userId) {
        List<CartItem> items = getCartItems(userId);
        BigDecimal total = BigDecimal.ZERO;
        for (CartItem item : items) {
            total = total.add(calculateLineAmount(item));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateLineAmount(CartItem item) {
        if (item == null || item.getPrice() == null || item.getQuantity() == null || item.getQuantity() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return item.getPrice()
                .multiply(BigDecimal.valueOf(item.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private void refreshCartItemSnapshots(List<CartItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        Set<Long> productIds = new LinkedHashSet<>(items.size());
        for (CartItem item : items) {
            Long productId = item.getProductId();
            if (productId != null && productId > 0) {
                productIds.add(productId);
            }
        }
        Map<Long, Product> productById = new HashMap<>(productIds.size());
        for (Product product : productRepository.findAllById(productIds)) {
            productById.put(product.getId(), product);
        }
        for (CartItem item : items) {
            refreshCartItemSnapshot(item, productById.get(item.getProductId()));
        }
    }

    private void refreshCartItemSnapshot(CartItem item, Product product) {
        if (product == null) {
            item.setProductStatus("INACTIVE");
            item.setProductName("Unavailable product");
            item.setImageUrl(null);
            item.setStock(0);
            return;
        }
        item.setProductName(product.getName());
        item.setImageUrl(resolveProductImageUrl(product));
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

    private String resolveProductImageUrl(Product product) {
        if (product == null) {
            return null;
        }
        String primaryImage = product.getImageUrl();
        if (primaryImage != null) {
            String normalizedPrimaryImage = primaryImage.trim();
            if (!normalizedPrimaryImage.isEmpty()) {
                return normalizedPrimaryImage;
            }
        }
        for (String image : product.getImagesList()) {
            if (image != null) {
                String normalizedImage = image.trim();
                if (!normalizedImage.isEmpty()) {
                    return normalizedImage;
                }
            }
        }
        return null;
    }

    private Product requirePurchasableProductForUpdate(Long productId, Integer quantity) {
        normalizeQuantity(quantity);
        Product product = productRepository.findByIdForUpdate(productId);
        if (product == null) {
            throw new IllegalArgumentException("Product not found");
        }
        if (product.getStatus() != null && !"ACTIVE".equalsIgnoreCase(product.getStatus())) {
            throw new IllegalStateException("Product is not available");
        }
        return product;
    }

    private int normalizeQuantity(Integer quantity) {
        int normalized = quantity == null ? 0 : quantity;
        if (normalized <= 0 || normalized > maxQuantityPerLine()) {
            throw new IllegalArgumentException("Invalid quantity");
        }
        return normalized;
    }

    private String normalizeSelectedSpecs(String selectedSpecs) {
        if (selectedSpecs != null && selectedSpecs.length() > maxSelectedSpecsChars()) {
            throw new IllegalArgumentException("Selected options are too large");
        }
        return productVariantService.normalizeSpecs(selectedSpecs);
    }

    private void enforceCartLineLimit(Long userId) {
        if (cartItemMapper.countByUserId(userId) >= maxLinesPerUser()) {
            throw new IllegalStateException("Cart item limit reached");
        }
    }

    private int maxQuantityPerLine() {
        return clamp(runtimeConfig.getInt("cart.max-quantity-per-line", DEFAULT_MAX_QUANTITY_PER_LINE),
                1,
                HARD_MAX_QUANTITY_PER_LINE);
    }

    private int maxLinesPerUser() {
        return clamp(runtimeConfig.getInt("cart.max-lines-per-user", DEFAULT_MAX_LINES_PER_USER),
                1,
                HARD_MAX_LINES_PER_USER);
    }

    private int maxBatchDeleteSize() {
        return clamp(runtimeConfig.getInt("cart.batch-delete-max-size", DEFAULT_BATCH_DELETE_MAX_SIZE),
                1,
                HARD_BATCH_DELETE_MAX_SIZE);
    }

    private int maxSelectedSpecsChars() {
        return clamp(runtimeConfig.getInt("cart.selected-specs-max-chars", DEFAULT_SELECTED_SPECS_MAX_CHARS),
                100,
                HARD_SELECTED_SPECS_MAX_CHARS);
    }

    private int clamp(int value, int minimum, int maximum) {
        return Math.max(minimum, Math.min(value, maximum));
    }

}
