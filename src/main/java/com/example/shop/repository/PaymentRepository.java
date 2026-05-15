package com.example.shop.repository;

import com.example.shop.entity.Payment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PaymentRepository {
    Payment findById(Long id);
    Payment findByOrderNoAndChannel(@Param("orderNo") String orderNo, @Param("channel") String channel);
    Payment findByTransactionId(String transactionId);
    Payment findByProviderReference(String providerReference);
    Payment findByOrderIdAndChannel(@Param("orderId") Long orderId, @Param("channel") String channel);
    Payment findPendingByOrderId(Long orderId);
    Payment findLatestByOrderId(Long orderId);
    Payment findLatestPaidByOrderId(Long orderId);
    Payment findLatestRefundedByOrderId(Long orderId);
    List<Payment> findByOrderId(Long orderId);
    List<Payment> findExpiredPending();
    int insert(Payment payment);
    int update(Payment payment);
    int markPaid(@Param("id") Long id, @Param("transactionId") String transactionId);
    int markPaidDetailed(@Param("id") Long id,
                         @Param("transactionId") String transactionId,
                         @Param("providerReference") String providerReference,
                         @Param("callbackAt") java.time.LocalDateTime callbackAt);
    int markRefunded(@Param("id") Long id, @Param("refundReference") String refundReference);
    int markFailed(@Param("id") Long id);
    int markExpired(@Param("id") Long id);
}
