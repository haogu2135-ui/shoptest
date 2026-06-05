package com.example.shop.service;

import com.example.shop.entity.Brand;
import com.example.shop.repository.BrandRepository;
import com.example.shop.util.ImageUrlValidator;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class BrandService {
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final BrandRepository brandRepository;

    public BrandService(BrandRepository brandRepository) {
        this.brandRepository = brandRepository;
    }

    public List<Brand> findAll(boolean activeOnly) {
        if (activeOnly) {
            return brandRepository.findByStatusOrderBySortOrderAscNameAsc("ACTIVE");
        }
        return brandRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    public List<Brand> findAll(boolean activeOnly, int maxRows) {
        Pageable page = PageRequest.of(0, Math.max(1, maxRows));
        if (activeOnly) {
            return brandRepository.findByStatusOrderBySortOrderAscNameAsc("ACTIVE", page);
        }
        return brandRepository.findAllByOrderBySortOrderAscNameAsc(page);
    }

    public Optional<Brand> findById(Long id) {
        return brandRepository.findById(id);
    }

    @Transactional
    public Brand save(Brand brand) {
        String name = brand.getName() == null ? "" : brand.getName().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Brand name is required");
        }
        brandRepository.findByNameIgnoreCase(name)
                .filter(existing -> brand.getId() == null || !existing.getId().equals(brand.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Brand name already exists");
                });
        brand.setName(name);
        brand.setLogoUrl(ImageUrlValidator.normalizePersistentImageUrl(brand.getLogoUrl(), "logoUrl"));
        brand.setStatus(normalizeStatus(brand.getStatus()));
        if (brand.getSortOrder() == null) {
            brand.setSortOrder(0);
        }
        return brandRepository.save(brand);
    }

    @Transactional
    public void deleteById(Long id) {
        brandRepository.deleteById(id);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Brand status must be ACTIVE or INACTIVE");
        }
        return normalized;
    }
}
