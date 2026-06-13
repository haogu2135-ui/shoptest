package com.example.shop.repository;

import com.example.shop.entity.OrderItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface OrderItemRepository {
    List<OrderItem> findByOrderId(Long orderId);
    List<OrderItem> findByOrderIds(@Param("orderIds") List<Long> orderIds);
    List<java.util.Map<String, Object>> findTopProductsByOrderStatuses(@Param("statuses") List<String> statuses,
                                                                        @Param("limit") int limit);
    OrderItem findByOrderIdAndProductId(@Param("orderId") Long orderId, @Param("productId") Long productId);
    int insert(OrderItem orderItem);
    int insertBatch(@Param("items") List<OrderItem> items);
    int deleteByOrderId(Long orderId);
}
