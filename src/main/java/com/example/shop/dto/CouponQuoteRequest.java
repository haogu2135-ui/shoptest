package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class CouponQuoteRequest {
    private Long userId;

    @NotEmpty
    private List<Long> cartItemIds;

    private Long userCouponId;
}
