package com.example.shop.repository;

import com.example.shop.entity.SeckillClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SeckillClaimRepository extends JpaRepository<SeckillClaim, Long> {
    Optional<SeckillClaim> findByCampaignIdAndUserId(Long campaignId, Long userId);

    boolean existsByCampaignId(Long campaignId);
}
