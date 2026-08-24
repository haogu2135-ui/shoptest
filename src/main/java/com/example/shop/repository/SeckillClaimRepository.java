package com.example.shop.repository;

import com.example.shop.entity.SeckillClaim;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.util.Optional;

@Repository
public interface SeckillClaimRepository extends JpaRepository<SeckillClaim, Long> {
    Optional<SeckillClaim> findByCampaignIdAndUserId(Long campaignId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from SeckillClaim c where c.orderId = :orderId")
    Optional<SeckillClaim> findByOrderIdForUpdate(@Param("orderId") Long orderId);

    boolean existsByCampaignId(Long campaignId);
}
