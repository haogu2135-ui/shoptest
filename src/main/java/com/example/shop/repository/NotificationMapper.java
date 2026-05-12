package com.example.shop.repository;

import com.example.shop.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface NotificationMapper {

    List<Notification> findByUserId(Long userId);

    Notification findById(Long id);

    int countUnread(Long userId);

    int insert(Notification notification);

    int insertBatch(@Param("notifications") List<Notification> notifications);

    int markAsRead(@Param("id") Long id);

    int markAllAsRead(Long userId);

    int deleteById(Long id);
}
