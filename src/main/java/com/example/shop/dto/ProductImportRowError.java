package com.example.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProductImportRowError {
    private int rowNumber;
    private String field;
    private String message;
}
