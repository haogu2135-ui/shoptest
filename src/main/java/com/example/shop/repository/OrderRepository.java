package com.example.shop.repository;

import com.example.shop.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface OrderRepository {
    List<Order> findAll();
    Order findById(Long id);
    Order findByOrderNo(String orderNo);
    Order findByOrderNoAndEmail(@Param("orderNo") String orderNo, @Param("email") String email);
    List<Order> findByUserId(Long userId);
    List<Order> findPendingPaymentBefore(@Param("cutoff") LocalDateTime cutoff);
    int insert(Order order);
    int update(Order order);
    int updateStatus(@Param("id") Long id, @Param("status") String status);
    int updateStatusIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus, @Param("status") String status);
    int requestReturnIfCurrent(@Param("id") Long id,
                               @Param("currentStatus") String currentStatus,
                               @Param("reason") String reason);
    int approveReturnIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus);
    int rejectReturnIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus);
    int updateShipping(@Param("id") Long id,
                       @Param("status") String status,
                       @Param("trackingNumber") String trackingNumber,
                       @Param("trackingCarrierCode") String trackingCarrierCode,
                       @Param("trackingCarrierName") String trackingCarrierName);
    int updateReturnTracking(@Param("id") Long id, @Param("status") String status, @Param("returnTrackingNumber") String returnTrackingNumber);
    int completeReturnAndRefundIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus);
    int deleteById(Long id);
} 
