package com.example.shop.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ProductImportResult {
    public static final String STATUS_PREVIEW_READY = "PREVIEW_READY";
    public static final String STATUS_PREVIEW_BLOCKED = "PREVIEW_BLOCKED";
    public static final String STATUS_APPLIED = "APPLIED";
    public static final String STATUS_REJECTED = "REJECTED";

    private String importId;
    private String fileSha256;
    private String status = STATUS_REJECTED;
    private int totalRows;
    private int created;
    private int updated;
    private int failed;
    private int maxRows;
    private long maxFileSizeBytes;
    private boolean preview;
    private boolean readyToImport;
    private boolean applied;
    private boolean truncatedErrors;
    private List<String> updateFields = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private List<ProductImportRowError> rowErrors = new ArrayList<>();

    public void addError(int rowNumber, String message) {
        addError(rowNumber, null, message);
    }

    public void addError(int rowNumber, String field, String message) {
        failed++;
        if (errors.size() >= 100) {
            truncatedErrors = true;
            return;
        }
        String prefix = rowNumber > 0 ? "Row " + rowNumber : "File";
        String formatted = field == null || field.isBlank()
                ? prefix + ": " + message
                : prefix + " [" + field + "]: " + message;
        errors.add(formatted);
        rowErrors.add(new ProductImportRowError(rowNumber, field, message));
    }
}
