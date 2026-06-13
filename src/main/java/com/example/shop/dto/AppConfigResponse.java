package com.example.shop.dto;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AppConfigResponse {
    private boolean emailCodeEnabled;
    private BigDecimal defaultShippingFee;
    private BigDecimal freeShippingThreshold;
}
