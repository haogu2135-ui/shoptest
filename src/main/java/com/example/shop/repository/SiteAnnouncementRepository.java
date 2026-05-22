package com.example.shop.repository;

import com.example.shop.entity.SiteAnnouncement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SiteAnnouncementRepository extends JpaRepository<SiteAnnouncement, Long> {
    List<SiteAnnouncement> findAllByOrderBySortOrderAscIdDesc();

    @Query("select a from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (a.startsAt is null or a.startsAt <= :now) " +
            "and (a.endsAt is null or a.endsAt >= :now) " +
            "order by a.sortOrder asc, a.id desc")
    List<SiteAnnouncement> findActive(@Param("now") LocalDateTime now, Pageable pageable);
}
