package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewImageService {
    private static final String DEFAULT_UPLOAD_DIR = "uploads/reviews";
    private static final String DEFAULT_PUBLIC_PATH = "/uploads/reviews";
    private static final long DEFAULT_MAX_FILE_SIZE_BYTES = 5_242_880L;
    private static final int DEFAULT_MAX_IMAGE_WIDTH = 8_000;
    private static final int DEFAULT_MAX_IMAGE_HEIGHT = 8_000;
    private static final Set<String> SUPPORTED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif"
    );
    private static final ImageStorageService.ImageUploadMessages REVIEW_IMAGE_MESSAGES =
            new ImageStorageService.ImageUploadMessages(
                    "Choose a review photo to upload",
                    "Review photo must be 5 MB or smaller",
                    "Only JPG, PNG or GIF review photos are supported",
                    "Invalid upload path",
                    "Could not save review image",
                    "Sanitized review photo is too large",
                    "Could not read uploaded review photo",
                    "The uploaded file does not look like a valid review photo",
                    "Could not read uploaded review photo dimensions",
                    "Review photo dimensions must be %dx%d pixels or smaller",
                    "Could not process uploaded review photo");

    private final RuntimeConfigService runtimeConfig;
    private final ImageStorageService imageStorageService;

    public String upload(MultipartFile file) {
        ImageStorageService.ImageUploadOptions options = reviewImageOptions();
        validateUploadRequest(file, options);
        return imageStorageService.store(file, options).getPublicUrl();
    }

    public void validateUploadRequest(MultipartFile file) {
        validateUploadRequest(file, reviewImageOptions());
    }

    private void validateUploadRequest(MultipartFile file, ImageStorageService.ImageUploadOptions options) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, REVIEW_IMAGE_MESSAGES.getEmptyFileMessage());
        }
        if (file.getSize() > options.getMaxFileSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    REVIEW_IMAGE_MESSAGES.getMaxFileSizeMessage());
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!SUPPORTED_IMAGE_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    REVIEW_IMAGE_MESSAGES.getUnsupportedContentTypeMessage());
        }
    }

    private ImageStorageService.ImageUploadOptions reviewImageOptions() {
        return new ImageStorageService.ImageUploadOptions(
                uploadDir(),
                publicPath(),
                maxFileSizeBytes(),
                maxImageWidth(),
                maxImageHeight(),
                SUPPORTED_IMAGE_CONTENT_TYPES,
                REVIEW_IMAGE_MESSAGES);
    }

    private String uploadDir() {
        return runtimeConfig.getString("review.image.upload-dir", DEFAULT_UPLOAD_DIR);
    }

    private String publicPath() {
        String configured = runtimeConfig.getString("review.image.public-path", DEFAULT_PUBLIC_PATH);
        String normalized = configured == null ? DEFAULT_PUBLIC_PATH : configured.trim();
        if (normalized.isEmpty()) {
            normalized = DEFAULT_PUBLIC_PATH;
        }
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        return normalized;
    }

    private long maxFileSizeBytes() {
        return Math.max(1, runtimeConfig.getLong("review.image.max-file-size-bytes", DEFAULT_MAX_FILE_SIZE_BYTES));
    }

    private int maxImageWidth() {
        return Math.max(1, runtimeConfig.getInt("review.image.max-width", DEFAULT_MAX_IMAGE_WIDTH));
    }

    private int maxImageHeight() {
        return Math.max(1, runtimeConfig.getInt("review.image.max-height", DEFAULT_MAX_IMAGE_HEIGHT));
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
    }
}
