package com.example.shop.repository;

import com.example.shop.entity.SupportSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupportSessionMapper {
    SupportSession findById(Long id);
    SupportSession findOpenByUserId(Long userId);
    SupportSession findLatestByUserId(Long userId);
    List<SupportSession> findByUserId(Long userId);
    List<SupportSession> findAll(@Param("status") String status);
    int insert(SupportSession session);
    int updateLastMessage(@Param("id") Long id, @Param("lastMessage") String lastMessage);
    int assignAdmin(@Param("id") Long id, @Param("adminId") Long adminId);
    int close(@Param("id") Long id);
}
