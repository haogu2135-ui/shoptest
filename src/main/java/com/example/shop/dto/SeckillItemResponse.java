package com.example.shop.dto;

import com.example.shop.entity.Product;
import com.example.shop.entity.SeckillItem;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class SeckillItemResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String imageUrl;
    private BigDecimal originalPrice;
    private BigDecimal seckillPrice;
    private Integer quota;
    private Integer sold;
    private Integer remaining;
    private Integer limitPerUser;
    private Integer productStock;
    private List<Map<String, Object>> optionGroups;

    public static SeckillItemResponse from(SeckillItem item, Product product) {
        SeckillItemResponse response = new SeckillItemResponse();
        response.setId(item.getId());
        response.setProductId(item.getProductId());
        response.setProductName(product == null ? null : product.getName());
        response.setImageUrl(product == null ? null : product.getImageUrl());
        response.setOriginalPrice(product == null ? null : product.getPrice());
        response.setSeckillPrice(item.getSeckillPrice());
        response.setQuota(item.getQuota());
        response.setSold(item.getSold());
        response.setRemaining(Math.max(0, item.getQuota() - item.getSold()));
        response.setLimitPerUser(item.getLimitPerUser());
        response.setProductStock(product == null ? null : product.getStock());
        response.setOptionGroups(product == null ? List.of() : product.getOptionGroupsList());
        return response;
    }
}
