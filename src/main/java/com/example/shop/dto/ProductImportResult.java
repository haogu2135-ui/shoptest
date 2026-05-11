package com.example.shop.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ProductImportResult {
    private int totalRows;
    private int created;
    private int updated;
    private int failed;
    private List<String> errors = new ArrayList<>();

    public void addError(int rowNumber, String message) {
        failed++;
        errors.add("Row " + rowNumber + ": " + message);
    }
}
