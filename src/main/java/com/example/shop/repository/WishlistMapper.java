package com.example.shop.repository;

import com.example.shop.entity.Wishlist;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface WishlistMapper {

    List<Wishlist> findByUserId(Long userId);

    Wishlist findByUserAndProduct(@Param("userId") Long userId, @Param("productId") Long productId);

    int insert(Wishlist wishlist);

    int deleteByUserAndProduct(@Param("userId") Long userId, @Param("productId") Long productId);

    int countByUserId(Long userId);
}
