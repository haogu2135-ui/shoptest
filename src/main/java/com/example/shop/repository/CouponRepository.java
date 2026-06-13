package com.example.shop.repository;

import com.example.shop.entity.Coupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, Long> {
    List<Coupon> findByStatusOrderByIdDesc(String status);
    List<Coupon> findByScopeAndStatusOrderByIdDesc(String scope, String status);
    Optional<Coupon> findFirstByNameOrderByIdDesc(String name);
    long countByStatus(String status);
    long countByScopeAndStatus(String scope, String status);

    @Query("select c from Coupon c " +
            "where (:keyword is null " +
            "or lower(c.name) like lower(concat('%', :keyword, '%')) " +
            "or lower(coalesce(c.description, '')) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.couponType) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.scope) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.status) like lower(concat('%', :keyword, '%')) " +
            "or (:keywordId is not null and c.id = :keywordId)) " +
            "and (:status is null or c.status = :status) " +
            "and (:scope is null or c.scope = :scope)")
    Page<Coupon> searchAdminCoupons(@Param("keyword") String keyword,
                                    @Param("keywordId") Long keywordId,
                                    @Param("status") String status,
                                    @Param("scope") String scope,
                                    Pageable pageable);

    @Query("select count(c) from Coupon c " +
            "where (:keyword is null " +
            "or lower(c.name) like lower(concat('%', :keyword, '%')) " +
            "or lower(coalesce(c.description, '')) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.couponType) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.scope) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.status) like lower(concat('%', :keyword, '%')) " +
            "or (:keywordId is not null and c.id = :keywordId)) " +
            "and (:status is null or c.status = :status) " +
            "and (:scope is null or c.scope = :scope)")
    long countAdminCoupons(@Param("keyword") String keyword,
                           @Param("keywordId") Long keywordId,
                           @Param("status") String status,
                           @Param("scope") String scope);

    @Query("select count(c) from Coupon c " +
            "where c.status = 'ACTIVE' " +
            "and (:keyword is null " +
            "or lower(c.name) like lower(concat('%', :keyword, '%')) " +
            "or lower(coalesce(c.description, '')) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.couponType) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.scope) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.status) like lower(concat('%', :keyword, '%')) " +
            "or (:keywordId is not null and c.id = :keywordId)) " +
            "and (:status is null or c.status = :status) " +
            "and (:scope is null or c.scope = :scope) " +
            "and c.endAt is not null " +
            "and c.endAt >= :startAt " +
            "and c.endAt <= :endAt")
    long countAdminActiveExpiringBetween(@Param("keyword") String keyword,
                                         @Param("keywordId") Long keywordId,
                                         @Param("status") String status,
                                         @Param("scope") String scope,
                                         @Param("startAt") LocalDateTime startAt,
                                         @Param("endAt") LocalDateTime endAt);

    @Query("select count(c) from Coupon c " +
            "where c.status = 'ACTIVE' " +
            "and (:keyword is null " +
            "or lower(c.name) like lower(concat('%', :keyword, '%')) " +
            "or lower(coalesce(c.description, '')) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.couponType) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.scope) like lower(concat('%', :keyword, '%')) " +
            "or lower(c.status) like lower(concat('%', :keyword, '%')) " +
            "or (:keywordId is not null and c.id = :keywordId)) " +
            "and (:status is null or c.status = :status) " +
            "and (:scope is null or c.scope = :scope) " +
            "and c.totalQuantity is not null " +
            "and c.totalQuantity > coalesce(c.claimedQuantity, 0) " +
            "and c.totalQuantity <= coalesce(c.claimedQuantity, 0) + :threshold")
    long countAdminActiveLowRemaining(@Param("keyword") String keyword,
                                      @Param("keywordId") Long keywordId,
                                      @Param("status") String status,
                                      @Param("scope") String scope,
                                      @Param("threshold") int threshold);

    @Query("select c from Coupon c " +
            "where c.scope = :scope and c.status = :status " +
            "and (c.startAt is null or c.startAt <= :now) " +
            "and (c.endAt is null or c.endAt >= :now) " +
            "and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity) " +
            "order by c.id desc")
    List<Coupon> findClaimableByScopeAndStatus(@Param("scope") String scope,
                                               @Param("status") String status,
                                               @Param("now") LocalDateTime now);

    @Query("select c from Coupon c " +
            "where c.scope = :scope and c.status = :status " +
            "and (c.startAt is null or c.startAt <= :now) " +
            "and (c.endAt is null or c.endAt >= :now) " +
            "and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity) " +
            "order by c.id desc")
    List<Coupon> findClaimableByScopeAndStatus(@Param("scope") String scope,
                                               @Param("status") String status,
                                               @Param("now") LocalDateTime now,
                                               Pageable pageable);

    @Query("select count(c) from Coupon c " +
            "where c.status = 'ACTIVE' " +
            "and c.endAt is not null " +
            "and c.endAt >= :startAt " +
            "and c.endAt <= :endAt")
    long countActiveExpiringBetween(@Param("startAt") LocalDateTime startAt,
                                    @Param("endAt") LocalDateTime endAt);

    @Query("select count(c) from Coupon c " +
            "where c.status = 'ACTIVE' " +
            "and c.totalQuantity is not null " +
            "and c.totalQuantity > coalesce(c.claimedQuantity, 0) " +
            "and c.totalQuantity <= coalesce(c.claimedQuantity, 0) + :threshold")
    long countActiveLowRemaining(@Param("threshold") int threshold);

    @Modifying
    @Query("update Coupon c set c.claimedQuantity = coalesce(c.claimedQuantity, 0) + 1, " +
            "c.updatedAt = current_timestamp " +
            "where c.id = :couponId and c.status = 'ACTIVE' " +
            "and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity)")
    int incrementClaimedQuantity(@Param("couponId") Long couponId);

    @Modifying
    @Query(value = "update coupons set claimed_quantity = case " +
            "when coalesce(claimed_quantity, 0) > :quantity then coalesce(claimed_quantity, 0) - :quantity " +
            "else 0 end, updated_at = current_timestamp where id = :couponId",
            nativeQuery = true)
    int decrementClaimedQuantity(@Param("couponId") Long couponId, @Param("quantity") int quantity);

    @Modifying
    @Query("update Coupon c set c.usedCount = coalesce(c.usedCount, 0) + 1, " +
            "c.updatedAt = current_timestamp where c.id = :couponId")
    int incrementUsedCount(@Param("couponId") Long couponId);

    @Modifying
    @Query(value = "update coupons set used_count = case " +
            "when coalesce(used_count, 0) > 0 then coalesce(used_count, 0) - 1 " +
            "else 0 end, updated_at = current_timestamp where id = :couponId",
            nativeQuery = true)
    int decrementUsedCount(@Param("couponId") Long couponId);
}
