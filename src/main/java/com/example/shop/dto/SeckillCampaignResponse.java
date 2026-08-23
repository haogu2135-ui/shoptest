package com.example.shop.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class SeckillCampaignResponse {
    private Long id;
    private String title;
    private String subtitle;
    private String bannerUrl;
    private String status;
    private String state;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private List<SeckillItemResponse> items;
}
