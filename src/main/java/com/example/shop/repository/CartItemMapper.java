package com.example.shop.repository;

import com.example.shop.entity.CartItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface CartItemMapper {
    List<CartItem> findByUserIdLimited(@Param("userId") Long userId, @Param("limit") int limit);

    int countByUserId(Long userId);
    
    CartItem findById(Long id);

    CartItem findByIdForUpdate(Long id);

    CartItem findByUserIdAndProductIdAndSelectedSpecsForUpdate(
            @Param("userId") Long userId,
            @Param("productId") Long productId,
            @Param("selectedSpecs") String selectedSpecs);

    List<CartItem> findByIds(@Param("ids") List<Long> ids);

    List<CartItem> findByIdsForUpdate(@Param("ids") List<Long> ids);
    
    int insert(CartItem cartItem);
    
    int update(CartItem cartItem);
    
    int deleteById(Long id);

    int deleteByIds(@Param("ids") List<Long> ids);
    
    int deleteByUserId(Long userId);
} 
