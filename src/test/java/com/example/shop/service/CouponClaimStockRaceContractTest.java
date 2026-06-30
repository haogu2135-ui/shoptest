package com.example.shop.service;

import com.example.shop.entity.Coupon;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.UserCouponMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DuplicateKeyException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CouponClaimStockRaceContractTest {

    private CouponRepository couponRepository;
    private UserCouponMapper userCouponMapper;
    private UserMapper userMapper;
    private CouponService service;

    @BeforeEach
    void setUp() {
        couponRepository = mock(CouponRepository.class);
        userCouponMapper = mock(UserCouponMapper.class);
        userMapper = mock(UserMapper.class);
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt(anyString(), anyInt())).thenAnswer(invocation -> invocation.getArgument(1));
        service = new CouponService(
                couponRepository,
                userCouponMapper,
                userMapper,
                mock(PetBirthdayCouponService.class),
                runtimeConfig
        );
    }

    @Test
    void claimCreatesUserCouponOnlyAfterAtomicStockIncrementSucceeds() {
        UserCoupon inserted = userCoupon(10L, 9L, 5L);
        when(couponRepository.findById(5L)).thenReturn(Optional.of(activePublicCoupon(5L)));
        when(userCouponMapper.findByCouponIdAndUserId(5L, 9L)).thenReturn(null);
        when(couponRepository.incrementClaimedQuantity(5L)).thenReturn(1);
        when(userCouponMapper.insert(any(UserCoupon.class))).thenAnswer(invocation -> {
            UserCoupon userCoupon = invocation.getArgument(0);
            userCoupon.setId(10L);
            return 1;
        });
        when(userCouponMapper.findById(10L)).thenReturn(inserted);

        UserCoupon claimed = service.claim(5L, 9L);

        assertEquals(10L, claimed.getId());
        InOrder inOrder = inOrder(couponRepository, userCouponMapper);
        inOrder.verify(couponRepository).findById(5L);
        inOrder.verify(userCouponMapper).findByCouponIdAndUserId(5L, 9L);
        inOrder.verify(couponRepository).incrementClaimedQuantity(5L);
        inOrder.verify(userCouponMapper).insert(any(UserCoupon.class));
    }

    @Test
    void claimDoesNotInsertUserCouponWhenAtomicStockIncrementFails() {
        when(couponRepository.findById(5L)).thenReturn(Optional.of(activePublicCoupon(5L)));
        when(userCouponMapper.findByCouponIdAndUserId(5L, 9L)).thenReturn(null);
        when(couponRepository.incrementClaimedQuantity(5L)).thenReturn(0);

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.claim(5L, 9L));

        assertEquals("Coupon is out of stock", error.getMessage());
        verify(userCouponMapper, never()).insert(any(UserCoupon.class));
        verify(couponRepository, never()).decrementClaimedQuantity(5L, 1);
    }

    @Test
    void claimRefundsAtomicStockIncrementWhenDuplicateInsertLosesUserRace() {
        UserCoupon existing = userCoupon(11L, 9L, 5L);
        when(couponRepository.findById(5L)).thenReturn(Optional.of(activePublicCoupon(5L)));
        when(userCouponMapper.findByCouponIdAndUserId(5L, 9L)).thenReturn(null, existing);
        when(couponRepository.incrementClaimedQuantity(5L)).thenReturn(1);
        when(userCouponMapper.insert(any(UserCoupon.class))).thenThrow(new DuplicateKeyException("duplicate"));

        UserCoupon claimed = service.claim(5L, 9L);

        assertEquals(11L, claimed.getId());
        verify(couponRepository).decrementClaimedQuantity(5L, 1);
    }

    @Test
    void grantStopsIssuingWhenAtomicStockIncrementReportsSoldOut() {
        when(couponRepository.findById(5L)).thenReturn(Optional.of(activePublicCoupon(5L)));
        when(userMapper.findExistingIds(List.of(2L, 3L))).thenReturn(List.of(2L, 3L));
        when(userCouponMapper.findByCouponIdAndUserId(5L, 2L)).thenReturn(null);
        when(userCouponMapper.findByCouponIdAndUserId(5L, 3L)).thenReturn(null);
        when(couponRepository.incrementClaimedQuantity(5L)).thenReturn(1, 0);
        when(userCouponMapper.insert(any(UserCoupon.class))).thenReturn(1);

        int granted = service.grant(5L, List.of(2L, 3L));

        assertEquals(1, granted);
        verify(couponRepository, org.mockito.Mockito.times(2)).incrementClaimedQuantity(5L);
        verify(userCouponMapper, org.mockito.Mockito.times(1)).insert(any(UserCoupon.class));
    }

    @Test
    void sourceDoesNotUseLegacyReadThenDecrementStockHelpers() throws Exception {
        String serviceSource = read("src/main/java/com/example/shop/service/CouponService.java");
        String repositorySource = read("src/main/java/com/example/shop/repository/CouponRepository.java");
        String claim = methodBlock(serviceSource, "public UserCoupon claim(Long couponId, Long userId)");
        String grant = methodBlock(serviceSource, "public int grant(Long couponId, List<Long> userIds)");
        String grantBatch = methodBlock(serviceSource, "private GrantBatchResult grantBatch(Long couponId, List<Long> userIds)");

        assertFalse(serviceSource.contains("getCouponStock"));
        assertFalse(serviceSource.contains("decrementCouponStock"));
        assertFalse(claim.contains("setClaimedQuantity("));
        assertFalse(grant.contains("setClaimedQuantity("));
        assertFalse(grantBatch.contains("setClaimedQuantity("));
        assertTrue(claim.contains("couponRepository.incrementClaimedQuantity(couponId) == 0"));
        assertTrue(grant.contains("executeGrantBatchInTransaction(couponId, batch)"));
        assertTrue(grantBatch.contains("couponRepository.incrementClaimedQuantity(couponId) == 0"));
        assertTrue(serviceSource.contains("transactionTemplate.execute(status -> grantBatch(couponId, userIds))"));
        assertTrue(repositorySource.contains("update Coupon c set c.claimedQuantity = coalesce(c.claimedQuantity, 0) + 1"));
        assertTrue(repositorySource.contains("and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity)"));
    }

    private static Coupon activePublicCoupon(Long id) {
        Coupon coupon = new Coupon();
        coupon.setId(id);
        coupon.setName("Retention");
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setScope("PUBLIC");
        coupon.setStatus("ACTIVE");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setReductionAmount(new BigDecimal("10.00"));
        coupon.setClaimedQuantity(0);
        return coupon;
    }

    private static UserCoupon userCoupon(Long id, Long userId, Long couponId) {
        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setId(id);
        userCoupon.setUserId(userId);
        userCoupon.setCouponId(couponId);
        userCoupon.setStatus("UNUSED");
        return userCoupon;
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
