package com.example.shop.repository;

import com.example.shop.entity.OrderItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface OrderItemRepository {
    List<OrderItem> findAll();
    List<OrderItem> findByOrderId(Long orderId);
    OrderItem findByOrderIdAndProductId(@Param("orderId") Long orderId, @Param("productId") Long productId);
    int insert(OrderItem orderItem);
    int deleteByOrderId(Long orderId);
}
