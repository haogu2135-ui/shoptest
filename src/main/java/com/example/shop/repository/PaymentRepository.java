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
    Payment findLatestReconcileRequiredByOrderId(Long orderId);
    Payment findLatestRefundedByOrderId(Long orderId);
    long countActivePendingByOrderId(Long orderId);
    List<Payment> findByOrderId(Long orderId);
    List<Payment> findExpiredPending(@Param("afterId") Long afterId, @Param("limit") int limit);
    int insert(Payment payment);
    int update(Payment payment);
    int markPaidDetailed(@Param("id") Long id,
                         @Param("transactionId") String transactionId,
                         @Param("providerReference") String providerReference,
                         @Param("callbackAt") java.time.LocalDateTime callbackAt);
    int markManuallyPaid(@Param("id") Long id,
                         @Param("amount") java.math.BigDecimal amount,
                         @Param("channel") String channel,
                         @Param("transactionId") String transactionId,
                         @Param("callbackAt") java.time.LocalDateTime callbackAt);
    int updateForRefresh(@Param("payment") Payment payment,
                         @Param("expectedStatus") String expectedStatus);
    int markReconcileRequired(@Param("id") Long id,
                              @Param("transactionId") String transactionId,
                              @Param("providerReference") String providerReference,
                              @Param("callbackAt") java.time.LocalDateTime callbackAt);
    int markRefunding(@Param("id") Long id);
    int markRefunded(@Param("id") Long id, @Param("refundReference") String refundReference);
    int revertRefunding(@Param("id") Long id, @Param("status") String status);
    int markFailed(@Param("id") Long id);
    int markExpired(@Param("id") Long id);
    int markPendingCancelledByOrderId(Long orderId);
}
