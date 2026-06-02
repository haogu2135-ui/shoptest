package com.example.shop.service;

import com.example.shop.entity.PetProfile;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PetProfileService {
    private final PetProfileMapper petProfileMapper;
    private final UserMapper userMapper;
    private final ProductService productService;
    private final RuntimeConfigService runtimeConfig;

    public List<PetProfile> findByUserId(Long userId) {
        return petProfileMapper.findByUserId(userId);
    }

    @Transactional
    public PetProfile save(Long userId, PetProfile request, Long id) {
        if (request == null) {
            throw new IllegalArgumentException("Pet profile is required");
        }
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("User is required");
        }
        PetProfile pet = new PetProfile();
        pet.setId(id);
        pet.setUserId(userId);
        pet.setName(normalizeRequiredText(request.getName(), "Pet name", maxNameChars()));
        pet.setPetType(normalizePetType(request.getPetType()));
        pet.setBreed(normalizeOptionalText(request.getBreed(), "Breed", maxBreedChars()));
        pet.setBirthday(normalizeBirthday(request.getBirthday()));
        pet.setWeight(normalizeWeight(request.getWeight()));
        pet.setSize(normalizeSize(request.getSize()));
        pet.setUpdatedAt(LocalDateTime.now());
        if (id == null) {
            lockOwnerForProfileCreate(userId);
            if (petProfileMapper.countByUserId(userId) >= maxProfilesPerUser()) {
                throw new IllegalStateException("Pet profile limit reached");
            }
            pet.setCreatedAt(LocalDateTime.now());
            petProfileMapper.insert(pet);
        } else if (petProfileMapper.update(pet) == 0) {
            throw new IllegalArgumentException("Pet profile not found");
        }
        productService.clearPersonalizedRecommendationCache(userId);
        return petProfileMapper.findById(pet.getId());
    }

    @Transactional
    public void delete(Long userId, Long id) {
        petProfileMapper.deleteByIdAndUserId(id, userId);
        productService.clearPersonalizedRecommendationCache(userId);
    }

    private void lockOwnerForProfileCreate(Long userId) {
        if (userMapper.findByIdForUpdate(userId) == null) {
            throw new IllegalArgumentException("User is required");
        }
    }

    private String normalizePetType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!"DOG".equals(normalized) && !"CAT".equals(normalized) && !"SMALL_PET".equals(normalized)) {
            return "DOG";
        }
        return normalized;
    }

    private String normalizeSize(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!"SMALL".equals(normalized) && !"MEDIUM".equals(normalized) && !"LARGE".equals(normalized)) {
            return null;
        }
        return normalized;
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private String normalizeRequiredText(String value, String field, int maxLength) {
        String normalized = normalizeOptionalText(value, field, maxLength);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value, String field, int maxLength) {
        String normalized = trimToNull(value == null ? null : value.replaceAll("\\p{Cntrl}", " "));
        if (normalized == null) {
            return null;
        }
        normalized = normalized.replaceAll("\\s+", " ");
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private java.time.LocalDate normalizeBirthday(java.time.LocalDate birthday) {
        if (birthday == null) {
            return null;
        }
        java.time.LocalDate today = java.time.LocalDate.now();
        if (birthday.isAfter(today)) {
            throw new IllegalArgumentException("Pet birthday cannot be in the future");
        }
        int maxAgeYears = Math.max(1, Math.min(runtimeConfig.getInt("pet-profile.max-age-years", 40), 100));
        if (birthday.isBefore(today.minusYears(maxAgeYears))) {
            throw new IllegalArgumentException("Pet birthday is too old");
        }
        return birthday;
    }

    private java.math.BigDecimal normalizeWeight(java.math.BigDecimal weight) {
        if (weight == null) {
            return null;
        }
        if (weight.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Pet weight must be positive");
        }
        java.math.BigDecimal maxWeight = runtimeConfig.getBigDecimal("pet-profile.max-weight-kg", new java.math.BigDecimal("200"));
        if (maxWeight == null || maxWeight.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            maxWeight = new java.math.BigDecimal("200");
        }
        if (weight.compareTo(maxWeight) > 0) {
            throw new IllegalArgumentException("Pet weight is too high");
        }
        return weight.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private int maxProfilesPerUser() {
        return Math.max(1, Math.min(runtimeConfig.getInt("pet-profile.max-per-user", 10), 50));
    }

    private int maxNameChars() {
        return Math.max(1, Math.min(runtimeConfig.getInt("pet-profile.name-max-chars", 60), 120));
    }

    private int maxBreedChars() {
        return Math.max(1, Math.min(runtimeConfig.getInt("pet-profile.breed-max-chars", 80), 160));
    }
}
