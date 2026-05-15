package com.example.shop.repository;

import com.example.shop.entity.PetBirthdayCouponConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PetBirthdayCouponConfigRepository extends JpaRepository<PetBirthdayCouponConfig, Long> {
}
