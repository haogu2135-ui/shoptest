package com.example.shop.service;

import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.repository.LogisticsCarrierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class LogisticsCarrierService {
    private final LogisticsCarrierRepository logisticsCarrierRepository;

    public LogisticsCarrierService(LogisticsCarrierRepository logisticsCarrierRepository) {
        this.logisticsCarrierRepository = logisticsCarrierRepository;
    }

    public List<LogisticsCarrier> findAll(boolean activeOnly) {
        if (activeOnly) {
            return logisticsCarrierRepository.findByStatusOrderBySortOrderAscNameAsc("ACTIVE");
        }
        return logisticsCarrierRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    public Optional<LogisticsCarrier> findById(Long id) {
        return logisticsCarrierRepository.findById(id);
    }

    @Transactional
    public LogisticsCarrier save(LogisticsCarrier carrier) {
        String name = carrier.getName() == null ? "" : carrier.getName().trim();
        String trackingCode = carrier.getTrackingCode() == null ? "" : carrier.getTrackingCode().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Carrier name is required");
        }
        if (trackingCode.isEmpty()) {
            throw new IllegalArgumentException("17TRACK carrier code is required");
        }
        logisticsCarrierRepository.findByNameIgnoreCase(name)
                .filter(existing -> carrier.getId() == null || !existing.getId().equals(carrier.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Carrier name already exists");
                });
        logisticsCarrierRepository.findByTrackingCodeIgnoreCase(trackingCode)
                .filter(existing -> carrier.getId() == null || !existing.getId().equals(carrier.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("17TRACK carrier code already exists");
                });
        carrier.setName(name);
        carrier.setTrackingCode(trackingCode);
        if (carrier.getStatus() == null || carrier.getStatus().isEmpty()) {
            carrier.setStatus("ACTIVE");
        }
        if (carrier.getSortOrder() == null) {
            carrier.setSortOrder(0);
        }
        return logisticsCarrierRepository.save(carrier);
    }

    @Transactional
    public void deleteById(Long id) {
        logisticsCarrierRepository.deleteById(id);
    }
}
