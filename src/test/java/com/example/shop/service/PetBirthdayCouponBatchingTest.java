package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.never;

import com.example.shop.entity.Coupon;
import com.example.shop.entity.PetBirthdayCouponConfig;
import com.example.shop.entity.PetProfile;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.PetBirthdayCouponConfigRepository;
import com.example.shop.repository.PetBirthdayCouponGrantMapper;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.UserCouponMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PetBirthdayCouponBatchingTest {
    @Mock
    private PetProfileMapper petProfileMapper;
    @Mock
    private CouponRepository couponRepository;
    @Mock
    private PetBirthdayCouponConfigRepository configRepository;
    @Mock
    private UserCouponMapper userCouponMapper;
    @Mock
    private PetBirthdayCouponGrantMapper grantMapper;
    @Mock
    private RuntimeConfigService runtimeConfig;
    @InjectMocks
    private PetBirthdayCouponService service;

    private final LocalDate date = LocalDate.of(2026, 9, 4);
    private final PetBirthdayCouponConfig config = new PetBirthdayCouponConfig();
    private final Coupon coupon = new Coupon();

    @BeforeEach
    void setUp() {
        config.setId(1L);
        config.setEnabled(true);
        config.setNamePrefix("Birthday Gift");
        config.setCouponType("FULL_REDUCTION");
        config.setThresholdAmount(BigDecimal.ZERO);
        config.setReductionAmount(new BigDecimal("10.00"));
        config.setValidDays(14);
        config.setMaxBenefitsPerUser(3);
        coupon.setId(100L);
        coupon.setStartAt(date.atStartOfDay());
        coupon.setEndAt(date.plusDays(14).atTime(23, 59, 59));
        when(configRepository.findById(1L)).thenReturn(Optional.of(config));
        when(couponRepository.findFirstByNameOrderByIdDesc(anyString())).thenReturn(Optional.of(coupon));
        when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(grantMapper.insertIgnore(anyLong(), anyLong(), eq(100L), eq(2026))).thenReturn(1);
    }

    @Test
    void processesAllBirthdayPetsAcrossKeysetBatches() {
        when(runtimeConfig.getInt("pet.birthday-coupon-scan-batch-size", 500)).thenReturn(1);
        when(petProfileMapper.findBirthdayPetsAfterId(9, 4, 0L, 1))
                .thenReturn(List.of(pet(11L, 21L)));
        when(petProfileMapper.findBirthdayPetsAfterId(9, 4, 11L, 1))
                .thenReturn(List.of(pet(23L, 22L)));
        when(petProfileMapper.findBirthdayPetsAfterId(9, 4, 23L, 1))
                .thenReturn(List.of());
        when(grantMapper.countByUserIdsAndBirthdayYear(any(), eq(2026))).thenReturn(List.of());

        assertEquals(2, service.grantBirthdayCoupons(date));

        ArgumentCaptor<Long> afterId = ArgumentCaptor.forClass(Long.class);
        verify(petProfileMapper, times(3)).findBirthdayPetsAfterId(eq(9), eq(4), afterId.capture(), eq(1));
        assertEquals(List.of(0L, 11L, 23L), afterId.getAllValues());
        verify(grantMapper).insertIgnore(11L, 21L, 100L, 2026);
        verify(grantMapper).insertIgnore(23L, 22L, 100L, 2026);
    }

    @Test
    void enforcesPerUserLimitFromOneBatchCountAndInMemoryReservations() {
        config.setMaxBenefitsPerUser(1);
        when(runtimeConfig.getInt("pet.birthday-coupon-scan-batch-size", 500)).thenReturn(10);
        when(petProfileMapper.findBirthdayPetsAfterId(9, 4, 0L, 10))
                .thenReturn(List.of(pet(11L, 21L), pet(12L, 21L)));
        when(grantMapper.countByUserIdsAndBirthdayYear(List.of(21L), 2026))
                .thenReturn(List.of(java.util.Map.of("userId", 21L, "grantCount", 0L)));

        assertEquals(1, service.grantBirthdayCoupons(date));

        verify(grantMapper).countByUserIdsAndBirthdayYear(List.of(21L), 2026);
        verify(grantMapper).insertIgnore(11L, 21L, 100L, 2026);
        verify(grantMapper, never()).insertIgnore(12L, 21L, 100L, 2026);
    }

    @Test
    void reissueUsesTheConfiguredPerUserPetLimitAtMapperBoundary() {
        when(runtimeConfig.getInt("pet-profile.max-per-user", 10)).thenReturn(10);
        when(petProfileMapper.findBirthdayPetsByUserId(21L, 9, 4, 10))
                .thenReturn(List.of(pet(11L, 21L)));

        assertEquals(1, service.reissueBirthdayCoupons(21L, date));

        verify(petProfileMapper).findBirthdayPetsByUserId(21L, 9, 4, 10);
    }

    private PetProfile pet(Long id, Long userId) {
        PetProfile pet = new PetProfile();
        pet.setId(id);
        pet.setUserId(userId);
        pet.setName("Pet " + id);
        return pet;
    }
}
