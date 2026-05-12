package com.example.shop.repository;

import com.example.shop.entity.SecurityAuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SecurityAuditLogMapper {
    int insert(SecurityAuditLog log);

    List<SecurityAuditLog> search(@Param("action") String action,
                                  @Param("result") String result,
                                  @Param("actorUsername") String actorUsername,
                                  @Param("resourceType") String resourceType,
                                  @Param("startAt") LocalDateTime startAt,
                                  @Param("endAt") LocalDateTime endAt,
                                  @Param("limit") int limit);
}
