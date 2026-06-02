package com.example.shop.repository;

import com.example.shop.entity.SupportMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupportMessageMapper {
    List<SupportMessage> findBySessionId(Long sessionId);
    List<SupportMessage> findRecentBySessionId(@Param("sessionId") Long sessionId, @Param("limit") int limit);
    List<SupportMessage> findBySessionIdAfterId(@Param("sessionId") Long sessionId, @Param("afterId") Long afterId, @Param("limit") int limit);
    SupportMessage findById(Long id);
    int insert(SupportMessage message);
    int markReadByUser(Long sessionId);
    int markReadByAdmin(Long sessionId);
    int countUnreadByAdmin();
    int countUnreadByUser(Long userId);
}
