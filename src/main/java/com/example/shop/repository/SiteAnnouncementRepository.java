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

    long countByStatusIgnoreCase(String status);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (a.startsAt is null or a.startsAt <= :now) " +
            "and (a.endsAt is null or a.endsAt >= :now)")
    long countCurrentlyActive(@Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and a.startsAt is not null and a.startsAt > :now")
    long countScheduled(@Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and a.endsAt is not null and a.endsAt < :now")
    long countExpired(@Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where a.linkUrl is not null and length(trim(a.linkUrl)) > 0")
    long countLinked();

    @Query("select a from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (a.startsAt is null or a.startsAt <= :now) " +
            "and (a.endsAt is null or a.endsAt >= :now) " +
            "order by a.sortOrder asc, a.id desc")
    List<SiteAnnouncement> findActive(@Param("now") LocalDateTime now, Pageable pageable);
}
