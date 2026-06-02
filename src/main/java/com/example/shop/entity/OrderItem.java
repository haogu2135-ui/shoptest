package com.example.shop.entity;

import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class OrderItem implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    @NotNull
    private Long orderId;
    @NotNull
    private Long productId;
    @NotNull
    @Min(1)
    private Integer quantity;
    @NotNull
    @DecimalMin("0.00")
    private BigDecimal price;
    private LocalDateTime createdAt;
    @Size(max = 200)
    private String productNameSnapshot;
    @Size(max = 2000)
    private String imageUrlSnapshot;
    @Size(max = 1000)
    private String selectedSpecs;

    // Joined fields (from product table)
    @Size(max = 200)
    private String productName;
    @Size(max = 2000)
    private String imageUrl;
}
