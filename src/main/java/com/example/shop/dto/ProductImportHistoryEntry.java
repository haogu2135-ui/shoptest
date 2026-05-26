package com.example.shop.dto;

import lombok.Data;

import java.time.LocalDateTime;

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
    private boolean preview;
    private boolean readyToImport;
    private boolean applied;
    private String message;
    private LocalDateTime createdAt;
}
