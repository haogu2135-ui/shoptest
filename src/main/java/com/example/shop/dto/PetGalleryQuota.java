package com.example.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PetGalleryQuota {
    private int limit;
    private long remaining;
    private boolean canUpload;
}
