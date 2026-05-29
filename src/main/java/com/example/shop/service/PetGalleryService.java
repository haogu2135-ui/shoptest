package com.example.shop.service;

import com.example.shop.dto.PetGalleryQuota;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.entity.PetGalleryPhotoLike;
import com.example.shop.repository.PetGalleryPhotoLikeRepository;
import com.example.shop.repository.PetGalleryPhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PetGalleryService {
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String DELETED_STATUS = "DELETED";
    private static final String USER_UPLOAD_SOURCE = "USER_UPLOAD";
    private static final String SEED_SOURCE = "SEED";
    private static final Map<String, String> EXTENSIONS_BY_CONTENT_TYPE = Map.of(
        "image/jpeg", ".jpg",
        "image/png", ".png",
        "image/webp", ".webp",
        "image/gif", ".gif"
    );
    private static final List<SeedPhoto> SEED_PHOTOS = List.of(
        new SeedPhoto("happy_pet_1", "https://images.unsplash.com/photo-1537151672256-6caf2e9f8c95?auto=format&fit=crop&w=700&q=80", 42),
        new SeedPhoto("cozy_paws", "https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=700&q=80", 36),
        new SeedPhoto("cat_window_club", "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=700&q=80", 31),
        new SeedPhoto("weekend_walks", "https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=700&q=80", 27),
        new SeedPhoto("tailwag_home", "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=700&q=80", 22),
        new SeedPhoto("softnap_cat", "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=700&q=80", 19)
    );

    private final PetGalleryPhotoRepository photoRepository;
    private final PetGalleryPhotoLikeRepository likeRepository;
    private final RuntimeConfigService runtimeConfig;

    public List<PetGalleryPhoto> findPublicPhotos(Long viewerId, String ipAddress) {
        return photoRepository.findTop24ByStatusOrderByLikeCountDescCreatedAtDescIdDesc(ACTIVE_STATUS).stream()
            .peek((photo) -> decorateViewerState(photo, viewerId, ipAddress))
            .collect(Collectors.toList());
    }

    public Page<PetGalleryPhoto> findPublicPhotos(Long viewerId, String ipAddress, int page, int size) {
        int safePage = Math.max(0, page);
        int maxSize = Math.max(1, Math.min(size <= 0 ? 24 : size, 50));
        Page<PetGalleryPhoto> result = photoRepository.findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(
                ACTIVE_STATUS, PageRequest.of(safePage, maxSize));
        result.getContent().forEach(photo -> decorateViewerState(photo, viewerId, ipAddress));
        return result;
    }

    public PetGalleryQuota getQuota(Long userId, String ipAddress) {
        long userUploads = photoRepository.countUploadsByUserIdAndStatus(userId, ACTIVE_STATUS, USER_UPLOAD_SOURCE);
        long ipUploads = photoRepository.countUploadsByIpAddressAndStatus(ipAddress, ACTIVE_STATUS, USER_UPLOAD_SOURCE);
        int maxPhotosPerUser = maxPhotosPerUser();
        int maxPhotosPerIp = maxPhotosPerIp();
        long userRemaining = Math.max(0, maxPhotosPerUser - userUploads);
        long ipRemaining = Math.max(0, maxPhotosPerIp - ipUploads);
        long remaining = Math.min(userRemaining, ipRemaining);
        return new PetGalleryQuota(maxPhotosPerUser, userUploads, ipUploads, remaining, remaining > 0);
    }

    @Transactional
    public synchronized PetGalleryPhoto upload(Long userId, String username, String ipAddress, MultipartFile file) {
        validateQuota(userId, ipAddress);
        validateFile(file);

        String contentType = normalizeContentType(file.getContentType());
        String filename = UUID.randomUUID() + EXTENSIONS_BY_CONTENT_TYPE.get(contentType);
        Path uploadPath = Paths.get(uploadDir()).toAbsolutePath().normalize();
        Path target = uploadPath.resolve(filename).normalize();
        if (!target.startsWith(uploadPath)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload path");
        }

        try {
            Files.createDirectories(uploadPath);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upload failed");
        }

        PetGalleryPhoto photo = new PetGalleryPhoto();
        photo.setUserId(userId);
        photo.setUsername(StringUtils.hasText(username) ? username.trim() : "pet_parent");
        photo.setImageUrl(publicPath().replaceAll("/$", "") + "/" + filename);
        photo.setOriginalFilename(cleanFilename(file.getOriginalFilename()));
        photo.setContentType(contentType);
        photo.setFileSize(file.getSize());
        photo.setIpAddress(ipAddress);
        photo.setStatus(ACTIVE_STATUS);
        photo.setSource(USER_UPLOAD_SOURCE);
        photo.setLikeCount(0);

        try {
            return decorateViewerState(photoRepository.saveAndFlush(photo), userId, ipAddress);
        } catch (RuntimeException e) {
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
            }
            throw e;
        }
    }

    @Transactional
    public PetGalleryPhoto like(Long photoId, Long userId, String ipAddress) {
        PetGalleryPhoto photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (!ACTIVE_STATUS.equals(photo.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }

        boolean alreadyLiked = userId != null
            ? likeRepository.existsByPhotoIdAndUserId(photoId, userId)
            : likeRepository.existsByPhotoIdAndIpAddressAndUserIdIsNull(photoId, ipAddress);
        if (!alreadyLiked) {
            PetGalleryPhotoLike like = new PetGalleryPhotoLike();
            like.setPhotoId(photoId);
            like.setUserId(userId);
            like.setIpAddress(ipAddress);
            try {
                likeRepository.saveAndFlush(like);
                photoRepository.incrementLikeCount(photoId);
            } catch (DataIntegrityViolationException e) {
                // Duplicate like from concurrent request — safe to ignore
            }
            photo = photoRepository.findById(photoId).orElse(photo);
        }
        return decorateViewerState(photo, userId, ipAddress);
    }

    @Transactional
    public void deleteOwnUpload(Long photoId, Long userId) {
        PetGalleryPhoto photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (!ACTIVE_STATUS.equals(photo.getStatus())) {
            return;
        }
        if (!isUserUpload(photo)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sample photos cannot be deleted");
        }
        if (!Objects.equals(photo.getUserId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own photos");
        }
        photo.setStatus(DELETED_STATUS);
        photoRepository.save(photo);
        deleteUploadedFileIfLocal(photo);
    }

    @Transactional
    public void adminDeletePhoto(Long photoId) {
        PetGalleryPhoto photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (DELETED_STATUS.equals(photo.getStatus())) {
            return;
        }
        photo.setStatus(DELETED_STATUS);
        photoRepository.save(photo);
        deleteUploadedFileIfLocal(photo);
    }

    public List<PetGalleryPhoto> findAllForAdmin() {
        return photoRepository.findAllByStatusOrderByCreatedAtDescIdDesc(ACTIVE_STATUS);
    }

    @Transactional
    public void ensureSeedPhotos(Long seedOwnerId) {
        LocalDateTime baseTime = LocalDateTime.now().minusDays(2);
        for (int i = 0; i < SEED_PHOTOS.size(); i++) {
            SeedPhoto seed = SEED_PHOTOS.get(i);
            if (photoRepository.existsByImageUrl(seed.imageUrl)) {
                continue;
            }
            PetGalleryPhoto photo = new PetGalleryPhoto();
            photo.setUserId(seedOwnerId);
            photo.setUsername(seed.username);
            photo.setImageUrl(seed.imageUrl);
            photo.setOriginalFilename(null);
            photo.setContentType("image/jpeg");
            photo.setFileSize(0L);
            photo.setIpAddress("seed");
            photo.setStatus(ACTIVE_STATUS);
            photo.setSource(SEED_SOURCE);
            photo.setLikeCount(seed.likeCount);
            photo.setCreatedAt(baseTime.plusMinutes(i));
            photoRepository.save(photo);
        }
    }

    private void validateQuota(Long userId, String ipAddress) {
        if (photoRepository.countUploadsByUserIdAndStatus(userId, ACTIVE_STATUS, USER_UPLOAD_SOURCE) >= maxPhotosPerUser()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "This account has reached the 3 photo upload limit");
        }
        if (photoRepository.countUploadsByIpAddressAndStatus(ipAddress, ACTIVE_STATUS, USER_UPLOAD_SOURCE) >= maxPhotosPerIp()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "This IP address has reached the 3 photo upload limit");
        }
    }

    private PetGalleryPhoto decorateViewerState(PetGalleryPhoto photo, Long viewerId, String ipAddress) {
        boolean liked = viewerId != null
            ? likeRepository.existsByPhotoIdAndUserId(photo.getId(), viewerId)
            : likeRepository.existsByPhotoIdAndIpAddressAndUserIdIsNull(photo.getId(), ipAddress);
        photo.setLikedByMe(liked);
        photo.setCanDelete(viewerId != null && isUserUpload(photo) && Objects.equals(photo.getUserId(), viewerId));
        return photo;
    }

    private boolean isUserUpload(PetGalleryPhoto photo) {
        return !StringUtils.hasText(photo.getSource()) || USER_UPLOAD_SOURCE.equals(photo.getSource());
    }

    private String uploadDir() {
        return runtimeConfig.getString("pet-gallery.upload-dir", "uploads/pet-gallery");
    }

    private String publicPath() {
        return runtimeConfig.getString("pet-gallery.public-path", "/uploads/pet-gallery");
    }

    private int maxPhotosPerUser() {
        return Math.max(1, runtimeConfig.getInt("pet-gallery.max-photos-per-user", 3));
    }

    private int maxPhotosPerIp() {
        return Math.max(1, runtimeConfig.getInt("pet-gallery.max-photos-per-ip", 3));
    }

    private void deleteUploadedFileIfLocal(PetGalleryPhoto photo) {
        String imageUrl = photo.getImageUrl();
        String normalizedPublicPath = publicPath().replaceAll("/$", "");
        if (imageUrl == null || !imageUrl.startsWith(normalizedPublicPath + "/")) {
            return;
        }
        String filename = imageUrl.substring((normalizedPublicPath + "/").length());
        Path uploadPath = Paths.get(uploadDir()).toAbsolutePath().normalize();
        Path target = uploadPath.resolve(filename).normalize();
        if (!target.startsWith(uploadPath)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a photo to upload");
        }
        if (file.getSize() > runtimeConfig.getLong("pet-gallery.max-file-size-bytes", 5242880)) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Photo must be 5 MB or smaller");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!EXTENSIONS_BY_CONTENT_TYPE.containsKey(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG, WebP or GIF photos are supported");
        }
        validateImageSignature(file, contentType);
        validateImageDimensions(file, contentType);
    }

    private void validateImageSignature(MultipartFile file, String contentType) {
        byte[] header = new byte[16];
        int read;
        try (InputStream inputStream = file.getInputStream()) {
            read = inputStream.read(header);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded photo");
        }

        boolean valid;
        switch (contentType) {
            case "image/jpeg":
                valid = read >= 3
                    && (header[0] & 0xff) == 0xff
                    && (header[1] & 0xff) == 0xd8
                    && (header[2] & 0xff) == 0xff;
                break;
            case "image/png":
                valid = read >= 8
                    && (header[0] & 0xff) == 0x89
                    && header[1] == 0x50
                    && header[2] == 0x4e
                    && header[3] == 0x47
                    && header[4] == 0x0d
                    && header[5] == 0x0a
                    && header[6] == 0x1a
                    && header[7] == 0x0a;
                break;
            case "image/gif":
                valid = read >= 6
                    && header[0] == 0x47
                    && header[1] == 0x49
                    && header[2] == 0x46
                    && header[3] == 0x38
                    && (header[4] == 0x37 || header[4] == 0x39)
                    && header[5] == 0x61;
                break;
            case "image/webp":
                valid = read >= 12
                    && header[0] == 0x52
                    && header[1] == 0x49
                    && header[2] == 0x46
                    && header[3] == 0x46
                    && header[8] == 0x57
                    && header[9] == 0x45
                    && header[10] == 0x42
                    && header[11] == 0x50;
                break;
            default:
                valid = false;
                break;
        }

        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file does not look like a valid image");
        }
    }

    private void validateImageDimensions(MultipartFile file, String contentType) {
        byte[] bytes;
        try (InputStream inputStream = file.getInputStream()) {
            bytes = inputStream.readNBytes(65536);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded photo");
        }
        int[] dimensions = imageDimensions(bytes, contentType);
        if (dimensions == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded photo dimensions");
        }
        int maxWidth = Math.max(1, runtimeConfig.getInt("pet-gallery.max-image-width", 8000));
        int maxHeight = Math.max(1, runtimeConfig.getInt("pet-gallery.max-image-height", 8000));
        if (dimensions[0] > maxWidth || dimensions[1] > maxHeight) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Photo dimensions must be " + maxWidth + "x" + maxHeight + " pixels or smaller");
        }
    }

    private int[] imageDimensions(byte[] bytes, String contentType) {
        switch (contentType) {
            case "image/png":
                return pngDimensions(bytes);
            case "image/gif":
                return gifDimensions(bytes);
            case "image/jpeg":
                return jpegDimensions(bytes);
            case "image/webp":
                return webpDimensions(bytes);
            default:
                return null;
        }
    }

    private int[] pngDimensions(byte[] bytes) {
        if (bytes.length < 24) {
            return null;
        }
        return new int[]{readIntBigEndian(bytes, 16), readIntBigEndian(bytes, 20)};
    }

    private int[] gifDimensions(byte[] bytes) {
        if (bytes.length < 10) {
            return null;
        }
        return new int[]{readUnsignedShortLittleEndian(bytes, 6), readUnsignedShortLittleEndian(bytes, 8)};
    }

    private int[] jpegDimensions(byte[] bytes) {
        if (bytes.length < 4) {
            return null;
        }
        int position = 2;
        while (position + 3 < bytes.length) {
            while (position < bytes.length && (bytes[position] & 0xff) != 0xff) {
                position++;
            }
            while (position < bytes.length && (bytes[position] & 0xff) == 0xff) {
                position++;
            }
            if (position >= bytes.length) {
                return null;
            }
            int marker = bytes[position++] & 0xff;
            if (marker == 0xd9 || marker == 0xda) {
                return null;
            }
            if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
                continue;
            }
            if (position + 1 >= bytes.length) {
                return null;
            }
            int length = readUnsignedShortBigEndian(bytes, position);
            if (length < 2 || position + length > bytes.length) {
                return null;
            }
            if (isJpegStartOfFrame(marker) && length >= 7) {
                return new int[]{
                        readUnsignedShortBigEndian(bytes, position + 5),
                        readUnsignedShortBigEndian(bytes, position + 3)
                };
            }
            position += length;
        }
        return null;
    }

    private boolean isJpegStartOfFrame(int marker) {
        return (marker >= 0xc0 && marker <= 0xc3)
                || (marker >= 0xc5 && marker <= 0xc7)
                || (marker >= 0xc9 && marker <= 0xcb)
                || (marker >= 0xcd && marker <= 0xcf);
    }

    private int[] webpDimensions(byte[] bytes) {
        if (bytes.length < 30 || bytes[0] != 0x52 || bytes[1] != 0x49 || bytes[2] != 0x46 || bytes[3] != 0x46
                || bytes[8] != 0x57 || bytes[9] != 0x45 || bytes[10] != 0x42 || bytes[11] != 0x50) {
            return null;
        }
        String chunk = new String(bytes, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        if ("VP8X".equals(chunk)) {
            return new int[]{1 + read24LittleEndian(bytes, 24), 1 + read24LittleEndian(bytes, 27)};
        }
        if ("VP8L".equals(chunk) && bytes.length >= 25 && (bytes[20] & 0xff) == 0x2f) {
            int b1 = bytes[21] & 0xff;
            int b2 = bytes[22] & 0xff;
            int b3 = bytes[23] & 0xff;
            int b4 = bytes[24] & 0xff;
            int width = 1 + (b1 | ((b2 & 0x3f) << 8));
            int height = 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
            return new int[]{width, height};
        }
        if ("VP8 ".equals(chunk) && bytes.length >= 30
                && (bytes[23] & 0xff) == 0x9d && (bytes[24] & 0xff) == 0x01 && (bytes[25] & 0xff) == 0x2a) {
            int width = readUnsignedShortLittleEndian(bytes, 26) & 0x3fff;
            int height = readUnsignedShortLittleEndian(bytes, 28) & 0x3fff;
            return new int[]{width, height};
        }
        return null;
    }

    private int readIntBigEndian(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 24)
                | ((bytes[offset + 1] & 0xff) << 16)
                | ((bytes[offset + 2] & 0xff) << 8)
                | (bytes[offset + 3] & 0xff);
    }

    private int readUnsignedShortBigEndian(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
    }

    private int readUnsignedShortLittleEndian(byte[] bytes, int offset) {
        return (bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8);
    }

    private int read24LittleEndian(byte[] bytes, int offset) {
        return (bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8) | ((bytes[offset + 2] & 0xff) << 16);
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
    }

    private String cleanFilename(String originalFilename) {
        String filename = StringUtils.cleanPath(originalFilename == null ? "" : originalFilename);
        if (!StringUtils.hasText(filename) || filename.contains("..")) {
            return null;
        }
        return filename.length() > 255 ? filename.substring(filename.length() - 255) : filename;
    }

    private static class SeedPhoto {
        private final String username;
        private final String imageUrl;
        private final int likeCount;

        private SeedPhoto(String username, String imageUrl, int likeCount) {
            this.username = username;
            this.imageUrl = imageUrl;
            this.likeCount = likeCount;
        }
    }
}
