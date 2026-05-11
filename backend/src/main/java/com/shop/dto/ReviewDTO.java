package com.shop.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ReviewDTO {
    private Long id;
    private Long userId;
    private Long productId;
    private Integer rating;
    private String comment;
    private String username;
    private LocalDateTime createdAt;
} 