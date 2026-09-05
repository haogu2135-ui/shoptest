package com.example.shop.repository;

import com.example.shop.entity.PetGalleryPhoto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PetGalleryPhotoRepository extends JpaRepository<PetGalleryPhoto, Long> {
    String ADMIN_FILTER_CLAUSE = " where (:status is null or p.status = :status)"
            + " and (:source is null or coalesce(p.source, '') = :source)"
            + " and (:keyword is null"
            + " or str(p.id) like :keyword escape '!'"
            + " or str(p.userId) like :keyword escape '!'"
            + " or lower(coalesce(p.username, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.ipAddress, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.originalFilename, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.contentType, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.imageUrl, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.status, '')) like :keyword escape '!'"
            + " or lower(coalesce(p.source, '')) like :keyword escape '!')";

    @Query("select p from PetGalleryPhoto p where p.status = :status order by p.likeCount desc, p.createdAt desc, p.id desc")
    List<PetGalleryPhoto> findTopPublicPhotos(@Param("status") String status, Pageable pageable);

    Page<PetGalleryPhoto> findByStatusOrderByLikeCountDescCreatedAtDescIdDesc(String status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PetGalleryPhoto p where p.id = :photoId")
    Optional<PetGalleryPhoto> findByIdForLikeUpdate(@Param("photoId") Long photoId);

    @Query("select p from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " order by p.createdAt desc, p.id desc")
    Page<PetGalleryPhoto> searchAdminPhotos(@Param("status") String status,
                                            @Param("source") String source,
                                            @Param("keyword") String keyword,
                                            Pageable pageable);

    @Query("select p.imageUrl from PetGalleryPhoto p where p.imageUrl in :imageUrls")
    List<String> findImageUrlsByImageUrlIn(@Param("imageUrls") List<String> imageUrls);

    @Query("select count(p),"
            + " coalesce(sum(case when p.source is null or p.source = '' or p.source = :userUploadSource then 1 else 0 end), 0),"
            + " coalesce(sum(case when p.source = :seedSource then 1 else 0 end), 0),"
            + " coalesce(sum(case when p.createdAt >= :since then 1 else 0 end), 0),"
            + " coalesce(sum(case when p.fileSize > :minFileSize then 1 else 0 end), 0)"
            + " from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE)
    List<Object[]> summarizeAdminMetrics(@Param("status") String status,
                                         @Param("source") String source,
                                         @Param("keyword") String keyword,
                                         @Param("userUploadSource") String userUploadSource,
                                         @Param("seedSource") String seedSource,
                                         @Param("since") LocalDateTime since,
                                         @Param("minFileSize") long minFileSize);

    boolean existsByImageUrl(String imageUrl);

    @Query("select coalesce(sum(case when p.userId = :userId then 1 else 0 end), 0),"
            + " coalesce(sum(case when p.ipAddress = :ipAddress then 1 else 0 end), 0)"
            + " from PetGalleryPhoto p where p.status = :status"
            + " and (p.source is null or p.source = '' or p.source = :source)")
    Object[] countUploadsByUserIdAndIpAddressAndStatus(@Param("userId") Long userId,
                                                       @Param("ipAddress") String ipAddress,
                                                       @Param("status") String status,
                                                       @Param("source") String source);

    @Query(value = "SELECT GET_LOCK(:lockName, 10)", nativeQuery = true)
    Long acquireUploadQuotaLock(@Param("lockName") String lockName);

    @Query(value = "SELECT RELEASE_LOCK(:lockName)", nativeQuery = true)
    Long releaseUploadQuotaLock(@Param("lockName") String lockName);
}
