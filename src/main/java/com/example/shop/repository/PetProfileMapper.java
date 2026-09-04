package com.example.shop.repository;

import com.example.shop.entity.PetProfile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PetProfileMapper {
    List<PetProfile> findByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    int countByUserId(Long userId);
    List<PetProfile> findBirthdayPetsAfterId(@Param("month") int month,
                                             @Param("day") int day,
                                             @Param("afterId") long afterId,
                                             @Param("limit") int limit);
    List<PetProfile> findBirthdayPetsByUserId(@Param("userId") Long userId,
                                               @Param("month") int month,
                                               @Param("day") int day,
                                               @Param("limit") int limit);
    PetProfile findById(Long id);
    int insert(PetProfile petProfile);
    int update(PetProfile petProfile);
    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
}
