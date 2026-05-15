package com.example.shop.repository;

import com.example.shop.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, Long> {
    List<Coupon> findByStatusOrderByIdDesc(String status);
    List<Coupon> findByScopeAndStatusOrderByIdDesc(String scope, String status);
    Optional<Coupon> findFirstByNameOrderByIdDesc(String name);

    @Modifying
    @Query("update Coupon c set c.claimedQuantity = coalesce(c.claimedQuantity, 0) + 1, " +
            "c.updatedAt = current_timestamp " +
            "where c.id = ?1 and c.status = 'ACTIVE' " +
            "and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity)")
    int incrementClaimedQuantity(Long couponId);

    @Modifying
    @Query(value = "update coupons set claimed_quantity = case " +
            "when coalesce(claimed_quantity, 0) > ?2 then coalesce(claimed_quantity, 0) - ?2 " +
            "else 0 end, updated_at = current_timestamp where id = ?1",
            nativeQuery = true)
    int decrementClaimedQuantity(Long couponId, int quantity);
}
