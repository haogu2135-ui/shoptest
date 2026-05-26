package com.example.shop.repository;

import com.example.shop.entity.Product;
import javax.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByIsFeaturedTrueOrderByIdAsc();
    List<Product> findByCategoryId(Long categoryId);
    @Query("select p from Product p where p.categoryId = :categoryId and (p.status is null or upper(p.status) = 'ACTIVE') order by p.id asc")
    List<Product> findActiveByCategoryId(@Param("categoryId") Long categoryId, Pageable pageable);
    List<Product> findByCategoryIdIn(List<Long> categoryIds);
    List<Product> findByNameContainingIgnoreCase(String keyword);
    @Query("select count(p) from Product p where upper(coalesce(p.status, '')) = 'ACTIVE'")
    long countActiveProducts();
    @Query("select count(p) from Product p where upper(coalesce(p.status, '')) = 'PENDING_REVIEW'")
    long countPendingReviewProducts();
    @Query("select count(p) from Product p where p.stock is not null and p.stock < 10")
    long countLowStockProducts();
    @Query("select p from Product p where p.stock is not null and p.stock < 10 order by p.stock asc, p.id asc")
    List<Product> findLowStockProducts(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id in :ids")
    List<Product> findAllByIdForUpdate(@Param("ids") List<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Product findByIdForUpdate(@Param("id") Long id);

    @Modifying
    @Query(value = "update products set stock = stock - ?2, updated_at = current_timestamp where id = ?1 and stock >= ?2",
            nativeQuery = true)
    int decreaseStock(Long productId, Integer quantity);

    @Modifying
    @Query(value = "update products set stock = stock + ?2, updated_at = current_timestamp where id = ?1",
            nativeQuery = true)
    int increaseStock(Long productId, Integer quantity);
} 
