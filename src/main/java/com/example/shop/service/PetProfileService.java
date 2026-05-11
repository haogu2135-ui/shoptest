package com.example.shop.service;

import com.example.shop.entity.PetProfile;
import com.example.shop.repository.PetProfileMapper;
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

    public List<PetProfile> findByUserId(Long userId) {
        return petProfileMapper.findByUserId(userId);
    }

    @Transactional
    public PetProfile save(Long userId, PetProfile request, Long id) {
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Pet name is required");
        }
        PetProfile pet = new PetProfile();
        pet.setId(id);
        pet.setUserId(userId);
        pet.setName(request.getName().trim());
        pet.setPetType(normalizePetType(request.getPetType()));
        pet.setBreed(trimToNull(request.getBreed()));
        pet.setBirthday(request.getBirthday());
        pet.setWeight(request.getWeight());
        pet.setSize(normalizeSize(request.getSize()));
        pet.setUpdatedAt(LocalDateTime.now());
        if (id == null) {
            pet.setCreatedAt(LocalDateTime.now());
            petProfileMapper.insert(pet);
        } else if (petProfileMapper.update(pet) == 0) {
            throw new IllegalArgumentException("Pet profile not found");
        }
        return petProfileMapper.findById(pet.getId());
    }

    @Transactional
    public void delete(Long userId, Long id) {
        petProfileMapper.deleteByIdAndUserId(id, userId);
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
}
