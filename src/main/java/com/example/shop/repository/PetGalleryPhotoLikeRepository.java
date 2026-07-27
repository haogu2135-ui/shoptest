package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhotoLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PetGalleryPhotoLikeRepository extends JpaRepository<PetGalleryPhotoLike, Long> {
    boolean existsByPhotoIdAndUserId(Long photoId, Long userId);

    boolean existsByPhotoIdAndIpAddressAndUserIdIsNull(Long photoId, String ipAddress);

    boolean existsByPhotoIdAndViewerKey(Long photoId, String viewerKey);

    /**
     * The outer photo lock serializes likes for the same photo; this conditional insert
     * returns zero for an already-recorded viewer without raising a constraint exception.
     */
    @Modifying
    @Query(value = "insert into pet_gallery_photo_likes "
            + "(photo_id, user_id, ip_address, viewer_key, created_at) "
            + "select :photoId, :userId, :ipAddress, :viewerKey, current_timestamp "
            + "where not exists (select 1 from pet_gallery_photo_likes "
            + "where photo_id = :photoId and viewer_key = :viewerKey)",
            nativeQuery = true)
    int insertIfAbsentByPhotoIdAndViewerKey(@Param("photoId") Long photoId,
                                            @Param("userId") Long userId,
                                            @Param("ipAddress") String ipAddress,
                                            @Param("viewerKey") String viewerKey);
}
