package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageStorageDelegationContractTest {

    @Test
    void reviewAndGalleryServicesDelegateImageProcessingToSharedStorageService() throws Exception {
        String reviewImageService = Files.readString(Path.of("src/main/java/com/example/shop/service/ReviewImageService.java"));
        String petGalleryService = Files.readString(Path.of("src/main/java/com/example/shop/service/PetGalleryService.java"));
        String localImageStorageService = Files.readString(Path.of("src/main/java/com/example/shop/service/LocalImageStorageService.java"));

        assertTrue(reviewImageService.contains("ImageStorageService"));
        assertTrue(petGalleryService.contains("ImageStorageService"));
        assertTrue(localImageStorageService.contains("implements ImageStorageService"));
        assertTrue(localImageStorageService.contains("ImageIO"));

        for (String duplicateToken : List.of(
                "javax.imageio",
                "ImageIO",
                "ImageWriter",
                "ImageWriteParam",
                "BufferedImage",
                "Graphics2D",
                "pngDimensions",
                "gifDimensions",
                "jpegDimensions",
                "readUnsignedShort")) {
            assertFalse(reviewImageService.contains(duplicateToken),
                    () -> "ReviewImageService should not own duplicate image processing token: " + duplicateToken);
            assertFalse(petGalleryService.contains(duplicateToken),
                    () -> "PetGalleryService should not own duplicate image processing token: " + duplicateToken);
        }
    }
}
