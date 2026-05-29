package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhoto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PetGalleryPhotoRepository extends JpaRepository<PetGalleryPhoto, Long> {
    List<PetGalleryPhoto> findTop24ByStatusOrderByLikeCountDescCreatedAtDescIdDesc(String status);

    List<PetGalleryPhoto> findAllByStatusOrderByCreatedAtDescIdDesc(String status);

    Page<PetGalleryPhoto> findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(String status, Pageable pageable);

    boolean existsByImageUrl(String imageUrl);

    @Query("select count(p) from PetGalleryPhoto p where p.userId = ?1 and p.status = ?2 and (p.source is null or p.source = '' or p.source = ?3)")
    long countUploadsByUserIdAndStatus(Long userId, String status, String source);

    @Query("select count(p) from PetGalleryPhoto p where p.ipAddress = ?1 and p.status = ?2 and (p.source is null or p.source = '' or p.source = ?3)")
    long countUploadsByIpAddressAndStatus(String ipAddress, String status, String source);

    @Modifying
    @Query("update PetGalleryPhoto p set p.likeCount = p.likeCount + 1 where p.id = ?1")
    int incrementLikeCount(Long photoId);
}
