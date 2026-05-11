package com.example.shop.repository;

import com.example.shop.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface UserMapper {
    User findById(Long id);
    User findByUsername(String username);
    User findByPhone(String phone);
    User findByUsernameOrPhone(@Param("login") String login);
    User findByUsernameOrPhoneOrEmail(@Param("login") String login);
    List<User> findAll();
    int insert(User user);
    int update(User user);
    int deleteById(Long id);
    int updatePassword(@Param("userId") Long userId, @Param("password") String password);
} 
