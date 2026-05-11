package com.example.shop.repository;

import com.example.shop.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByIsFeaturedTrueOrderByIdAsc();
    List<Product> findByCategoryId(Long categoryId);
    List<Product> findByCategoryIdIn(List<Long> categoryIds);
    List<Product> findByNameContainingIgnoreCase(String keyword);

    @Modifying
    @Query("update Product p set p.stock = p.stock - ?2 where p.id = ?1 and p.stock >= ?2")
    int decreaseStock(Long productId, Integer quantity);

    @Modifying
    @Query("update Product p set p.stock = p.stock + ?2 where p.id = ?1")
    int increaseStock(Long productId, Integer quantity);
} 
