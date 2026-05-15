package com.example.shop.repository;

import com.example.shop.entity.PetProfile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PetProfileMapper {
    List<PetProfile> findByUserId(Long userId);
    List<PetProfile> findBirthdayPets(@Param("month") int month, @Param("day") int day);
    List<PetProfile> findBirthdayPetsByUserId(@Param("userId") Long userId,
                                               @Param("month") int month,
                                               @Param("day") int day);
    PetProfile findById(Long id);
    int insert(PetProfile petProfile);
    int update(PetProfile petProfile);
    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
}
