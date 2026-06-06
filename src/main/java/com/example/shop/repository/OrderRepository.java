package com.example.shop.repository;

import com.example.shop.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface OrderRepository {
    long countAll();
    LocalDateTime currentDatabaseTime();
    java.math.BigDecimal sumTotalAmount();
    List<Map<String, Object>> countByStatusGroup();
    Map<String, Object> dashboardOrderStats(@Param("now") LocalDateTime now);
    List<Map<String, Object>> dashboardSalesTrend(@Param("start") LocalDateTime start);
    List<Map<String, Object>> dashboardPaymentMethodBreakdown();
    List<Order> findRecentAdminOrders(@Param("limit") int limit);
    List<Order> searchAdminOrders(@Param("status") String status,
                                  @Param("search") String search,
                                  @Param("quick") String quick,
                                  @Param("offset") int offset,
                                  @Param("limit") int limit);
    int countAdminOrders(@Param("status") String status,
                         @Param("search") String search,
                         @Param("quick") String quick);
    Map<String, Object> countAdminOrderSummary(@Param("search") String search);
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
                       @Param("currentStatus") String currentStatus,
                       @Param("status") String status,
                       @Param("trackingNumber") String trackingNumber,
                       @Param("trackingCarrierCode") String trackingCarrierCode,
                       @Param("trackingCarrierName") String trackingCarrierName);
    int updateReturnTrackingIfCurrent(@Param("id") Long id,
                                      @Param("currentStatus") String currentStatus,
                                      @Param("status") String status,
                                      @Param("returnTrackingNumber") String returnTrackingNumber);
    int markReturnRefundingIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus, @Param("status") String status);
    int completeReturnAndRefundIfCurrent(@Param("id") Long id, @Param("currentStatus") String currentStatus);
    int markRefunded(@Param("id") Long id, @Param("currentStatus") String currentStatus, @Param("reason") String reason);
    int deleteById(Long id);
} 
