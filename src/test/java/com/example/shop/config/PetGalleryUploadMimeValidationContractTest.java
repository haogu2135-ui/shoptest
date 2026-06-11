package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PetGalleryUploadMimeValidationContractTest {

    @Test
    void petGalleryUploadsRequireSupportedMimeTypes() throws Exception {
        String uploadValidator = read("frontend/src/utils/petGalleryUpload.ts");
        String home = read("frontend/src/pages/Home.tsx");
        String petGallery = read("frontend/src/pages/PetGallery.tsx");

        assertTrue(uploadValidator.contains("PET_GALLERY_SUPPORTED_IMAGE_TYPES = new Set"),
                "Pet gallery uploads should keep the allowed MIME types centralized");
        assertTrue(uploadValidator.contains("'image/jpeg'"), "JPG uploads should be allowed by MIME type");
        assertTrue(uploadValidator.contains("'image/png'"), "PNG uploads should be allowed by MIME type");
        assertTrue(uploadValidator.contains("'image/gif'"), "GIF uploads should be allowed by MIME type");
        assertTrue(uploadValidator.contains("String(file.type || '').trim().toLowerCase()"),
                "File type validation should normalize the browser supplied MIME type");
        assertTrue(uploadValidator.contains("PET_GALLERY_SUPPORTED_IMAGE_TYPES.has(normalizedType)"),
                "File type validation should check the normalized MIME type");
        assertFalse(uploadValidator.contains("file.name"),
                "Pet gallery upload validation must not trust renamed file extensions");
        assertFalse(uploadValidator.contains("jpe?g|png|gif"),
                "Pet gallery upload validation must not use an extension regex fallback");

        assertTrue(home.contains("import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';"),
                "Home pet gallery upload should import the shared MIME validator");
        assertTrue(home.contains("const isSupportedImage = isSupportedPetGalleryImageFile(file);"),
                "Home pet gallery upload should use the shared MIME validator");
        assertTrue(petGallery.contains("import { isSupportedPetGalleryImageFile } from '../utils/petGalleryUpload';"),
                "PetGallery page upload should import the shared MIME validator");
        assertTrue(petGallery.contains("const isSupportedImage = isSupportedPetGalleryImageFile(file);"),
                "PetGallery page upload should use the shared MIME validator");
        assertFalse(home.contains("/\\.(jpe?g|png|gif)$/i.test(file.name)"),
                "Home upload should not allow renamed files by extension");
        assertFalse(petGallery.contains("/\\.(jpe?g|png|gif)$/i.test(file.name)"),
                "PetGallery upload should not allow renamed files by extension");
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }
}
