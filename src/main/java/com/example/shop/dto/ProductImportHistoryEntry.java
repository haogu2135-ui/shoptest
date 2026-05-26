package com.example.shop.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class ProductImportHistoryEntry {
    private Long auditLogId;
    private String action;
    private String result;
    private String filename;
    private String importId;
    private String fileSha256;
    private String status;
    private long sizeBytes;
    private int totalRows;
    private int created;
    private int updated;
    private int failed;
    private List<String> updateFields = new ArrayList<>();
    private boolean preview;
    private boolean readyToImport;
    private boolean applied;
    private String sourceHost;
    private Integer confidenceScore;
    private int imageCount;
    private int blockedImageCount;
    private int warningCount;
    private String message;
    private LocalDateTime createdAt;
}
