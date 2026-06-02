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
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword)")
    Page<SiteAnnouncement> searchAdmin(@Param("status") String status,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);

    @Query("select count(a) from SiteAnnouncement a " +
            "where (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword)")
    long countAdmin(@Param("status") String status,
                    @Param("keyword") String keyword);

    long countByStatusIgnoreCase(String status);

    List<SiteAnnouncement> findByStatusIgnoreCase(String status);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword) " +
            "and (a.startsAt is null or a.startsAt <= :now) " +
            "and (a.endsAt is null or a.endsAt >= :now)")
    long countAdminCurrentlyActive(@Param("status") String status,
                                   @Param("keyword") String keyword,
                                   @Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword) " +
            "and a.startsAt is not null and a.startsAt > :now")
    long countAdminScheduled(@Param("status") String status,
                             @Param("keyword") String keyword,
                             @Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where upper(a.status) = 'ACTIVE' " +
            "and (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword) " +
            "and a.endsAt is not null and a.endsAt < :now")
    long countAdminExpired(@Param("status") String status,
                           @Param("keyword") String keyword,
                           @Param("now") LocalDateTime now);

    @Query("select count(a) from SiteAnnouncement a " +
            "where (:status is null or upper(a.status) = :status) " +
            "and (:keyword is null " +
            "or lower(a.title) like :keyword " +
            "or lower(a.content) like :keyword " +
            "or lower(a.linkUrl) like :keyword " +
            "or lower(a.status) like :keyword) " +
            "and a.linkUrl is not null and length(trim(a.linkUrl)) > 0")
    long countAdminLinked(@Param("status") String status,
                          @Param("keyword") String keyword);

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
