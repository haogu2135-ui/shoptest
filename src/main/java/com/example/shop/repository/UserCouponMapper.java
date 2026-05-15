package com.example.shop.repository;

import com.example.shop.entity.UserCoupon;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserCouponMapper {
    UserCoupon findById(Long id);
    UserCoupon findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
    UserCoupon findByCouponIdAndUserId(@Param("couponId") Long couponId, @Param("userId") Long userId);
    List<UserCoupon> findByUserId(Long userId);
    List<UserCoupon> findUnusedByUserId(Long userId);
    int insert(UserCoupon userCoupon);
    int markUsed(@Param("id") Long id, @Param("orderId") Long orderId);
    int releaseUsed(@Param("id") Long id);
    int countUsedByCouponId(@Param("couponId") Long couponId);
    int deleteUnusedByCouponId(@Param("couponId") Long couponId);
    int deleteUnusedByCouponIdAndUserId(@Param("couponId") Long couponId, @Param("userId") Long userId);
}
