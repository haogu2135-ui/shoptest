package com.example.shop.repository;

import com.example.shop.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ProductMapper {
    List<Product> findAll();
    Product findById(Long id);
    List<Product> findByCategory(Long categoryId);
    int insert(Product product);
    int update(Product product);
    int deleteById(Long id);
    int decreaseStock(@Param("productId") Long productId, @Param("quantity") int quantity);
} 