package com.example.shop.service;

import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.UserCouponMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CouponServiceTest {
    private CouponRepository couponRepository;
    private UserCouponMapper userCouponMapper;
    private UserMapper userMapper;
    private PetBirthdayCouponService petBirthdayCouponService;
    private RuntimeConfigService runtimeConfig;
    private CouponService service;

    @BeforeEach
    void setUp() {
        couponRepository = mock(CouponRepository.class);
        userCouponMapper = mock(UserCouponMapper.class);
        userMapper = mock(UserMapper.class);
        petBirthdayCouponService = mock(PetBirthdayCouponService.class);
        runtimeConfig = runtimeConfig();
        service = new CouponService(
                couponRepository,
                userCouponMapper,
                userMapper,
                petBirthdayCouponService,
                runtimeConfig
        );
    }

    @Test
    void publicCouponListOnlyReturnsCurrentlyClaimableCoupons() {
        Coupon expected = new Coupon();
        expected.setId(8L);
        when(couponRepository.findClaimableByScopeAndStatus(eq("PUBLIC"), eq("ACTIVE"), any(), any(Pageable.class)))
                .thenReturn(Collections.singletonList(expected));

        assertEquals(Collections.singletonList(expected), service.findPublicActive());

        ArgumentCaptor<java.time.LocalDateTime> nowCaptor = ArgumentCaptor.forClass(java.time.LocalDateTime.class);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(couponRepository).findClaimableByScopeAndStatus(eq("PUBLIC"), eq("ACTIVE"), nowCaptor.capture(), pageableCaptor.capture());
        org.junit.jupiter.api.Assertions.assertNotNull(nowCaptor.getValue());
        assertEquals(100, pageableCaptor.getValue().getPageSize());
    }

    @Test
    void adminSummaryUsesRepositoryAggregatesAndRuntimeLimits() {
        when(runtimeConfig.getInt("admin.coupons.search-max-rows", 500)).thenReturn(750);
        when(runtimeConfig.getInt("admin.coupons.grant-max-users", 200)).thenReturn(50);
        when(runtimeConfig.getInt("coupon.public-list-max-rows", 100)).thenReturn(80);
        when(runtimeConfig.getInt("coupon.wallet-max-rows", 300)).thenReturn(250);
        when(runtimeConfig.getInt("coupon.available-max-rows", 100)).thenReturn(70);
        when(runtimeConfig.getInt("admin.coupons.name-max-chars", 120)).thenReturn(140);
        when(runtimeConfig.getInt("admin.coupons.description-max-chars", 1000)).thenReturn(900);
        when(runtimeConfig.getInt("admin.coupons.total-quantity-max", 100_000)).thenReturn(200_000);
        when(runtimeConfig.getInt("admin.coupons.expiring-soon-days", 7)).thenReturn(14);
        when(runtimeConfig.getInt("admin.coupons.low-remaining-threshold", 10)).thenReturn(25);
        when(couponRepository.countAdminCoupons(isNull(), isNull(), isNull(), isNull())).thenReturn(11L);
        when(couponRepository.countAdminCoupons(isNull(), isNull(), eq("ACTIVE"), isNull())).thenReturn(7L);
        when(couponRepository.countAdminCoupons(isNull(), isNull(), eq("INACTIVE"), isNull())).thenReturn(4L);
        when(couponRepository.countAdminCoupons(isNull(), isNull(), eq("ACTIVE"), eq("PUBLIC"))).thenReturn(5L);
        when(couponRepository.countAdminActiveExpiringBetween(
                isNull(), isNull(), isNull(), isNull(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(2L);
        when(couponRepository.countAdminActiveLowRemaining(isNull(), isNull(), isNull(), isNull(), eq(25)))
                .thenReturn(3L);

        CouponAdminSummaryResponse summary = service.adminSummary();

        assertEquals(11L, summary.getTotalCoupons());
        assertEquals(7L, summary.getActiveCoupons());
        assertEquals(4L, summary.getInactiveCoupons());
        assertEquals(5L, summary.getPublicActiveCoupons());
        assertEquals(2L, summary.getExpiringSoonCoupons());
        assertEquals(3L, summary.getLowRemainingCoupons());
        assertEquals(750, summary.getMaxSearchRows());
        assertEquals(50, summary.getMaxGrantUsers());
        assertEquals(80, summary.getMaxPublicRows());
        assertEquals(250, summary.getWalletMaxRows());
        assertEquals(70, summary.getAvailableMaxRows());
        assertEquals(140, summary.getNameMaxChars());
        assertEquals(900, summary.getDescriptionMaxChars());
        assertEquals(200_000, summary.getTotalQuantityMax());
        assertEquals(14, summary.getExpiringSoonDays());
        assertEquals(25, summary.getLowRemainingThreshold());
        org.junit.jupiter.api.Assertions.assertNotNull(summary.getCheckedAt());

        ArgumentCaptor<LocalDateTime> startCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(couponRepository).countAdminActiveExpiringBetween(
                isNull(), isNull(), isNull(), isNull(), startCaptor.capture(), endCaptor.capture());
        assertEquals(14, java.time.Duration.between(startCaptor.getValue(), endCaptor.getValue()).toDays());
    }

    @Test
    void discountPercentRepresentsPayablePercentInQuotes() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setStatus("UNUSED");
        coupon.setCouponStatus("ACTIVE");
        coupon.setCouponType("DISCOUNT");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setDiscountPercent(80);

        when(userCouponMapper.findUnusedByUserIdLimited(eq(3L), eq(100))).thenReturn(Collections.singletonList(coupon));
        when(userCouponMapper.findByIdAndUserId(6L, 3L)).thenReturn(coupon);

        CartItem item = new CartItem();
        item.setPrice(new BigDecimal("100.00"));
        item.setQuantity(1);

        assertEquals(new BigDecimal("20.00"), service.quote(3L, List.of(item), 6L).getDiscountAmount());
    }

    @Test
    void quoteSubtotalRoundsEachCartLineBeforeSumming() {
        when(userCouponMapper.findUnusedByUserIdLimited(eq(3L), eq(100))).thenReturn(Collections.emptyList());

        CartItem first = new CartItem();
        first.setPrice(new BigDecimal("10.005"));
        first.setQuantity(1);
        CartItem second = new CartItem();
        second.setPrice(new BigDecimal("10.005"));
        second.setQuantity(1);

        assertEquals(new BigDecimal("20.02"), service.quote(3L, List.of(first, second), null).getSubtotal());
    }

    @Test
    void discountPercentRepresentsPayablePercentWhenUsingCoupon() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setCouponId(5L);
        coupon.setCouponName("Pay 80 percent");
        coupon.setStatus("UNUSED");
        coupon.setCouponStatus("ACTIVE");
        coupon.setCouponType("DISCOUNT");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setDiscountPercent(80);
        when(userCouponMapper.findByIdAndUserId(6L, 3L)).thenReturn(coupon);
        when(userCouponMapper.markUsed(6L, 42L)).thenReturn(1);
        when(couponRepository.incrementUsedCount(5L)).thenReturn(1);

        CouponService.AppliedCoupon applied = service.useCoupon(3L, 6L, new BigDecimal("100.00"), 42L);

        assertEquals(6L, applied.getUserCouponId());
        assertEquals(5L, applied.getCouponId());
        assertEquals("Pay 80 percent", applied.getCouponName());
        assertEquals(new BigDecimal("20.00"), applied.getDiscountAmount());
        verify(userCouponMapper).markUsed(6L, 42L);
        verify(couponRepository).incrementUsedCount(5L);
    }

    @Test
    void useCouponDoesNotIncrementUsageWhenCouponWasAlreadyUsed() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setCouponId(5L);
        coupon.setStatus("UNUSED");
        coupon.setCouponStatus("ACTIVE");
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setReductionAmount(new BigDecimal("10.00"));
        when(userCouponMapper.findByIdAndUserId(6L, 3L)).thenReturn(coupon);
        when(userCouponMapper.markUsed(6L, 42L)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> service.useCoupon(3L, 6L, new BigDecimal("100.00"), 42L));

        verify(couponRepository, never()).incrementUsedCount(5L);
    }

    @Test
    void releaseUsedCouponDecrementsUsageWhenStatusChangesBackToUnused() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setCouponId(5L);
        coupon.setStatus("USED");
        when(userCouponMapper.findById(6L)).thenReturn(coupon);
        when(userCouponMapper.releaseUsed(6L)).thenReturn(1);

        service.releaseUsedCoupon(6L);

        verify(userCouponMapper).releaseUsed(6L);
        verify(couponRepository).decrementUsedCount(5L);
    }

    @Test
    void releaseUsedCouponDoesNotDecrementUsageWhenCouponIsNotUsed() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setCouponId(5L);
        coupon.setStatus("UNUSED");
        when(userCouponMapper.findById(6L)).thenReturn(coupon);

        service.releaseUsedCoupon(6L);

        verify(userCouponMapper, never()).releaseUsed(6L);
        verify(couponRepository, never()).decrementUsedCount(5L);
    }

    @Test
    void saveNormalizesDiscountCouponAndAllowsUnlimitedMaxDiscount() {
        com.example.shop.dto.CouponUpsertRequest request = new com.example.shop.dto.CouponUpsertRequest();
        request.setName("  Spring\nSale  ");
        request.setCouponType(" discount ");
        request.setStatus("active");
        request.setScope("assigned");
        request.setThresholdAmount(new BigDecimal("99.995"));
        request.setReductionAmount(new BigDecimal("30.00"));
        request.setDiscountPercent(80);
        request.setMaxDiscountAmount(BigDecimal.ZERO);
        request.setTotalQuantity(50);
        request.setDescription("  VIP\tretention\ncoupon  ");
        when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Coupon saved = service.save(request, null);

        assertEquals("Spring Sale", saved.getName());
        assertEquals("DISCOUNT", saved.getCouponType());
        assertEquals("ACTIVE", saved.getStatus());
        assertEquals("ASSIGNED", saved.getScope());
        assertEquals(new BigDecimal("100.00"), saved.getThresholdAmount());
        assertEquals(new BigDecimal("0.00"), saved.getReductionAmount());
        assertEquals(80, saved.getDiscountPercent());
        assertEquals(new BigDecimal("0.00"), saved.getMaxDiscountAmount());
        assertEquals(50, saved.getTotalQuantity());
        assertEquals("VIP retention coupon", saved.getDescription());
    }

    @Test
    void saveRejectsInvalidCouponBoundaries() {
        com.example.shop.dto.CouponUpsertRequest request = new com.example.shop.dto.CouponUpsertRequest();
        request.setName("Too Much");
        request.setCouponType("FULL_REDUCTION");
        request.setReductionAmount(new BigDecimal("10.00"));
        request.setTotalQuantity(100_001);

        assertThrows(IllegalArgumentException.class, () -> service.save(request, null));
        verify(couponRepository, never()).save(any(Coupon.class));
    }

    @Test
    void saveRejectsInvalidDiscountCouponPercentagesBeforePersisting() {
        for (Integer discountPercent : Arrays.asList(null, -10, 0, 100, 150)) {
            com.example.shop.dto.CouponUpsertRequest request = new com.example.shop.dto.CouponUpsertRequest();
            request.setName("Invalid discount " + discountPercent);
            request.setCouponType("DISCOUNT");
            request.setDiscountPercent(discountPercent);

            IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                    () -> service.save(request, null),
                    "discountPercent=" + discountPercent);

            assertEquals("Discount percent must be between 1 and 99", error.getMessage());
        }
        verify(couponRepository, never()).save(any(Coupon.class));
    }

    @Test
    void deleteCleansUnusedAssignmentsBeforeDeletingCoupon() {
        when(couponRepository.existsById(5L)).thenReturn(true);
        when(userCouponMapper.countUsedByCouponId(5L)).thenReturn(0);

        service.delete(5L);

        verify(petBirthdayCouponService).deleteBirthdayCouponRecords(5L);
        verify(couponRepository).deleteById(5L);
    }

    @Test
    void deleteRejectsCouponsWithUsedAssignmentsBeforeCleanup() {
        when(couponRepository.existsById(5L)).thenReturn(true);
        when(userCouponMapper.countUsedByCouponId(5L)).thenReturn(1);

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.delete(5L));

        assertEquals("Cannot delete coupon that has been used in orders", error.getMessage());
        verify(petBirthdayCouponService, never()).deleteBirthdayCouponRecords(5L);
        verify(couponRepository, never()).deleteById(5L);
    }

    @Test
    void grantDeduplicatesPositiveUserIdsBeforeIssuing() {
        Coupon coupon = activePublicCoupon();
        when(couponRepository.findById(5L)).thenReturn(Optional.of(coupon));
        when(userMapper.findExistingIds(List.of(2L, 3L))).thenReturn(List.of(2L, 3L));
        when(couponRepository.incrementClaimedQuantity(5L)).thenReturn(1);

        int granted = service.grant(5L, Arrays.asList(2L, 2L, null, -1L, 3L));

        assertEquals(2, granted);
        ArgumentCaptor<UserCoupon> userCouponCaptor = ArgumentCaptor.forClass(UserCoupon.class);
        verify(userCouponMapper, org.mockito.Mockito.times(2)).insert(userCouponCaptor.capture());
        assertEquals(List.of(2L, 3L), userCouponCaptor.getAllValues().stream()
                .map(UserCoupon::getUserId)
                .collect(Collectors.toList()));
    }

    @Test
    void grantRejectsUnknownRecipientsBeforeQuantityIncrement() {
        Coupon coupon = activePublicCoupon();
        when(couponRepository.findById(5L)).thenReturn(Optional.of(coupon));
        when(userMapper.findExistingIds(List.of(2L, 99L))).thenReturn(List.of(2L));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.grant(5L, List.of(2L, 99L)));

        assertEquals("Unknown coupon recipient user IDs: 99", error.getMessage());
        verify(couponRepository, never()).incrementClaimedQuantity(5L);
        verify(userCouponMapper, never()).insert(any(UserCoupon.class));
    }

    @Test
    void grantRejectsOversizedRecipientListsBeforeRepositoryLookup() {
        List<Long> ids = LongStream.rangeClosed(1, 201).boxed().collect(Collectors.toList());

        assertThrows(IllegalArgumentException.class, () -> service.grant(5L, ids));

        verifyNoInteractions(couponRepository);
    }

    @Test
    void quoteRejectsInactiveJoinedCouponWhenSelected() {
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setStatus("UNUSED");
        coupon.setCouponStatus("INACTIVE");
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setReductionAmount(new BigDecimal("10.00"));
        when(userCouponMapper.findUnusedByUserIdLimited(eq(3L), eq(100))).thenReturn(Collections.emptyList());
        when(userCouponMapper.findByIdAndUserId(6L, 3L)).thenReturn(coupon);

        CartItem item = new CartItem();
        item.setPrice(new BigDecimal("100.00"));
        item.setQuantity(1);

        assertThrows(IllegalStateException.class, () -> service.quote(3L, List.of(item), 6L));
    }

    private Coupon activePublicCoupon() {
        Coupon coupon = new Coupon();
        coupon.setId(5L);
        coupon.setName("Retention");
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setScope("PUBLIC");
        coupon.setStatus("ACTIVE");
        coupon.setReductionAmount(new BigDecimal("10.00"));
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setClaimedQuantity(0);
        return coupon;
    }

    private RuntimeConfigService runtimeConfig() {
        RuntimeConfigService config = mock(RuntimeConfigService.class);
        when(config.getInt(anyString(), anyInt())).thenAnswer(invocation -> invocation.getArgument(1));
        when(config.getInt("admin.coupons.total-quantity-max", 100_000)).thenReturn(100_000);
        return config;
    }
}
