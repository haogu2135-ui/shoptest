package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PetProfile implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long userId;
    private String name;
    private String petType;
    private String breed;
    private LocalDate birthday;
    private BigDecimal weight;
    private String size;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
