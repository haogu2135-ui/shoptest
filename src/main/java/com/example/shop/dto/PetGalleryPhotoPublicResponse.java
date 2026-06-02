package com.example.shop.dto;

import com.example.shop.entity.PetGalleryPhoto;

import java.time.LocalDateTime;

public class PetGalleryPhotoPublicResponse {
    private Long id;
    private String username;
    private String imageUrl;
    private Integer likeCount;
    private Boolean likedByMe;
    private Boolean canDelete;
    private LocalDateTime createdAt;

    public static PetGalleryPhotoPublicResponse from(PetGalleryPhoto photo) {
        PetGalleryPhotoPublicResponse response = new PetGalleryPhotoPublicResponse();
        if (photo == null) {
            return response;
        }
        response.setId(photo.getId());
        response.setUsername(publicUsername(photo));
        response.setImageUrl(publicImageUrl(photo));
        response.setLikeCount(photo.getLikeCount());
        response.setLikedByMe(Boolean.TRUE.equals(photo.getLikedByMe()));
        response.setCanDelete(Boolean.TRUE.equals(photo.getCanDelete()));
        response.setCreatedAt(photo.getCreatedAt());
        return response;
    }

    private static String maskUsername(String username) {
        String value = username == null ? "" : username.trim();
        if (value.isEmpty()) {
            return "pet_parent";
        }
        if (value.length() <= 2) {
            return value.charAt(0) + "***";
        }
        return value.charAt(0) + "***" + value.charAt(value.length() - 1);
    }

    private static String publicUsername(PetGalleryPhoto photo) {
        String value = photo == null || photo.getUsername() == null ? "" : photo.getUsername().trim();
        if (value.isEmpty()) {
            return "pet_parent";
        }
        if (photo != null && "SEED".equalsIgnoreCase(String.valueOf(photo.getSource()))) {
            return value.length() <= 80 ? value : value.substring(0, 80);
        }
        return maskUsername(value);
    }

    private static String publicImageUrl(PetGalleryPhoto photo) {
        String value = photo.getImageUrl();
        if (value == null || !value.startsWith("/uploads/")) {
            return value;
        }
        String version = photo.getCreatedAt() == null
                ? String.valueOf(photo.getId() == null ? "1" : photo.getId())
                : photo.getCreatedAt().toLocalDate().toString().replace("-", "");
        String separator = value.contains("?") ? "&" : "?";
        return value + separator + "v=" + version;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Integer getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Integer likeCount) {
        this.likeCount = likeCount;
    }

    public Boolean getLikedByMe() {
        return likedByMe;
    }

    public void setLikedByMe(Boolean likedByMe) {
        this.likedByMe = likedByMe;
    }

    public Boolean getCanDelete() {
        return canDelete;
    }

    public void setCanDelete(Boolean canDelete) {
        this.canDelete = canDelete;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
