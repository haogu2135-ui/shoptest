package com.example.shop.service;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    
    public User findByUsername(String username) {
        return userMapper.findByUsername(username);
    }

    public User findByPhone(String phone) {
        return userMapper.findByPhone(phone);
    }

    public User findByUsernameOrPhone(String login) {
        return userMapper.findByUsernameOrPhone(login);
    }
    
    public User findById(Long id) {
        return userMapper.findById(id);
    }
    
    @Transactional
    public void register(User user) {
        if (user.getPhone() == null || user.getPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Phone number is required");
        }
        if (userMapper.findByPhone(user.getPhone()) != null) {
            throw new IllegalArgumentException("Phone number already registered");
        }
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            user.setUsername(user.getPhone());
        }
        if (user.getEmail() != null && user.getEmail().trim().isEmpty()) {
            user.setEmail(null);
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole("USER");
        user.setStatus("ACTIVE");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
    }

    @Transactional
    public void registerAdmin(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
    }
    
    @Transactional
    public void update(User user) {
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.update(user);
    }
    
    @Transactional
    public void updatePassword(Long userId, String oldPassword, String newPassword) {
        User user = userMapper.findById(userId);
        if (user != null && passwordEncoder.matches(oldPassword, user.getPassword())) {
            userMapper.updatePassword(userId, passwordEncoder.encode(newPassword));
        } else {
            throw new RuntimeException("原密码不正确");
        }
    }

    @Transactional
    public void resetPassword(String login, String email, String newPassword) {
        User user = userMapper.findByUsernameOrPhoneOrEmail(login);
        if (user == null || user.getEmail() == null || !user.getEmail().equalsIgnoreCase(email.trim())) {
            throw new IllegalArgumentException("Account information does not match");
        }
        userMapper.updatePassword(user.getId(), passwordEncoder.encode(newPassword));
    }

    public List<User> findAll() {
        return userMapper.findAll();
    }

    @Transactional
    public void deleteById(Long id) {
        userMapper.deleteById(id);
    }

    public long count() {
        return userMapper.findAll().size();
    }
} 
