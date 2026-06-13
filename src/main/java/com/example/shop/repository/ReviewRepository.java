package com.example.shop.repository;

import com.example.shop.entity.Review;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {
    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.product p " +
            "JOIN FETCH r.user u " +
            "WHERE p.id = :productId")
    List<Review> findByProduct_Id(@Param("productId") Long productId);

    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.product p " +
            "JOIN FETCH r.user u " +
            "WHERE p.id = :productId AND r.status = 'APPROVED' " +
            "ORDER BY r.createdAt DESC, r.id DESC")
    List<Review> findApprovedPublicByProductId(@Param("productId") Long productId, Pageable pageable);

    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.product p " +
            "JOIN FETCH r.user u " +
            "WHERE p.id = :productId " +
            "AND (r.status = 'APPROVED' OR (r.status = 'PENDING' AND u.id = :userId)) " +
            "ORDER BY r.createdAt DESC, r.id DESC")
    List<Review> findPublicByProductIdIncludingUserPending(@Param("productId") Long productId, @Param("userId") Long userId, Pageable pageable);

    @Query("SELECT COUNT(r) FROM Review r " +
            "WHERE r.product.id = :productId " +
            "AND (r.status = 'APPROVED' OR (r.status = 'PENDING' AND r.user.id = :userId))")
    long countPublicByProductIdIncludingUserPending(@Param("productId") Long productId, @Param("userId") Long userId);
    boolean existsByProduct_IdAndUser_IdAndOrderId(Long productId, Long userId, Long orderId);
    List<Review> findByProduct_IdAndUser_IdAndOrderIdIn(Long productId, Long userId, List<Long> orderIds);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.product.id = :productId AND r.status = 'APPROVED'")
    double findAverageRatingByProductId(@Param("productId") Long productId);

    @Query("SELECT r.product.id, COUNT(r), SUM(CASE WHEN r.rating >= 4 THEN 1 ELSE 0 END), COALESCE(AVG(r.rating), 0) " +
            "FROM Review r WHERE r.product.id IN :productIds AND r.status = 'APPROVED' GROUP BY r.product.id")
    List<Object[]> summarizeApprovedReviewsByProductIds(@Param("productIds") List<Long> productIds);

    @Query("SELECT r FROM Review r " +
            "JOIN FETCH r.product p " +
            "JOIN FETCH r.user u " +
            "WHERE (:status IS NULL OR r.status = :status) " +
            "AND (:search IS NULL " +
            "OR LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(COALESCE(r.adminReply, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR (:searchId IS NOT NULL AND (r.id = :searchId OR p.id = :searchId))) " +
            "ORDER BY r.createdAt DESC, r.id DESC")
    List<Review> searchAdminReviews(@Param("status") String status, @Param("search") String search, @Param("searchId") Long searchId, Pageable pageable);

    @Query("SELECT COUNT(r) FROM Review r " +
            "WHERE (:status IS NULL OR r.status = :status) " +
            "AND (:search IS NULL " +
            "OR LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(COALESCE(r.adminReply, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.user.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR (:searchId IS NOT NULL AND (r.id = :searchId OR r.product.id = :searchId)))")
    long countAdminReviews(@Param("status") String status, @Param("search") String search, @Param("searchId") Long searchId);

    @Query("SELECT COUNT(r) FROM Review r " +
            "WHERE r.rating <= :maxRating " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:search IS NULL " +
            "OR LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(COALESCE(r.adminReply, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.user.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR (:searchId IS NOT NULL AND (r.id = :searchId OR r.product.id = :searchId)))")
    long countAdminLowRatingReviews(@Param("status") String status, @Param("search") String search, @Param("searchId") Long searchId, @Param("maxRating") int maxRating);

    @Query("SELECT COUNT(r) FROM Review r " +
            "WHERE TRIM(COALESCE(r.adminReply, '')) = '' " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:search IS NULL " +
            "OR LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(COALESCE(r.adminReply, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.user.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR (:searchId IS NOT NULL AND (r.id = :searchId OR r.product.id = :searchId)))")
    long countAdminNeedsReplyReviews(@Param("status") String status, @Param("search") String search, @Param("searchId") Long searchId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r " +
            "WHERE (:status IS NULL OR r.status = :status) " +
            "AND (:search IS NULL " +
            "OR LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(COALESCE(r.adminReply, '')) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.user.username) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR LOWER(r.product.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "OR (:searchId IS NOT NULL AND (r.id = :searchId OR r.product.id = :searchId)))")
    double averageAdminReviewRating(@Param("status") String status, @Param("search") String search, @Param("searchId") Long searchId);

    long countByProduct_IdAndStatus(Long productId, String status);

    long countByProduct_IdAndStatusAndRatingGreaterThanEqual(Long productId, String status, int rating);
}
