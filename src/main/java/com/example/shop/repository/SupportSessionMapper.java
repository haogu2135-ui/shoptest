package com.example.shop.repository;

import com.example.shop.entity.SupportSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface SupportSessionMapper {
    SupportSession findById(Long id);
    SupportSession findOpenByUserId(Long userId);
    SupportSession findOpenByUserIdAndContextKey(@Param("userId") Long userId, @Param("contextKey") String contextKey);
    SupportSession findLatestByUserId(Long userId);
    List<SupportSession> findByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    List<SupportSession> findAdminPage(@Param("status") String status,
                                       @Param("needsReply") Boolean needsReply,
                                       @Param("assignedAdminId") Long assignedAdminId,
                                       @Param("search") String search,
                                       @Param("limit") int limit,
                                       @Param("offset") int offset);
    long countAdminPage(@Param("status") String status,
                        @Param("needsReply") Boolean needsReply,
                        @Param("assignedAdminId") Long assignedAdminId,
                        @Param("search") String search);
    Map<String, Object> adminSummary(@Param("adminId") Long adminId, @Param("staleBefore") LocalDateTime staleBefore);
    int insert(SupportSession session);
    int updateLastMessage(@Param("id") Long id, @Param("lastMessage") String lastMessage);
    int assignAdmin(@Param("id") Long id, @Param("adminId") Long adminId);
    int reopen(@Param("id") Long id, @Param("adminId") Long adminId);
    int close(@Param("id") Long id);
}
