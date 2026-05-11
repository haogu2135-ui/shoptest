package com.example.shop.service;

import com.example.shop.entity.Brand;
import com.example.shop.repository.BrandRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class BrandService {
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
        if (brand.getStatus() == null || brand.getStatus().isEmpty()) {
            brand.setStatus("ACTIVE");
        }
        if (brand.getSortOrder() == null) {
            brand.setSortOrder(0);
        }
        return brandRepository.save(brand);
    }

    @Transactional
    public void deleteById(Long id) {
        brandRepository.deleteById(id);
    }
}
