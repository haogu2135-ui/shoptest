package com.example.shop.repository;

import com.example.shop.entity.LogisticsCarrier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LogisticsCarrierRepository extends JpaRepository<LogisticsCarrier, Long> {
    List<LogisticsCarrier> findAllByOrderBySortOrderAscNameAsc();
    List<LogisticsCarrier> findByStatusOrderBySortOrderAscNameAsc(String status);
    Optional<LogisticsCarrier> findByNameIgnoreCase(String name);
    Optional<LogisticsCarrier> findByTrackingCodeIgnoreCase(String trackingCode);
}
