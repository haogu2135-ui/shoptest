package com.example.shop.repository;

import com.example.shop.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface UserMapper {
    User findById(Long id);
    User findByUsername(String username);
    User findByPhone(String phone);
    User findByUsernameOrPhone(@Param("login") String login);
    User findByUsernameOrPhoneOrEmail(@Param("login") String login);
    List<User> findAll();
    long countAll();
    long countAdminUsers();
    List<Long> findActiveCustomerIds();
    List<User> search(@Param("keyword") String keyword, @Param("role") String role, @Param("status") String status);
    Map<String, Object> adminSummary(@Param("keyword") String keyword, @Param("role") String role, @Param("status") String status);
    int insert(User user);
    int update(User user);
    int updateProfileContact(@Param("id") Long id, @Param("email") String email, @Param("phone") String phone, @Param("updatedAt") LocalDateTime updatedAt);
    int updateRoleAccess(@Param("id") Long id, @Param("role") String role, @Param("roleCode") String roleCode, @Param("updatedAt") LocalDateTime updatedAt);
    int deleteById(Long id);
    int updatePassword(@Param("userId") Long userId, @Param("password") String password);
} 
