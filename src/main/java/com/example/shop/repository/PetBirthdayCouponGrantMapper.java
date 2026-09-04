package com.example.shop.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface PetBirthdayCouponGrantMapper {
    List<Map<String, Object>> countByUserIdsAndBirthdayYear(@Param("userIds") List<Long> userIds,
                                                            @Param("birthdayYear") Integer birthdayYear);

    int insertIgnore(@Param("petId") Long petId,
                     @Param("userId") Long userId,
                     @Param("couponId") Long couponId,
                     @Param("birthdayYear") Integer birthdayYear);

    int deleteByCouponId(@Param("couponId") Long couponId);

    int deleteByPetIdAndBirthdayYear(@Param("petId") Long petId,
                                     @Param("birthdayYear") Integer birthdayYear);
}
