package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBugAttachmentServiceTest {
    @Test
    void uploadUsesProtectedAdminBugAttachmentImageStorageOptions() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        MultipartFile file = mock(MultipartFile.class);
        when(runtimeConfig.getString("admin.bugs.attachment-upload-dir", "uploads/bug-reports"))
                .thenReturn("uploads/bug-reports");
        when(runtimeConfig.getLong("admin.bugs.attachment-max-file-size-bytes", 8388608))
                .thenReturn(8388608L);
        when(runtimeConfig.getInt("admin.bugs.attachment-max-width", 10000)).thenReturn(10000);
        when(runtimeConfig.getInt("admin.bugs.attachment-max-height", 10000)).thenReturn(10000);
        when(imageStorageService.store(eq(file), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new ImageStorageService.StoredImage(
                        "/api/admin/bugs/attachments/123e4567-e89b-12d3-a456-426614174000.png",
                        "image/png",
                        512L,
                        "123e4567-e89b-12d3-a456-426614174000.png",
                        Path.of("uploads/bug-reports/123e4567-e89b-12d3-a456-426614174000.png")));
        AdminBugAttachmentService service = new AdminBugAttachmentService(runtimeConfig, imageStorageService);

        String attachmentUrl = service.upload(file);

        ArgumentCaptor<ImageStorageService.ImageUploadOptions> optionsCaptor =
                ArgumentCaptor.forClass(ImageStorageService.ImageUploadOptions.class);
        verify(imageStorageService).store(eq(file), optionsCaptor.capture());
        ImageStorageService.ImageUploadOptions options = optionsCaptor.getValue();
        assertEquals("/api/admin/bugs/attachments/123e4567-e89b-12d3-a456-426614174000.png", attachmentUrl);
        assertEquals("uploads/bug-reports", options.getUploadDir());
        assertEquals("/api/admin/bugs/attachments", options.getPublicPath());
        assertEquals(8388608L, options.getMaxFileSizeBytes());
        assertEquals(10000, options.getMaxImageWidth());
        assertEquals(10000, options.getMaxImageHeight());
        assertTrue(options.getAllowedContentTypes().contains("image/jpeg"));
        assertTrue(options.getAllowedContentTypes().contains("image/png"));
        assertTrue(options.getAllowedContentTypes().contains("image/gif"));
    }
}
