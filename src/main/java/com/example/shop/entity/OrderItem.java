package com.example.shop.entity;

import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OrderItem implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long orderId;
    private Long productId;
    private Integer quantity;
    private BigDecimal price;
    private LocalDateTime createdAt;
    private String productNameSnapshot;
    private String imageUrlSnapshot;
    private String selectedSpecs;

    // Joined fields (from product table)
    private String productName;
    private String imageUrl;
}
