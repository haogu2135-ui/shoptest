package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminBugAttachmentService {
    private static final String PUBLIC_ATTACHMENT_PATH = "/api/admin/bugs/attachments";
    private static final Set<String> SUPPORTED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif"
    );
    private static final ImageStorageService.ImageUploadMessages BUG_ATTACHMENT_MESSAGES =
            new ImageStorageService.ImageUploadMessages(
                    "Choose a bug attachment image to upload",
                    "Bug attachment image must be 8 MB or smaller",
                    "Only JPG, PNG or GIF bug attachment images are supported",
                    "Invalid bug attachment upload path",
                    "Could not save bug attachment image",
                    "Sanitized bug attachment image is too large",
                    "Could not read uploaded bug attachment image",
                    "The uploaded file does not look like a valid bug attachment image",
                    "Could not read uploaded bug attachment image dimensions",
                    "Bug attachment image dimensions must be %dx%d pixels or smaller",
                    "Could not process uploaded bug attachment image");

    private final RuntimeConfigService runtimeConfig;
    private final ImageStorageService imageStorageService;

    public String upload(MultipartFile file) {
        return imageStorageService.store(file, attachmentOptions()).getPublicUrl();
    }

    public AttachmentResource load(String filename) {
        String safeFilename = normalizeFilename(filename);
        Path uploadPath = Paths.get(uploadDir()).toAbsolutePath().normalize();
        Path target = uploadPath.resolve(safeFilename).normalize();
        if (!target.startsWith(uploadPath) || !Files.isRegularFile(target)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug attachment not found");
        }
        try {
            return new AttachmentResource(new UrlResource(target.toUri()), contentTypeFor(safeFilename), safeFilename);
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug attachment not found", e);
        }
    }

    private ImageStorageService.ImageUploadOptions attachmentOptions() {
        return new ImageStorageService.ImageUploadOptions(
                uploadDir(),
                PUBLIC_ATTACHMENT_PATH,
                maxFileSizeBytes(),
                maxImageWidth(),
                maxImageHeight(),
                SUPPORTED_IMAGE_CONTENT_TYPES,
                BUG_ATTACHMENT_MESSAGES);
    }

    private String uploadDir() {
        return runtimeConfig.getString("admin.bugs.attachment-upload-dir", "uploads/bug-reports");
    }

    private long maxFileSizeBytes() {
        return Math.max(1, runtimeConfig.getLong("admin.bugs.attachment-max-file-size-bytes", 8388608));
    }

    private int maxImageWidth() {
        return Math.max(1, runtimeConfig.getInt("admin.bugs.attachment-max-width", 10000));
    }

    private int maxImageHeight() {
        return Math.max(1, runtimeConfig.getInt("admin.bugs.attachment-max-height", 10000));
    }

    private String normalizeFilename(String filename) {
        String value = filename == null ? "" : filename.trim().toLowerCase(Locale.ROOT);
        if (!value.matches("[0-9a-f-]{36}\\.(jpg|png)")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug attachment not found");
        }
        return value;
    }

    private String contentTypeFor(String filename) {
        return filename.endsWith(".jpg") ? "image/jpeg" : "image/png";
    }

    public static class AttachmentResource {
        private final Resource resource;
        private final String contentType;
        private final String filename;

        public AttachmentResource(Resource resource, String contentType, String filename) {
            this.resource = resource;
            this.contentType = contentType;
            this.filename = filename;
        }

        public Resource getResource() {
            return resource;
        }

        public String getContentType() {
            return contentType;
        }

        public String getFilename() {
            return filename;
        }
    }
}
