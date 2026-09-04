package com.example.shop.repository;

import com.example.shop.entity.SeckillItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.util.List;

@Repository
public interface SeckillItemRepository extends JpaRepository<SeckillItem, Long> {
    List<SeckillItem> findByCampaignIdInOrderByCampaignIdAscIdAsc(List<Long> campaignIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from SeckillItem i where i.id = :id and i.campaignId = :campaignId")
    SeckillItem findByIdAndCampaignIdForUpdate(@Param("id") Long id, @Param("campaignId") Long campaignId);

    @Modifying
    @Query("delete from SeckillItem i where i.campaignId = :campaignId")
    int deleteByCampaignId(@Param("campaignId") Long campaignId);
}
