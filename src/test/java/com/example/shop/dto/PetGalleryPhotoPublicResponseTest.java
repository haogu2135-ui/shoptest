package com.example.shop.dto;

import com.example.shop.entity.PetGalleryPhoto;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PetGalleryPhotoPublicResponseTest {
    @Test
    void localUploadImageUrlsIncludeStableCacheVersion() {
        PetGalleryPhoto photo = new PetGalleryPhoto();
        photo.setId(7L);
        photo.setUsername("guhao");
        photo.setImageUrl("/uploads/pet-gallery/photo.webp");
        photo.setCreatedAt(LocalDateTime.of(2026, 5, 30, 1, 42));

        PetGalleryPhotoPublicResponse response = PetGalleryPhotoPublicResponse.from(photo);

        assertEquals("/uploads/pet-gallery/photo.webp?v=20260530", response.getImageUrl());
    }

    @Test
    void remoteSeedImageUrlsAreNotVersioned() {
        PetGalleryPhoto photo = new PetGalleryPhoto();
        photo.setUsername("happy_pet_1");
        photo.setSource("SEED");
        photo.setImageUrl("https://images.example.com/photo.jpg");

        PetGalleryPhotoPublicResponse response = PetGalleryPhotoPublicResponse.from(photo);

        assertEquals("https://images.example.com/photo.jpg", response.getImageUrl());
    }
}
