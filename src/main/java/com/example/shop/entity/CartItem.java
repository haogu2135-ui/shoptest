package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Data
@Entity
@Table(name = "cart_items")
public class CartItem implements Serializable {
    private static final long serialVersionUID = 1L;
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id")
    private Long userId;
    
    @Column(name = "product_id")
    private Long productId;
    
    private Integer quantity;
    
    @Column(name = "price")
    private BigDecimal price;

    @Column(name = "selected_specs", columnDefinition = "TEXT")
    private String selectedSpecs;

    @Transient
    private String productName;

    @Transient
    private String imageUrl;

    @Transient
    private Integer stock;

    @Transient
    private String productStatus;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
} 
