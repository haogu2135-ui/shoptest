package com.example.shop.repository;

import com.example.shop.entity.SiteAnnouncement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SiteAnnouncementRepository extends JpaRepository<SiteAnnouncement, Long> {
    @Query("select a from SiteAnnouncement a " +
            "where (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword escape '!' " +
            "or lower(a.content) like :keyword escape '!' " +
            "or lower(a.linkUrl) like :keyword escape '!' " +
            "or lower(a.status) like :keyword escape '!')")
    Page<SiteAnnouncement> searchAdmin(@Param("status") String status,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);

    List<SiteAnnouncement> findByStatusIgnoreCaseAndIdGreaterThanOrderByIdAsc(
            String status, Long id, Pageable pageable);

    @Query("select count(a),"
            + " coalesce(sum(case when upper(a.status) = 'ACTIVE'"
            + " and (a.startsAt is null or a.startsAt <= :now)"
            + " and (a.endsAt is null or a.endsAt >= :now) then 1 else 0 end), 0),"
            + " coalesce(sum(case when upper(a.status) = 'ACTIVE'"
            + " and a.startsAt is not null and a.startsAt > :now then 1 else 0 end), 0),"
            + " coalesce(sum(case when upper(a.status) = 'ACTIVE'"
            + " and a.endsAt is not null and a.endsAt < :now then 1 else 0 end), 0),"
            + " coalesce(sum(case when upper(a.status) = 'INACTIVE' then 1 else 0 end), 0),"
            + " coalesce(sum(case when a.linkUrl is not null and length(trim(a.linkUrl)) > 0 then 1 else 0 end), 0)"
            + " from SiteAnnouncement a"
            + " where (:status is null or upper(a.status) = :status)"
            + " and (:keyword is null"
            + " or lower(a.title) like :keyword escape '!'"
            + " or lower(a.content) like :keyword escape '!'"
            + " or lower(a.linkUrl) like :keyword escape '!'"
            + " or lower(a.status) like :keyword escape '!')")
    List<Object[]> summarizeAdminMetrics(@Param("status") String status,
                                         @Param("keyword") String keyword,
                                         @Param("now") LocalDateTime now);

    @Query("select a from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (a.startsAt is null or a.startsAt <= :now) " +
            "and (a.endsAt is null or a.endsAt >= :now) " +
            "order by a.sortOrder asc, a.id desc")
    List<SiteAnnouncement> findActive(@Param("now") LocalDateTime now, Pageable pageable);
}
