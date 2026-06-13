package com.example.shop.service;

import com.example.shop.entity.PetProfile;
import com.example.shop.entity.User;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PetProfileServiceTest {
    private PetProfileMapper petProfileMapper;
    private UserMapper userMapper;
    private ProductService productService;
    private RuntimeConfigService runtimeConfig;
    private PetProfileService service;

    @BeforeEach
    void setUp() {
        petProfileMapper = mock(PetProfileMapper.class);
        userMapper = mock(UserMapper.class);
        productService = mock(ProductService.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("pet-profile.max-per-user", 10)).thenReturn(2);
        when(runtimeConfig.getInt("pet-profile.name-max-chars", 60)).thenReturn(20);
        when(runtimeConfig.getInt("pet-profile.breed-max-chars", 80)).thenReturn(30);
        when(runtimeConfig.getInt("pet-profile.max-age-years", 40)).thenReturn(40);
        when(runtimeConfig.getBigDecimal("pet-profile.max-weight-kg", new BigDecimal("200"))).thenReturn(new BigDecimal("80"));
        service = new PetProfileService(petProfileMapper, userMapper, productService, runtimeConfig);
    }

    @Test
    void saveNormalizesPetProfileBeforeInsert() {
        PetProfile request = new PetProfile();
        request.setName("  Luna\tBell  ");
        request.setPetType(" cat ");
        request.setBreed("  British\nShort\u0000hair ");
        request.setBirthday(LocalDate.now().minusYears(3));
        request.setWeight(new BigDecimal("4.235"));
        request.setSize(" small ");
        when(userMapper.findByIdForUpdate(7L)).thenReturn(new User());
        when(petProfileMapper.countByUserId(7L)).thenReturn(0);
        when(petProfileMapper.findById(null)).thenReturn(request);

        service.save(7L, request, null);

        verify(petProfileMapper).insert(org.mockito.ArgumentMatchers.argThat(pet ->
                "Luna Bell".equals(pet.getName())
                        && "CAT".equals(pet.getPetType())
                        && "British Short hair".equals(pet.getBreed())
                        && new BigDecimal("4.24").equals(pet.getWeight())
                        && "SMALL".equals(pet.getSize())));
        verify(productService).clearPersonalizedRecommendationCache(7L);
    }

    @Test
    void saveRejectsProfileLimitBeforeInsert() {
        PetProfile request = validRequest();
        when(userMapper.findByIdForUpdate(7L)).thenReturn(new User());
        when(petProfileMapper.countByUserId(7L)).thenReturn(2);

        assertThrows(IllegalStateException.class, () -> service.save(7L, request, null));

        verify(petProfileMapper, never()).insert(any());
    }

    @Test
    void saveRejectsFutureBirthday() {
        PetProfile request = validRequest();
        request.setBirthday(LocalDate.now().plusDays(1));

        assertThrows(IllegalArgumentException.class, () -> service.save(7L, request, null));
    }

    @Test
    void saveRejectsInvalidWeight() {
        PetProfile request = validRequest();
        request.setWeight(new BigDecimal("81.00"));

        assertThrows(IllegalArgumentException.class, () -> service.save(7L, request, null));
    }

    @Test
    void updateDoesNotCheckCreateLimit() {
        PetProfile request = validRequest();
        when(petProfileMapper.update(any(PetProfile.class))).thenReturn(1);
        when(petProfileMapper.findById(12L)).thenReturn(request);

        service.save(7L, request, 12L);

        verify(userMapper, never()).findByIdForUpdate(7L);
        verify(petProfileMapper, never()).countByUserId(7L);
        verify(petProfileMapper).update(any(PetProfile.class));
    }

    @Test
    void findByUserIdUsesConfiguredBoundedLimit() {
        PetProfile profile = validRequest();
        when(petProfileMapper.findByUserId(7L, 2)).thenReturn(List.of(profile));

        assertEquals(List.of(profile), service.findByUserId(7L));

        verify(petProfileMapper).findByUserId(7L, 2);
    }

    @Test
    void findByUserIdRejectsInvalidUserIdBeforeMapperCall() {
        assertThrows(IllegalArgumentException.class, () -> service.findByUserId(0L));

        verify(petProfileMapper, never()).findByUserId(any(), org.mockito.ArgumentMatchers.anyInt());
    }

    private PetProfile validRequest() {
        PetProfile request = new PetProfile();
        request.setName("Luna");
        request.setPetType("DOG");
        request.setBreed("Mixed");
        request.setBirthday(LocalDate.now().minusYears(2));
        request.setWeight(new BigDecimal("12.50"));
        request.setSize("MEDIUM");
        return request;
    }
}
