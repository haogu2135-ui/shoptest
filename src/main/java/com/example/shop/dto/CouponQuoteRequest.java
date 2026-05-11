package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CouponQuoteRequest {
    @NotNull
    private Long userId;

    @NotEmpty
    private List<Long> cartItemIds;

    private Long userCouponId;
}
