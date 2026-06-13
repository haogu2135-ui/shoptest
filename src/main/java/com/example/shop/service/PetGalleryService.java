package com.example.shop.service;

import com.example.shop.dto.PetGalleryQuota;
import com.example.shop.entity.PetGalleryPhoto;
import com.example.shop.entity.PetGalleryPhotoLike;
import com.example.shop.repository.PetGalleryPhotoLikeRepository;
import com.example.shop.repository.PetGalleryPhotoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PetGalleryService {
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String DELETED_STATUS = "DELETED";
    private static final String USER_UPLOAD_SOURCE = "USER_UPLOAD";
    private static final String SEED_SOURCE = "SEED";
    private static final Set<String> SUPPORTED_IMAGE_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/gif"
    );
    private static final ImageStorageService.ImageUploadMessages PET_GALLERY_IMAGE_MESSAGES =
            new ImageStorageService.ImageUploadMessages(
                    "Choose a photo to upload",
                    "Photo must be 5 MB or smaller",
                    "Only JPG, PNG or GIF photos are supported",
                    "Invalid upload path",
                    "Upload failed",
                    "Sanitized photo is too large",
                    "Could not read uploaded photo",
                    "The uploaded file does not look like a valid image",
                    "Could not read uploaded photo dimensions",
                    "Photo dimensions must be %dx%d pixels or smaller",
                    "Could not process uploaded photo");
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
    private final ImageStorageService imageStorageService;

    public List<PetGalleryPhoto> findPublicPhotos(Long viewerId, String ipAddress) {
        return photoRepository.findTopPublicPhotos(ACTIVE_STATUS, PageRequest.of(0, 24)).stream()
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

    @Transactional(rollbackFor = Exception.class)
    public PetGalleryPhoto upload(Long userId, String username, String ipAddress, MultipartFile file) {
        String lockName = uploadQuotaLockName(userId, ipAddress);
        assertUploadQuotaLockAcquired(lockName);
        try {
            validateQuota(userId, ipAddress);
            ImageStorageService.StoredImage storedImage = imageStorageService.store(file, petGalleryImageOptions());

            PetGalleryPhoto photo = new PetGalleryPhoto();
            photo.setUserId(userId);
            photo.setUsername(StringUtils.hasText(username) ? username.trim() : "pet_parent");
            photo.setImageUrl(storedImage.getPublicUrl());
            photo.setOriginalFilename(cleanFilename(file.getOriginalFilename()));
            photo.setContentType(storedImage.getContentType());
            photo.setFileSize(storedImage.getFileSize());
            photo.setIpAddress(ipAddress);
            photo.setStatus(ACTIVE_STATUS);
            photo.setSource(USER_UPLOAD_SOURCE);
            photo.setLikeCount(0);

            try {
                return decorateViewerState(photoRepository.saveAndFlush(photo), userId, ipAddress);
            } catch (RuntimeException e) {
                deleteStoredImageAfterMetadataFailure(storedImage);
                throw e;
            }
        } finally {
            photoRepository.releaseUploadQuotaLock(lockName);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public PetGalleryPhoto like(Long photoId, Long userId, String ipAddress) {
        PetGalleryPhoto photo = photoRepository.findByIdForLikeUpdate(photoId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (!ACTIVE_STATUS.equals(photo.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }

        String viewerKey = viewerKey(userId, ipAddress);
        boolean alreadyLiked = likeRepository.existsByPhotoIdAndViewerKey(photoId, viewerKey);
        if (!alreadyLiked) {
            int originalLikeCount = safeLikeCount(photo);
            PetGalleryPhotoLike like = new PetGalleryPhotoLike();
            like.setPhotoId(photoId);
            like.setUserId(userId);
            like.setIpAddress(normalizeIpAddress(ipAddress));
            like.setViewerKey(viewerKey);
            try {
                likeRepository.save(like);
                photo.setLikeCount(originalLikeCount + 1);
                photo = photoRepository.saveAndFlush(photo);
            } catch (DataIntegrityViolationException e) {
                photo.setLikeCount(originalLikeCount);
                log.debug("Treating duplicate pet gallery like as idempotent success for photo {} and viewer {}; reason={}",
                        photoId, viewerKey, e.getMessage());
                photo = photoRepository.findById(photoId).orElse(photo);
            }
        }
        return decorateViewerState(photo, userId, ipAddress);
    }

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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

    private int safeLikeCount(PetGalleryPhoto photo) {
        Integer likeCount = photo == null ? null : photo.getLikeCount();
        return likeCount == null || likeCount < 0 ? 0 : likeCount;
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

    private ImageStorageService.ImageUploadOptions petGalleryImageOptions() {
        return new ImageStorageService.ImageUploadOptions(
                uploadDir(),
                publicPath(),
                runtimeConfig.getLong("pet-gallery.max-file-size-bytes", 5242880),
                Math.max(1, runtimeConfig.getInt("pet-gallery.max-image-width", 8000)),
                Math.max(1, runtimeConfig.getInt("pet-gallery.max-image-height", 8000)),
                SUPPORTED_IMAGE_CONTENT_TYPES,
                PET_GALLERY_IMAGE_MESSAGES);
    }

    private void deleteStoredImageAfterMetadataFailure(ImageStorageService.StoredImage storedImage) {
        try {
            Files.deleteIfExists(storedImage.getTarget());
        } catch (IOException ex) {
            log.warn("Failed to delete local pet gallery upload {} after metadata save failure",
                    storedImage.getTarget(), ex);
        }
    }

    private void deleteUploadedFileIfLocal(PetGalleryPhoto photo) {
        Path target = resolveLocalUploadPath(photo);
        if (target == null) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            log.warn("Failed to delete local pet gallery upload {}", target, ex);
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
