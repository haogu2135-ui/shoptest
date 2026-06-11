package com.example.shop.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewImageServiceTest {

    @Test
    void uploadDelegatesToSharedStorageWithReviewImageOptions() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        MockMultipartFile file = new MockMultipartFile("file", "review.png", "image/png", new byte[]{1, 2, 3});
        when(runtimeConfig.getString(eq("review.image.upload-dir"), any())).thenReturn("uploads/reviews-test");
        when(runtimeConfig.getString(eq("review.image.public-path"), any())).thenReturn(" reviews/public ");
        when(runtimeConfig.getLong(eq("review.image.max-file-size-bytes"), anyLong())).thenReturn(1024L);
        when(runtimeConfig.getInt(eq("review.image.max-width"), anyInt())).thenReturn(640);
        when(runtimeConfig.getInt(eq("review.image.max-height"), anyInt())).thenReturn(480);
        when(imageStorageService.store(eq(file), any()))
                .thenReturn(new ImageStorageService.StoredImage("/reviews/public/photo.png", "image/png", 3L,
                        "photo.png", null));

        ReviewImageService service = new ReviewImageService(runtimeConfig, imageStorageService);

        assertEquals("/reviews/public/photo.png", service.upload(file));
        ArgumentCaptor<ImageStorageService.ImageUploadOptions> optionsCaptor =
                ArgumentCaptor.forClass(ImageStorageService.ImageUploadOptions.class);
        verify(imageStorageService).store(eq(file), optionsCaptor.capture());
        ImageStorageService.ImageUploadOptions options = optionsCaptor.getValue();
        assertEquals("uploads/reviews-test", options.getUploadDir());
        assertEquals("/reviews/public", options.getPublicPath());
        assertEquals(1024L, options.getMaxFileSizeBytes());
        assertEquals(640, options.getMaxImageWidth());
        assertEquals(480, options.getMaxImageHeight());
        assertEquals(Set.of("image/jpeg", "image/png", "image/gif"), options.getAllowedContentTypes());
        assertTrue(options.getMessages().getUnsupportedContentTypeMessage().contains("review photos"));
    }

    @Test
    void uploadRejectsMissingFileBeforeStorage() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        ReviewImageService service = new ReviewImageService(runtimeConfig, imageStorageService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.upload(null));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(imageStorageService, never()).store(any(), any());
    }

    @Test
    void uploadRejectsOversizedFileBeforeStorage() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        when(runtimeConfig.getLong(eq("review.image.max-file-size-bytes"), anyLong())).thenReturn(2L);
        MockMultipartFile file = new MockMultipartFile("file", "review.png", "image/png", new byte[]{1, 2, 3});
        ReviewImageService service = new ReviewImageService(runtimeConfig, imageStorageService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.upload(file));

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, exception.getStatus());
        verify(imageStorageService, never()).store(any(), any());
    }

    @Test
    void uploadRejectsUnsupportedContentTypeBeforeStorage() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        when(runtimeConfig.getLong(eq("review.image.max-file-size-bytes"), anyLong())).thenReturn(1024L);
        MockMultipartFile file = new MockMultipartFile("file", "review.txt", "text/plain", new byte[]{1, 2, 3});
        ReviewImageService service = new ReviewImageService(runtimeConfig, imageStorageService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.upload(file));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(imageStorageService, never()).store(any(), any());
    }
}
