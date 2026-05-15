package com.example.shop.service;

import com.example.shop.dto.CouponQuoteResponse;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.UserCouponMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CouponService {
    private static final String UNUSED = "UNUSED";
    private static final String FULL_REDUCTION = "FULL_REDUCTION";
    private static final String DISCOUNT = "DISCOUNT";
    private static final String PUBLIC = "PUBLIC";
    private static final String ASSIGNED = "ASSIGNED";

    private final CouponRepository couponRepository;
    private final UserCouponMapper userCouponMapper;
    private final PetBirthdayCouponService petBirthdayCouponService;

    public List<Coupon> findAll() {
        return couponRepository.findAll().stream()
                .sorted((left, right) -> Long.compare(right.getId() == null ? 0 : right.getId(), left.getId() == null ? 0 : left.getId()))
                .collect(Collectors.toList());
    }

    public List<Coupon> findPublicActive() {
        return couponRepository.findByScopeAndStatusOrderByIdDesc(PUBLIC, "ACTIVE").stream()
                .filter(this::isClaimableNow)
                .collect(Collectors.toList());
    }

    public List<UserCoupon> findUserCoupons(Long userId) {
        return userCouponMapper.findByUserId(userId);
    }

    public List<UserCoupon> findAvailableUserCoupons(Long userId) {
        return userCouponMapper.findUnusedByUserId(userId);
    }

    @Transactional
    public Coupon save(CouponUpsertRequest request, Long id) {
        Coupon coupon = id == null ? new Coupon() : couponRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        coupon.setName(request.getName());
        coupon.setCouponType(normalizeType(request.getCouponType()));
        coupon.setScope(normalizeScope(request.getScope()));
        coupon.setStatus(request.getStatus() == null || request.getStatus().isBlank()
                ? "ACTIVE"
                : request.getStatus().trim().toUpperCase(Locale.ROOT));
        coupon.setThresholdAmount(defaultMoney(request.getThresholdAmount()));
        coupon.setReductionAmount(defaultMoney(request.getReductionAmount()));
        coupon.setDiscountPercent(request.getDiscountPercent());
        coupon.setMaxDiscountAmount(request.getMaxDiscountAmount());
        coupon.setTotalQuantity(request.getTotalQuantity());
        coupon.setStartAt(request.getStartAt());
        coupon.setEndAt(request.getEndAt());
        coupon.setDescription(request.getDescription());
        validateCoupon(coupon);
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getCreatedAt() == null) {
            coupon.setCreatedAt(now);
        }
        coupon.setUpdatedAt(now);
        if (coupon.getClaimedQuantity() == null) {
            coupon.setClaimedQuantity(0);
        }
        return couponRepository.save(coupon);
    }

    @Transactional
    public void delete(Long id) {
        if (!couponRepository.existsById(id)) {
            throw new IllegalArgumentException("Coupon not found");
        }
        if (userCouponMapper.countUsedByCouponId(id) > 0) {
            throw new IllegalStateException("Cannot delete coupon that has been used in orders");
        }
        petBirthdayCouponService.deleteBirthdayCouponRecords(id);
        couponRepository.deleteById(id);
    }

    @Transactional
    public UserCoupon claim(Long couponId, Long userId) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        if (!PUBLIC.equals(coupon.getScope())) {
            throw new IllegalStateException("Coupon is not available for public claim");
        }
        ensureClaimable(coupon);
        UserCoupon existing = userCouponMapper.findByCouponIdAndUserId(couponId, userId);
        if (existing != null) {
            return existing;
        }
        if (couponRepository.incrementClaimedQuantity(couponId) == 0) {
            throw new IllegalStateException("Coupon is out of stock");
        }
        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(userId);
        userCoupon.setCouponId(couponId);
        userCoupon.setStatus(UNUSED);
        userCoupon.setClaimedAt(LocalDateTime.now());
        userCouponMapper.insert(userCoupon);
        return userCouponMapper.findById(userCoupon.getId());
    }

    @Transactional
    public int grant(Long couponId, List<Long> userIds) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        ensureClaimable(coupon);
        int granted = 0;
        for (Long userId : userIds) {
            if (userId == null || userCouponMapper.findByCouponIdAndUserId(couponId, userId) != null) {
                continue;
            }
            if (couponRepository.incrementClaimedQuantity(couponId) == 0) {
                break;
            }
            UserCoupon userCoupon = new UserCoupon();
            userCoupon.setUserId(userId);
            userCoupon.setCouponId(couponId);
            userCoupon.setStatus(UNUSED);
            userCoupon.setClaimedAt(LocalDateTime.now());
            userCouponMapper.insert(userCoupon);
            granted++;
        }
        return granted;
    }

    public CouponQuoteResponse quote(Long userId, List<CartItem> cartItems, Long userCouponId) {
        BigDecimal subtotal = cartItems.stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        List<UserCoupon> available = findAvailableUserCoupons(userId).stream()
                .sorted(Comparator
                        .comparing((UserCoupon userCoupon) -> calculateDiscount(userCoupon, subtotal)).reversed()
                        .thenComparing(UserCoupon::getEndAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(UserCoupon::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
        BigDecimal discount = BigDecimal.ZERO;
        Long selectedUserCouponId = userCouponId;
        if (userCouponId != null) {
            UserCoupon selected = userCouponMapper.findByIdAndUserId(userCouponId, userId);
            validateUsable(selected, subtotal);
            discount = calculateDiscount(selected, subtotal);
        } else if (!available.isEmpty()) {
            UserCoupon bestCoupon = available.stream()
                    .filter(userCoupon -> calculateDiscount(userCoupon, subtotal).compareTo(BigDecimal.ZERO) > 0)
                    .findFirst()
                    .orElse(null);
            if (bestCoupon != null) {
                selectedUserCouponId = bestCoupon.getId();
                discount = calculateDiscount(bestCoupon, subtotal);
            }
        }
        return new CouponQuoteResponse(subtotal, discount, subtotal.subtract(discount).max(BigDecimal.ZERO), selectedUserCouponId, available);
    }

    @Transactional
    public AppliedCoupon useCoupon(Long userId, Long userCouponId, BigDecimal subtotal, Long orderId) {
        if (userCouponId == null) {
            return new AppliedCoupon(null, null, null, BigDecimal.ZERO);
        }
        UserCoupon userCoupon = userCouponMapper.findByIdAndUserId(userCouponId, userId);
        validateUsable(userCoupon, subtotal);
        BigDecimal discount = calculateDiscount(userCoupon, subtotal);
        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Coupon cannot be used for this order");
        }
        if (userCouponMapper.markUsed(userCouponId, orderId) == 0) {
            throw new IllegalStateException("Coupon has already been used");
        }
        return new AppliedCoupon(userCoupon.getId(), userCoupon.getCouponId(), userCoupon.getCouponName(), discount);
    }

    @Transactional
    public void releaseUsedCoupon(Long userCouponId) {
        if (userCouponId != null) {
            userCouponMapper.releaseUsed(userCouponId);
        }
    }

    private void validateUsable(UserCoupon userCoupon, BigDecimal subtotal) {
        if (userCoupon == null) {
            throw new IllegalArgumentException("Coupon not found");
        }
        if (!UNUSED.equals(userCoupon.getStatus())) {
            throw new IllegalStateException("Coupon is not available");
        }
        LocalDateTime now = LocalDateTime.now();
        if (userCoupon.getStartAt() != null && now.isBefore(userCoupon.getStartAt())) {
            throw new IllegalStateException("Coupon is not active yet");
        }
        if (userCoupon.getEndAt() != null && now.isAfter(userCoupon.getEndAt())) {
            throw new IllegalStateException("Coupon has expired");
        }
        if (subtotal.compareTo(defaultMoney(userCoupon.getThresholdAmount())) < 0) {
            throw new IllegalStateException("Order amount does not meet coupon threshold");
        }
    }

    private BigDecimal calculateDiscount(UserCoupon coupon, BigDecimal subtotal) {
        if (coupon == null || subtotal == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (subtotal.compareTo(defaultMoney(coupon.getThresholdAmount())) < 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal discount;
        if (FULL_REDUCTION.equals(coupon.getCouponType())) {
            discount = defaultMoney(coupon.getReductionAmount());
        } else if (DISCOUNT.equals(coupon.getCouponType())) {
            int percent = coupon.getDiscountPercent() == null ? 100 : coupon.getDiscountPercent();
            discount = subtotal.multiply(BigDecimal.valueOf(100L - percent))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscountAmount() != null && coupon.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                discount = discount.min(coupon.getMaxDiscountAmount());
            }
        } else {
            discount = BigDecimal.ZERO;
        }
        return discount.max(BigDecimal.ZERO).min(subtotal).setScale(2, RoundingMode.HALF_UP);
    }

    private void ensureClaimable(Coupon coupon) {
        if (!"ACTIVE".equals(coupon.getStatus())) {
            throw new IllegalStateException("Coupon is inactive");
        }
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getStartAt() != null && now.isBefore(coupon.getStartAt())) {
            throw new IllegalStateException("Coupon is not active yet");
        }
        if (coupon.getEndAt() != null && now.isAfter(coupon.getEndAt())) {
            throw new IllegalStateException("Coupon has expired");
        }
        if (coupon.getTotalQuantity() != null && coupon.getClaimedQuantity() != null
                && coupon.getClaimedQuantity() >= coupon.getTotalQuantity()) {
            throw new IllegalStateException("Coupon is out of stock");
        }
    }

    private boolean isClaimableNow(Coupon coupon) {
        try {
            ensureClaimable(coupon);
            return true;
        } catch (IllegalStateException e) {
            return false;
        }
    }

    private void validateCoupon(Coupon coupon) {
        if (FULL_REDUCTION.equals(coupon.getCouponType()) && defaultMoney(coupon.getReductionAmount()).compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Reduction amount is required");
        }
        if (DISCOUNT.equals(coupon.getCouponType())
                && (coupon.getDiscountPercent() == null || coupon.getDiscountPercent() <= 0 || coupon.getDiscountPercent() >= 100)) {
            throw new IllegalArgumentException("Discount percent must be between 1 and 99");
        }
        if (coupon.getEndAt() != null && coupon.getStartAt() != null && coupon.getEndAt().isBefore(coupon.getStartAt())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
    }

    private String normalizeType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!FULL_REDUCTION.equals(normalized) && !DISCOUNT.equals(normalized)) {
            throw new IllegalArgumentException("Unsupported coupon type");
        }
        return normalized;
    }

    private String normalizeScope(String value) {
        String normalized = value == null || value.isBlank() ? PUBLIC : value.trim().toUpperCase(Locale.ROOT);
        return ASSIGNED.equals(normalized) ? ASSIGNED : PUBLIC;
    }

    private BigDecimal defaultMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    @lombok.Value
    public static class AppliedCoupon {
        Long userCouponId;
        Long couponId;
        String couponName;
        BigDecimal discountAmount;
    }
}
