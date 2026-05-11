package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
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
    private Long userId;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Transient
    private String productName;

    @Transient
    private String imageUrl;

    @Transient
    private java.math.BigDecimal productPrice;

    @Transient
    private Integer stock;

    @Transient
    private String productStatus;
}
