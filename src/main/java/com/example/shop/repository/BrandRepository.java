package com.example.shop.repository;

import com.example.shop.entity.Brand;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BrandRepository extends JpaRepository<Brand, Long> {
    List<Brand> findAllByOrderBySortOrderAscNameAsc();
    List<Brand> findAllByOrderBySortOrderAscNameAsc(Pageable pageable);
    List<Brand> findByStatusOrderBySortOrderAscNameAsc(String status);
    List<Brand> findByStatusOrderBySortOrderAscNameAsc(String status, Pageable pageable);
    Optional<Brand> findByNameIgnoreCase(String name);
}
