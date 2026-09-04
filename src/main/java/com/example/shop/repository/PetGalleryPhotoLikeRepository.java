package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhotoLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PetGalleryPhotoLikeRepository extends JpaRepository<PetGalleryPhotoLike, Long> {
    boolean existsByPhotoIdAndViewerKey(Long photoId, String viewerKey);

    @Query("select l.photoId from PetGalleryPhotoLike l"
            + " where l.viewerKey = :viewerKey and l.photoId in :photoIds")
    List<Long> findPhotoIdsByViewerKeyAndPhotoIdIn(@Param("viewerKey") String viewerKey,
                                                   @Param("photoIds") List<Long> photoIds);

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
