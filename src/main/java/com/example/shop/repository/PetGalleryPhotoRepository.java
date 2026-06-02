package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhoto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PetGalleryPhotoRepository extends JpaRepository<PetGalleryPhoto, Long> {
    String ADMIN_FILTER_CLAUSE = " where (?1 is null or p.status = ?1)"
            + " and (?2 is null or coalesce(p.source, '') = ?2)"
            + " and (?3 is null"
            + " or str(p.id) like ?3"
            + " or str(p.userId) like ?3"
            + " or lower(coalesce(p.username, '')) like ?3"
            + " or lower(coalesce(p.ipAddress, '')) like ?3"
            + " or lower(coalesce(p.originalFilename, '')) like ?3"
            + " or lower(coalesce(p.contentType, '')) like ?3"
            + " or lower(coalesce(p.imageUrl, '')) like ?3"
            + " or lower(coalesce(p.status, '')) like ?3"
            + " or lower(coalesce(p.source, '')) like ?3)";

    List<PetGalleryPhoto> findTop24ByStatusOrderByLikeCountDescCreatedAtDescIdDesc(String status);

    Page<PetGalleryPhoto> findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(String status, Pageable pageable);

    @Query("select p from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " order by p.createdAt desc, p.id desc")
    Page<PetGalleryPhoto> searchAdminPhotos(String status, String source, String keyword, Pageable pageable);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE)
    long countAdminPhotos(String status, String source, String keyword);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE
            + " and (p.source is null or p.source = '' or p.source = ?4)")
    long countAdminPhotosByUserUploadSource(String status, String source, String keyword, String userUploadSource);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.source = ?4")
    long countAdminPhotosBySource(String status, String source, String keyword, String countedSource);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.createdAt >= ?4")
    long countAdminRecentPhotos(String status, String source, String keyword, LocalDateTime since);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.fileSize > ?4")
    long countAdminLargePhotos(String status, String source, String keyword, long minFileSize);

    boolean existsByImageUrl(String imageUrl);

    @Query("select count(p) from PetGalleryPhoto p where p.userId = ?1 and p.status = ?2 and (p.source is null or p.source = '' or p.source = ?3)")
    long countUploadsByUserIdAndStatus(Long userId, String status, String source);

    @Query("select count(p) from PetGalleryPhoto p where p.ipAddress = ?1 and p.status = ?2 and (p.source is null or p.source = '' or p.source = ?3)")
    long countUploadsByIpAddressAndStatus(String ipAddress, String status, String source);

    @Query(value = "SELECT GET_LOCK(?1, 10)", nativeQuery = true)
    Long acquireUploadQuotaLock(String lockName);

    @Query(value = "SELECT RELEASE_LOCK(?1)", nativeQuery = true)
    Long releaseUploadQuotaLock(String lockName);

    @Modifying
    @Query("update PetGalleryPhoto p set p.likeCount = p.likeCount + 1 where p.id = ?1")
    int incrementLikeCount(Long photoId);
}
