package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.repository.LogisticsCarrierRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
@Slf4j
public class LogisticsCarrierService {
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE");

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

    public List<LogisticsCarrier> findAll(boolean activeOnly, int maxRows) {
        Pageable page = PageRequest.of(0, Math.max(1, maxRows));
        if (activeOnly) {
            return logisticsCarrierRepository.findByStatusOrderBySortOrderAscNameAsc("ACTIVE", page);
        }
        return logisticsCarrierRepository.findAllByOrderBySortOrderAscNameAsc(page);
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
        carrier.setStatus(normalizeStatus(carrier.getStatus()));
        if (carrier.getSortOrder() == null) {
            carrier.setSortOrder(0);
        }
        return logisticsCarrierRepository.save(carrier);
    }

    @Transactional
    public void deleteById(Long id) {
        logisticsCarrierRepository.deleteById(id);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Carrier status must be ACTIVE or INACTIVE");
        }
        return normalized;
    }
}
