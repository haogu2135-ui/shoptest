package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "wishlist")
public class Wishlist implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    @NotNull
    private Long userId;

    @Column(name = "product_id")
    @NotNull
    private Long productId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Transient
    @Size(max = 200)
    private String productName;

    @Transient
    @Size(max = 2000)
    private String imageUrl;

    @Transient
    @DecimalMin("0.00")
    private java.math.BigDecimal productPrice;

    @Transient
    @Min(0)
    private Integer stock;

    @Transient
    @Size(max = 20)
    private String productStatus;

    @Transient
    private Boolean requiresSelection;
}
