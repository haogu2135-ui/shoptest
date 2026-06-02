package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class PetProfile implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    @NotNull
    private Long userId;
    @NotBlank
    @Size(max = 80)
    private String name;
    @NotBlank
    @Size(max = 40)
    private String petType;
    @Size(max = 80)
    private String breed;
    private LocalDate birthday;
    @DecimalMin("0.00")
    private BigDecimal weight;
    @Size(max = 40)
    private String size;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
