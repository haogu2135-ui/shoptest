package com.example.shop.repository;

import com.example.shop.entity.PetProfile;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface PetProfileMapper {
    List<PetProfile> findByUserId(Long userId);
    PetProfile findById(Long id);
    int insert(PetProfile petProfile);
    int update(PetProfile petProfile);
    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
}
