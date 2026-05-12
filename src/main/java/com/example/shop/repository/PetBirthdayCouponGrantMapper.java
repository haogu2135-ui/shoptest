package com.example.shop.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PetBirthdayCouponGrantMapper {
    int countByUserIdAndBirthdayYear(@Param("userId") Long userId,
                                      @Param("birthdayYear") Integer birthdayYear);

    int insertIgnore(@Param("petId") Long petId,
                     @Param("userId") Long userId,
                     @Param("couponId") Long couponId,
                     @Param("birthdayYear") Integer birthdayYear);
}
