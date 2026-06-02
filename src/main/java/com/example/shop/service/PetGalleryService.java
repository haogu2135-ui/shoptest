package com.example.shop.service;

import com.example.shop.dto.PetGalleryQuota;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.entity.PetGalleryPhotoLike;
import com.example.shop.repository.PetGalleryPhotoLikeRepository;
import com.example.shop.repository.PetGalleryPhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Iterator;
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
        "image/gif", ".gif"
    );
    private static final Map<String, String> OUTPUT_FORMAT_BY_CONTENT_TYPE = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png"
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
            .filter(this::isRenderablePublicPhoto)
            .peek((photo) -> decorateViewerState(photo, viewerId, ipAddress))
            .collect(Collectors.toList());
    }

    public Page<PetGalleryPhoto> findPublicPhotos(Long viewerId, String ipAddress, int page, int size) {
        int safePage = Math.max(0, page);
        int maxSize = Math.max(1, Math.min(size <= 0 ? 24 : size, 50));
        Page<PetGalleryPhoto> result = photoRepository.findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(
                ACTIVE_STATUS, PageRequest.of(safePage, maxSize));
        List<PetGalleryPhoto> visiblePhotos = result.getContent().stream()
                .filter(this::isRenderablePublicPhoto)
                .peek(photo -> decorateViewerState(photo, viewerId, ipAddress))
                .collect(Collectors.toList());
        int hiddenCount = result.getContent().size() - visiblePhotos.size();
        long adjustedTotal = Math.max(0L, result.getTotalElements() - hiddenCount);
        return new PageImpl<>(visiblePhotos, result.getPageable(), adjustedTotal);
    }

    public PetGalleryQuota getQuota(Long userId, String ipAddress) {
        long userUploads = photoRepository.countUploadsByUserIdAndStatus(userId, ACTIVE_STATUS, USER_UPLOAD_SOURCE);
        long ipUploads = photoRepository.countUploadsByIpAddressAndStatus(ipAddress, ACTIVE_STATUS, USER_UPLOAD_SOURCE);
        int maxPhotosPerUser = maxPhotosPerUser();
        int maxPhotosPerIp = maxPhotosPerIp();
        long userRemaining = Math.max(0, maxPhotosPerUser - userUploads);
        long ipRemaining = Math.max(0, maxPhotosPerIp - ipUploads);
        long remaining = Math.min(userRemaining, ipRemaining);
        return new PetGalleryQuota(maxPhotosPerUser, remaining, remaining > 0);
    }

    @Transactional
    public PetGalleryPhoto upload(Long userId, String username, String ipAddress, MultipartFile file) {
        String lockName = uploadQuotaLockName(userId, ipAddress);
        assertUploadQuotaLockAcquired(lockName);
        try {
            validateQuota(userId, ipAddress);
            validateFile(file);

            String uploadedContentType = normalizeContentType(file.getContentType());
            SanitizedPhoto sanitizedPhoto = sanitizeImage(file, uploadedContentType);
            String filename = UUID.randomUUID() + EXTENSIONS_BY_CONTENT_TYPE.get(sanitizedPhoto.contentType);
            Path uploadPath = Paths.get(uploadDir()).toAbsolutePath().normalize();
            Path target = uploadPath.resolve(filename).normalize();
            if (!target.startsWith(uploadPath)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload path");
            }

            try {
                Files.createDirectories(uploadPath);
                Files.write(target, sanitizedPhoto.bytes);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upload failed");
            }

            PetGalleryPhoto photo = new PetGalleryPhoto();
            photo.setUserId(userId);
            photo.setUsername(StringUtils.hasText(username) ? username.trim() : "pet_parent");
            photo.setImageUrl(publicPath().replaceAll("/$", "") + "/" + filename);
            photo.setOriginalFilename(cleanFilename(file.getOriginalFilename()));
            photo.setContentType(sanitizedPhoto.contentType);
            photo.setFileSize((long) sanitizedPhoto.bytes.length);
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
        } finally {
            photoRepository.releaseUploadQuotaLock(lockName);
        }
    }

    @Transactional
    public PetGalleryPhoto like(Long photoId, Long userId, String ipAddress) {
        PetGalleryPhoto photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (!ACTIVE_STATUS.equals(photo.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }

        String viewerKey = viewerKey(userId, ipAddress);
        boolean alreadyLiked = likeRepository.existsByPhotoIdAndViewerKey(photoId, viewerKey);
        if (!alreadyLiked) {
            PetGalleryPhotoLike like = new PetGalleryPhotoLike();
            like.setPhotoId(photoId);
            like.setUserId(userId);
            like.setIpAddress(normalizeIpAddress(ipAddress));
            like.setViewerKey(viewerKey);
            try {
                likeRepository.saveAndFlush(like);
                photoRepository.incrementLikeCount(photoId);
            } catch (DataIntegrityViolationException e) {
                // Database uniqueness makes repeated/concurrent likes idempotent.
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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Featured gallery photos cannot be deleted from the customer account");
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

    public Page<PetGalleryPhoto> findForAdmin(String status, String source, String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size <= 0 ? 12 : size, 100));
        return photoRepository.searchAdminPhotos(
                normalizeAdminStatus(status),
                normalizeAdminSource(source),
                normalizeAdminKeyword(keyword),
                PageRequest.of(safePage, safeSize));
    }

    public Map<String, Long> summarizeForAdmin(String status, String source, String keyword) {
        String safeStatus = normalizeAdminStatus(status);
        String safeSource = normalizeAdminSource(source);
        String safeKeyword = normalizeAdminKeyword(keyword);
        return Map.of(
                "visiblePhotos", photoRepository.countAdminPhotos(safeStatus, safeSource, safeKeyword),
                "userUploads", photoRepository.countAdminPhotosByUserUploadSource(safeStatus, safeSource, safeKeyword, USER_UPLOAD_SOURCE),
                "seedPhotos", photoRepository.countAdminPhotosBySource(safeStatus, safeSource, safeKeyword, SEED_SOURCE),
                "recentUploads", photoRepository.countAdminRecentPhotos(safeStatus, safeSource, safeKeyword, LocalDateTime.now().minusDays(7)),
                "largeFiles", photoRepository.countAdminLargePhotos(safeStatus, safeSource, safeKeyword, 5L * 1024 * 1024)
        );
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
        boolean liked = likeRepository.existsByPhotoIdAndViewerKey(photo.getId(), viewerKey(viewerId, ipAddress));
        photo.setLikedByMe(liked);
        photo.setCanDelete(viewerId != null && isUserUpload(photo) && Objects.equals(photo.getUserId(), viewerId));
        return photo;
    }

    private String viewerKey(Long userId, String ipAddress) {
        if (userId != null) {
            return "user:" + userId;
        }
        return "ip:" + normalizeIpAddress(ipAddress);
    }

    private String normalizeIpAddress(String ipAddress) {
        String normalized = ipAddress == null ? "unknown" : ipAddress.trim().toLowerCase(Locale.ROOT);
        normalized = normalized.replaceAll("[^a-z0-9:._-]", "");
        if (normalized.isBlank()) {
            return "unknown";
        }
        return normalized.length() <= 96 ? normalized : normalized.substring(0, 96);
    }

    private boolean isUserUpload(PetGalleryPhoto photo) {
        return !StringUtils.hasText(photo.getSource()) || USER_UPLOAD_SOURCE.equals(photo.getSource());
    }

    private boolean isRenderablePublicPhoto(PetGalleryPhoto photo) {
        if (!isUserUpload(photo) || !isLocalUploadPhoto(photo)) {
            return StringUtils.hasText(photo.getImageUrl());
        }
        if (localUploadFileExists(photo)) {
            return true;
        }
        photo.setStatus(DELETED_STATUS);
        photoRepository.save(photo);
        return false;
    }

    private boolean isLocalUploadPhoto(PetGalleryPhoto photo) {
        String imageUrl = photo.getImageUrl();
        String normalizedPublicPath = publicPath().replaceAll("/$", "");
        return imageUrl != null && imageUrl.startsWith(normalizedPublicPath + "/");
    }

    private boolean localUploadFileExists(PetGalleryPhoto photo) {
        Path target = resolveLocalUploadPath(photo);
        return target != null && Files.isRegularFile(target);
    }

    private void assertUploadQuotaLockAcquired(String lockName) {
        Long acquired = photoRepository.acquireUploadQuotaLock(lockName);
        if (acquired == null || acquired.longValue() != 1L) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Pet gallery upload quota is busy. Please retry later.");
        }
    }

    private String uploadQuotaLockName(Long userId, String ipAddress) {
        String owner = userId != null ? "user:" + userId : "ip:" + normalizeIpAddress(ipAddress);
        String normalized = owner.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9:._-]", "_");
        return "shop_pet_gallery_upload:" + normalized;
    }

    private String normalizeAdminStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (ACTIVE_STATUS.equals(normalized) || DELETED_STATUS.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String normalizeAdminSource(String source) {
        if (!StringUtils.hasText(source) || "ALL".equalsIgnoreCase(source.trim())) {
            return null;
        }
        String normalized = source.trim().toUpperCase(Locale.ROOT);
        if (USER_UPLOAD_SOURCE.equals(normalized) || SEED_SOURCE.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String normalizeAdminKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String normalized = keyword.trim().toLowerCase(Locale.ROOT)
                .replace("%", "")
                .replace("_", "");
        if (normalized.isBlank()) {
            return null;
        }
        if (normalized.length() > 120) {
            normalized = normalized.substring(0, 120);
        }
        return "%" + normalized + "%";
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
        Path target = resolveLocalUploadPath(photo);
        if (target == null) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
        }
    }

    private Path resolveLocalUploadPath(PetGalleryPhoto photo) {
        String imageUrl = photo.getImageUrl();
        String normalizedPublicPath = publicPath().replaceAll("/$", "");
        if (imageUrl == null || !imageUrl.startsWith(normalizedPublicPath + "/")) {
            return null;
        }
        String filename = imageUrl.substring((normalizedPublicPath + "/").length());
        if (!StringUtils.hasText(filename)) {
            return null;
        }
        Path uploadPath = Paths.get(uploadDir()).toAbsolutePath().normalize();
        Path target = uploadPath.resolve(filename).normalize();
        return target.startsWith(uploadPath) ? target : null;
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPG, PNG or GIF photos are supported");
        }
        validateImageSignature(file, contentType);
        validateImageDimensions(file, contentType);
    }

    private SanitizedPhoto sanitizeImage(MultipartFile file, String contentType) {
        BufferedImage decoded = decodeImage(file);
        String outputContentType = "image/jpeg".equals(contentType) ? "image/jpeg" : "image/png";
        String outputFormat = OUTPUT_FORMAT_BY_CONTENT_TYPE.get(outputContentType);
        byte[] bytes = encodeImage(decoded, outputContentType, outputFormat);
        long maxFileSize = runtimeConfig.getLong("pet-gallery.max-file-size-bytes", 5242880);
        if (bytes.length > maxFileSize) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Sanitized photo is too large");
        }
        return new SanitizedPhoto(outputContentType, bytes);
    }

    private BufferedImage decodeImage(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            BufferedImage image = ImageIO.read(inputStream);
            if (image == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
            }
            return image;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
        }
    }

    private byte[] encodeImage(BufferedImage image, String contentType, String outputFormat) {
        if ("image/jpeg".equals(contentType)) {
            return encodeJpeg(image);
        }
        return encodeWithImageIo(copyImage(image, BufferedImage.TYPE_INT_ARGB, null), outputFormat);
    }

    private byte[] encodeJpeg(BufferedImage image) {
        BufferedImage rgbImage = copyImage(image, BufferedImage.TYPE_INT_RGB, Color.WHITE);
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
        }
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
             ImageOutputStream imageOutputStream = ImageIO.createImageOutputStream(outputStream)) {
            if (imageOutputStream == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
            }
            writer.setOutput(imageOutputStream);
            ImageWriteParam writeParam = writer.getDefaultWriteParam();
            if (writeParam.canWriteCompressed()) {
                writeParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                writeParam.setCompressionQuality(0.88f);
            }
            writer.write(null, new IIOImage(rgbImage, null, null), writeParam);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
        } finally {
            writer.dispose();
        }
    }

    private byte[] encodeWithImageIo(BufferedImage image, String outputFormat) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            if (!ImageIO.write(image, outputFormat, outputStream)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
            }
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not process uploaded photo");
        }
    }

    private BufferedImage copyImage(BufferedImage source, int targetType, Color background) {
        BufferedImage target = new BufferedImage(source.getWidth(), source.getHeight(), targetType);
        Graphics2D graphics = target.createGraphics();
        try {
            if (background != null) {
                graphics.setColor(background);
                graphics.fillRect(0, 0, target.getWidth(), target.getHeight());
            }
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return target;
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

    private static class SanitizedPhoto {
        private final String contentType;
        private final byte[] bytes;

        private SanitizedPhoto(String contentType, byte[] bytes) {
            this.contentType = contentType;
            this.bytes = bytes;
        }
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
