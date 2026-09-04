package com.example.shop.repository;

import com.example.shop.entity.SeckillCampaign;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.util.List;

@Repository
public interface SeckillCampaignRepository extends JpaRepository<SeckillCampaign, Long> {
    List<SeckillCampaign> findByStatus(String status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from SeckillCampaign c where c.id = :id")
    SeckillCampaign findByIdForUpdate(@Param("id") Long id);
}
