package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhotoLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PetGalleryPhotoLikeRepository extends JpaRepository<PetGalleryPhotoLike, Long> {
    boolean existsByPhotoIdAndUserId(Long photoId, Long userId);

    boolean existsByPhotoIdAndIpAddressAndUserIdIsNull(Long photoId, String ipAddress);
}
