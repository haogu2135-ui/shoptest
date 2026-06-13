package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class ClientErrorReportRequest {
    @NotBlank
    @Size(max = 120)
    private String context;

    @Size(max = 80)
    private String name;

    @NotBlank
    @Size(max = 1000)
    private String message;

    @Size(max = 4000)
    private String stack;

    @Size(max = 4000)
    private String componentStack;

    @Size(max = 500)
    private String path;

    @Size(max = 240)
    private String userAgent;

    @Size(max = 80)
    private String appVersion;

    @Size(max = 40)
    private String source;

    @Size(max = 40)
    private String occurredAt;
}
