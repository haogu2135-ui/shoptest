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
    List<Category> findByParentIdIsNullOrderByNameAscIdAsc(Pageable pageable);
    List<Category> findByParentIdOrderByNameAscIdAsc(Long parentId, Pageable pageable);
    List<Category> findByParentIdIn(List<Long> parentIds);
    List<Category> findByLevelOrderByNameAscIdAsc(Integer level, Pageable pageable);
    @Query("select c.id from Category c where lower(coalesce(c.name, '')) like concat('%', :keyword, '%') escape '!'"
            + " or lower(coalesce(c.description, '')) like concat('%', :keyword, '%') escape '!'")
    List<Long> findIdsByKeyword(@Param("keyword") String keyword, Pageable pageable);
    boolean existsByParentId(Long parentId);
} 
