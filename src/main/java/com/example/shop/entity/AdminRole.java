package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class AdminRole {
    private Long id;
    @NotBlank
    @Size(max = 50)
    private String code;
    @NotBlank
    @Size(max = 100)
    private String name;
    @Size(max = 500)
    private String description;
    @NotBlank
    @Size(max = 20)
    private String status;
    @Size(max = 200)
    private List<String> permissions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
