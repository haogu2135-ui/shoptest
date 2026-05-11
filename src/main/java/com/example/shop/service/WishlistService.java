package com.example.shop.service;

import com.example.shop.entity.Wishlist;
import com.example.shop.repository.WishlistMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WishlistService {
    private final WishlistMapper wishlistMapper;

    public List<Wishlist> getWishlist(Long userId) {
        return wishlistMapper.findByUserId(userId);
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
}
