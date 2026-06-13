package com.example.shop.repository;

import com.example.shop.entity.Category;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByOrderByLevelAscParentIdAscNameAscIdAsc(Pageable pageable);
    List<Category> findByParentIdIsNull();
    List<Category> findByParentId(Long parentId);
    List<Category> findByParentIdIn(List<Long> parentIds);
    List<Category> findByLevel(Integer level);
    @Query("select c.id from Category c where lower(coalesce(c.name, '')) like concat('%', :keyword, '%') escape '!'"
            + " or lower(coalesce(c.description, '')) like concat('%', :keyword, '%') escape '!'")
    List<Long> findIdsByKeyword(@Param("keyword") String keyword, Pageable pageable);
    boolean existsByParentId(Long parentId);
} 
