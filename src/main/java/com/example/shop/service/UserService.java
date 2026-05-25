package com.example.shop.service;

import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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

    public User findByUsernameOrPhoneOrEmail(String login) {
        return userMapper.findByUsernameOrPhoneOrEmail(login);
    }
    
    public User findById(Long id) {
        return userMapper.findById(id);
    }
    
    @Transactional
    public void register(User user) {
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new IllegalArgumentException("Password is required");
        }
        if (user.getPhone() == null || user.getPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Phone number is required");
        }
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        user.setPhone(normalizeText(user.getPhone(), 40));
        if (userMapper.findByPhone(user.getPhone()) != null) {
            throw new IllegalArgumentException("Phone number already registered");
        }
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            user.setUsername(user.getPhone());
        } else {
            user.setUsername(normalizeText(user.getUsername(), 50));
        }
        if (userMapper.findByUsername(user.getUsername()) != null) {
            throw new IllegalArgumentException("Username already registered");
        }
        user.setEmail(normalizeText(user.getEmail(), 100).toLowerCase());
        User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(user.getEmail());
        if (existingEmail != null) {
            throw new IllegalArgumentException("Email already registered");
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
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            throw new IllegalArgumentException("Admin username is required");
        }
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Admin email is required");
        }
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new IllegalArgumentException("Admin password is required");
        }
        user.setUsername(user.getUsername().trim());
        user.setEmail(user.getEmail().trim());
        if (userMapper.findByUsername(user.getUsername()) != null) {
            throw new IllegalArgumentException("Username already registered");
        }
        User existingEmail = userMapper.findByUsernameOrPhoneOrEmail(user.getEmail());
        if (existingEmail != null) {
            throw new IllegalArgumentException("Email already registered");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole("ADMIN");
        user.setStatus("ACTIVE");
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
    public void updateRoleAccess(Long userId, String role, String roleCode) {
        userMapper.updateRoleAccess(userId, role, roleCode, LocalDateTime.now());
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

    public List<User> search(String keyword, String role, String status) {
        return userMapper.search(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40));
    }

    public UserAdminSummaryResponse adminSummary(String keyword, String role, String status) {
        Map<String, Object> row = userMapper.adminSummary(
                normalizeText(keyword, 120),
                normalizeText(role, 40),
                normalizeText(status, 40));
        UserAdminSummaryResponse response = new UserAdminSummaryResponse();
        response.setTotalUsers(numberValue(row, "totalUsers"));
        response.setActiveUsers(numberValue(row, "activeUsers"));
        response.setBannedUsers(numberValue(row, "bannedUsers"));
        response.setAdminUsers(numberValue(row, "adminUsers"));
        response.setCustomerUsers(numberValue(row, "customerUsers"));
        response.setMissingEmailUsers(numberValue(row, "missingEmailUsers"));
        response.setMissingPhoneUsers(numberValue(row, "missingPhoneUsers"));
        response.setReadyUsers(numberValue(row, "readyUsers"));
        response.setAdminRatioPercent(response.getTotalUsers() == 0
                ? 0
                : (int) Math.round(response.getAdminUsers() * 100.0 / response.getTotalUsers()));
        response.setHealthScore(calculateUserHealthScore(response));
        response.setCheckedAt(Instant.now().toString());
        return response;
    }

    @Transactional
    public void deleteById(Long id) {
        userMapper.deleteById(id);
    }

    public long count() {
        return userMapper.countAll();
    }

    private int calculateUserHealthScore(UserAdminSummaryResponse summary) {
        int adminRisk = summary.getAdminRatioPercent() > 25 && summary.getTotalUsers() >= 4 ? 18 : 0;
        long rawScore = 100
                - summary.getBannedUsers() * 8
                - summary.getMissingEmailUsers() * 10
                - summary.getMissingPhoneUsers() * 4
                - adminRisk;
        return (int) Math.max(0, Math.min(100, rawScore));
    }

    private long numberValue(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return 0;
        }
        Object value = row.get(key);
        if (value == null) {
            value = row.get(camelToSnake(key));
        }
        if (value == null) {
            value = row.get(key.toLowerCase());
        }
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        if (value == null) {
            String snake = camelToSnake(key);
            value = row.get(snake.toLowerCase());
            if (value == null) {
                value = row.get(snake.toUpperCase());
            }
        }
        return value instanceof Number ? ((Number) value).longValue() : 0;
    }

    private String camelToSnake(String value) {
        return value.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }

    private String normalizeText(String value, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
} 
