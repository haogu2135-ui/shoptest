package com.example.shop.repository;

import com.example.shop.entity.CartItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface CartItemMapper {
    
    List<CartItem> findByUserId(Long userId);
    
    CartItem findById(Long id);

    CartItem findByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);

    CartItem findByUserIdAndProductIdAndSelectedSpecs(
            @Param("userId") Long userId,
            @Param("productId") Long productId,
            @Param("selectedSpecs") String selectedSpecs);

    List<CartItem> findByIds(@Param("ids") List<Long> ids);
    
    int insert(CartItem cartItem);
    
    int update(CartItem cartItem);
    
    int deleteById(Long id);

    int deleteByIds(@Param("ids") List<Long> ids);
    
    int deleteByUserId(Long userId);
} 
