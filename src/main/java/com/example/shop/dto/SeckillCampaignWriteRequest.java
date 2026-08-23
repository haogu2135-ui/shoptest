package com.example.shop.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SeckillCampaignWriteRequest {
    @NotBlank
    @Size(max = 160)
    private String title;

    @Size(max = 500)
    private String subtitle;

    @Size(max = 2000)
    private String bannerUrl;

    @Size(max = 20)
    private String status = "DRAFT";

    @NotNull
    private LocalDateTime startAt;

    @NotNull
    private LocalDateTime endAt;

    @Valid
    @NotEmpty
    @Size(max = 50)
    private List<SeckillItemWriteRequest> items;
}
