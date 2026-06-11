package com.example.shop.service;

import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

public interface ImageStorageService {
    StoredImage store(MultipartFile file, ImageUploadOptions options);

    final class ImageUploadOptions {
        private final String uploadDir;
        private final String publicPath;
        private final long maxFileSizeBytes;
        private final int maxImageWidth;
        private final int maxImageHeight;
        private final Set<String> allowedContentTypes;
        private final ImageUploadMessages messages;

        public ImageUploadOptions(
                String uploadDir,
                String publicPath,
                long maxFileSizeBytes,
                int maxImageWidth,
                int maxImageHeight,
                Set<String> allowedContentTypes,
                ImageUploadMessages messages) {
            this.uploadDir = uploadDir;
            this.publicPath = publicPath;
            this.maxFileSizeBytes = maxFileSizeBytes;
            this.maxImageWidth = maxImageWidth;
            this.maxImageHeight = maxImageHeight;
            this.allowedContentTypes = allowedContentTypes == null
                    ? Collections.emptySet()
                    : Collections.unmodifiableSet(new LinkedHashSet<>(allowedContentTypes));
            this.messages = messages;
        }

        public String getUploadDir() {
            return uploadDir;
        }

        public String getPublicPath() {
            return publicPath;
        }

        public long getMaxFileSizeBytes() {
            return maxFileSizeBytes;
        }

        public int getMaxImageWidth() {
            return maxImageWidth;
        }

        public int getMaxImageHeight() {
            return maxImageHeight;
        }

        public Set<String> getAllowedContentTypes() {
            return allowedContentTypes;
        }

        public ImageUploadMessages getMessages() {
            return messages;
        }
    }

    final class ImageUploadMessages {
        private final String emptyFileMessage;
        private final String maxFileSizeMessage;
        private final String unsupportedContentTypeMessage;
        private final String invalidUploadPathMessage;
        private final String saveFailedMessage;
        private final String sanitizedTooLargeMessage;
        private final String readFailedMessage;
        private final String invalidSignatureMessage;
        private final String dimensionsUnavailableMessage;
        private final String dimensionsTooLargeMessageFormat;
        private final String processFailedMessage;

        public ImageUploadMessages(
                String emptyFileMessage,
                String maxFileSizeMessage,
                String unsupportedContentTypeMessage,
                String invalidUploadPathMessage,
                String saveFailedMessage,
                String sanitizedTooLargeMessage,
                String readFailedMessage,
                String invalidSignatureMessage,
                String dimensionsUnavailableMessage,
                String dimensionsTooLargeMessageFormat,
                String processFailedMessage) {
            this.emptyFileMessage = emptyFileMessage;
            this.maxFileSizeMessage = maxFileSizeMessage;
            this.unsupportedContentTypeMessage = unsupportedContentTypeMessage;
            this.invalidUploadPathMessage = invalidUploadPathMessage;
            this.saveFailedMessage = saveFailedMessage;
            this.sanitizedTooLargeMessage = sanitizedTooLargeMessage;
            this.readFailedMessage = readFailedMessage;
            this.invalidSignatureMessage = invalidSignatureMessage;
            this.dimensionsUnavailableMessage = dimensionsUnavailableMessage;
            this.dimensionsTooLargeMessageFormat = dimensionsTooLargeMessageFormat;
            this.processFailedMessage = processFailedMessage;
        }

        public String getEmptyFileMessage() {
            return emptyFileMessage;
        }

        public String getMaxFileSizeMessage() {
            return maxFileSizeMessage;
        }

        public String getUnsupportedContentTypeMessage() {
            return unsupportedContentTypeMessage;
        }

        public String getInvalidUploadPathMessage() {
            return invalidUploadPathMessage;
        }

        public String getSaveFailedMessage() {
            return saveFailedMessage;
        }

        public String getSanitizedTooLargeMessage() {
            return sanitizedTooLargeMessage;
        }

        public String getReadFailedMessage() {
            return readFailedMessage;
        }

        public String getInvalidSignatureMessage() {
            return invalidSignatureMessage;
        }

        public String getDimensionsUnavailableMessage() {
            return dimensionsUnavailableMessage;
        }

        public String getDimensionsTooLargeMessageFormat() {
            return dimensionsTooLargeMessageFormat;
        }

        public String getProcessFailedMessage() {
            return processFailedMessage;
        }
    }

    final class StoredImage {
        private final String publicUrl;
        private final String contentType;
        private final long fileSize;
        private final String filename;
        private final Path target;

        public StoredImage(String publicUrl, String contentType, long fileSize, String filename, Path target) {
            this.publicUrl = publicUrl;
            this.contentType = contentType;
            this.fileSize = fileSize;
            this.filename = filename;
            this.target = target;
        }

        public String getPublicUrl() {
            return publicUrl;
        }

        public String getContentType() {
            return contentType;
        }

        public long getFileSize() {
            return fileSize;
        }

        public String getFilename() {
            return filename;
        }

        public Path getTarget() {
            return target;
        }
    }
}
