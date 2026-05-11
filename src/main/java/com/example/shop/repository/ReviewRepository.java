package com.example.shop.repository;

import com.example.shop.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByProduct_Id(Long productId);
    List<Review> findByProduct_IdAndStatusOrderByCreatedAtDesc(Long productId, String status);
    boolean existsByProduct_IdAndUser_IdAndOrderId(Long productId, Long userId, Long orderId);
    
    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.product.id = :productId AND r.status = 'APPROVED'")
    double findAverageRatingByProductId(@Param("productId") Long productId);

    long countByProduct_IdAndStatus(Long productId, String status);

    long countByProduct_IdAndStatusAndRatingGreaterThanEqual(Long productId, String status, int rating);
} 
