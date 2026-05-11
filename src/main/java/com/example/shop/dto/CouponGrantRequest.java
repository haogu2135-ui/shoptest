package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class CouponGrantRequest {
    @NotEmpty
    private List<Long> userIds;
}
