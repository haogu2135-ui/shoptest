package com.example.shop.repository;

import com.example.shop.entity.SupportMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupportMessageMapper {
    List<SupportMessage> findBySessionId(Long sessionId);
    int insert(SupportMessage message);
    int markReadByUser(Long sessionId);
    int markReadByAdmin(Long sessionId);
    int countUnreadByAdmin();
    int countUnreadByUser(Long userId);
}
