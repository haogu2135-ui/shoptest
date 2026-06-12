package com.example.shop.dto;

import com.example.shop.entity.User;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminUserResponse {
    private Long id;
    private String username;
    private String email;
    private String phone;
    private String address;
    private String role;
    private String roleCode;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AdminUserResponse from(User user) {
        if (user == null) {
            return null;
        }
        AdminUserResponse response = new AdminUserResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setPhone(user.getPhone());
        response.setAddress(user.getAddress());
        response.setRole(user.getRole());
        response.setRoleCode(user.getRoleCode());
        response.setStatus(user.getStatus());
        response.setCreatedAt(user.getCreatedAt());
        response.setUpdatedAt(user.getUpdatedAt());
        return response;
    }
}
