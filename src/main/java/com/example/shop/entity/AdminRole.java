package com.example.shop.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AdminRole {
    private Long id;
    private String code;
    private String name;
    private String description;
    private String status;
    private List<String> permissions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
