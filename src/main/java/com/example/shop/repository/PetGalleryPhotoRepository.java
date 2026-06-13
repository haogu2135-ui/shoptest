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
            + " or str(p.id) like :keyword"
            + " or str(p.userId) like :keyword"
            + " or lower(coalesce(p.username, '')) like :keyword"
            + " or lower(coalesce(p.ipAddress, '')) like :keyword"
            + " or lower(coalesce(p.originalFilename, '')) like :keyword"
            + " or lower(coalesce(p.contentType, '')) like :keyword"
            + " or lower(coalesce(p.imageUrl, '')) like :keyword"
            + " or lower(coalesce(p.status, '')) like :keyword"
            + " or lower(coalesce(p.source, '')) like :keyword)";

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

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE)
    long countAdminPhotos(@Param("status") String status,
                          @Param("source") String source,
                          @Param("keyword") String keyword);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE
            + " and (p.source is null or p.source = '' or p.source = :userUploadSource)")
    long countAdminPhotosByUserUploadSource(@Param("status") String status,
                                            @Param("source") String source,
                                            @Param("keyword") String keyword,
                                            @Param("userUploadSource") String userUploadSource);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.source = :countedSource")
    long countAdminPhotosBySource(@Param("status") String status,
                                  @Param("source") String source,
                                  @Param("keyword") String keyword,
                                  @Param("countedSource") String countedSource);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.createdAt >= :since")
    long countAdminRecentPhotos(@Param("status") String status,
                                @Param("source") String source,
                                @Param("keyword") String keyword,
                                @Param("since") LocalDateTime since);

    @Query("select count(p) from PetGalleryPhoto p" + ADMIN_FILTER_CLAUSE + " and p.fileSize > :minFileSize")
    long countAdminLargePhotos(@Param("status") String status,
                               @Param("source") String source,
                               @Param("keyword") String keyword,
                               @Param("minFileSize") long minFileSize);

    boolean existsByImageUrl(String imageUrl);

    @Query("select count(p) from PetGalleryPhoto p where p.userId = :userId"
            + " and p.status = :status and (p.source is null or p.source = '' or p.source = :source)")
    long countUploadsByUserIdAndStatus(@Param("userId") Long userId,
                                       @Param("status") String status,
                                       @Param("source") String source);

    @Query("select count(p) from PetGalleryPhoto p where p.ipAddress = :ipAddress"
            + " and p.status = :status and (p.source is null or p.source = '' or p.source = :source)")
    long countUploadsByIpAddressAndStatus(@Param("ipAddress") String ipAddress,
                                          @Param("status") String status,
                                          @Param("source") String source);

    @Query(value = "SELECT GET_LOCK(:lockName, 10)", nativeQuery = true)
    Long acquireUploadQuotaLock(@Param("lockName") String lockName);

    @Query(value = "SELECT RELEASE_LOCK(:lockName)", nativeQuery = true)
    Long releaseUploadQuotaLock(@Param("lockName") String lockName);
}
