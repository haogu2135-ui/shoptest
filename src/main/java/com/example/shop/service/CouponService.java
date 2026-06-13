package com.example.shop.service;

import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.dto.CouponPublicResponse;
import com.example.shop.dto.CouponQuoteResponse;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.UserCouponResponse;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.UserCouponMapper;
import com.example.shop.repository.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CouponService {
    private static final String UNUSED = "UNUSED";
    private static final String FULL_REDUCTION = "FULL_REDUCTION";
    private static final String DISCOUNT = "DISCOUNT";
    private static final String PUBLIC = "PUBLIC";
    private static final String ASSIGNED = "ASSIGNED";
    private static final Set<String> COUPON_STATUSES = Set.of("ACTIVE", "INACTIVE");
    private static final int HARD_MAX_COUPON_ROWS = 5_000;
    private static final int HARD_MAX_PUBLIC_COUPON_ROWS = 1_000;
    private static final int HARD_MAX_GRANT_USERS = 1_000;
    private static final int HARD_MAX_TEXT_LENGTH = 4_000;
    private static final int HARD_MAX_TOTAL_QUANTITY = 1_000_000;
    private static final int HARD_MAX_SUMMARY_DAYS = 90;
    private static final int HARD_MAX_LOW_REMAINING = 1_000;
    private static final int INVALID_GRANT_USER_ID_MESSAGE_LIMIT = 20;

    private final CouponRepository couponRepository;
    private final UserCouponMapper userCouponMapper;
    private final UserMapper userMapper;
    private final PetBirthdayCouponService petBirthdayCouponService;
    private final RuntimeConfigService runtimeConfig;

    public List<Coupon> findAll() {
        int limit = resolveLimit("admin.coupons.search-max-rows", 500, HARD_MAX_COUPON_ROWS);
        return couponRepository.findAll(PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "id"))).getContent();
    }

    public Page<Coupon> searchAdminCoupons(String keyword, String status, String scope, int page, int size) {
        int maxSize = resolveLimit("admin.coupons.search-max-rows", 500, HARD_MAX_COUPON_ROWS);
        int safeSize = Math.max(1, Math.min(size <= 0 ? 20 : size, maxSize));
        int safePage = Math.max(0, page);
        String safeKeyword = normalizeOptionalText(keyword, 120);
        String safeStatus = normalizeAdminStatusFilter(status);
        String safeScope = normalizeAdminScopeFilter(scope);
        return couponRepository.searchAdminCoupons(
                safeKeyword,
                parseKeywordId(safeKeyword),
                safeStatus,
                safeScope,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "id")));
    }

    public List<Coupon> findPublicActive() {
        int limit = resolveLimit("coupon.public-list-max-rows", 100, HARD_MAX_PUBLIC_COUPON_ROWS);
        return couponRepository.findClaimableByScopeAndStatus(PUBLIC, "ACTIVE", LocalDateTime.now(), PageRequest.of(0, limit));
    }

    public List<CouponPublicResponse> findPublicActiveResponses() {
        return findPublicActive().stream()
                .map(CouponPublicResponse::from)
                .collect(Collectors.toList());
    }

    public CouponAdminSummaryResponse adminSummary() {
        return adminSummary(null, null, null);
    }

    public CouponAdminSummaryResponse adminSummary(String keyword, String status, String scope) {
        LocalDateTime now = LocalDateTime.now();
        int expiringSoonDays = resolveLimit("admin.coupons.expiring-soon-days", 7, HARD_MAX_SUMMARY_DAYS);
        int lowRemainingThreshold = resolveLimit("admin.coupons.low-remaining-threshold", 10, HARD_MAX_LOW_REMAINING);
        String safeKeyword = normalizeOptionalText(keyword, 120);
        Long keywordId = parseKeywordId(safeKeyword);
        String safeStatus = normalizeAdminStatusFilter(status);
        String safeScope = normalizeAdminScopeFilter(scope);

        CouponAdminSummaryResponse response = new CouponAdminSummaryResponse();
        response.setTotalCoupons(couponRepository.countAdminCoupons(safeKeyword, keywordId, safeStatus, safeScope));
        response.setActiveCoupons(couponRepository.countAdminCoupons(safeKeyword, keywordId, scopedStatus(safeStatus, "ACTIVE"), safeScope));
        response.setInactiveCoupons(couponRepository.countAdminCoupons(safeKeyword, keywordId, scopedStatus(safeStatus, "INACTIVE"), safeScope));
        response.setPublicActiveCoupons(ASSIGNED.equals(safeScope)
                ? 0
                : couponRepository.countAdminCoupons(safeKeyword, keywordId, scopedStatus(safeStatus, "ACTIVE"), PUBLIC));
        response.setExpiringSoonCoupons(couponRepository.countAdminActiveExpiringBetween(
                safeKeyword, keywordId, safeStatus, safeScope, now, now.plusDays(expiringSoonDays)));
        response.setLowRemainingCoupons(couponRepository.countAdminActiveLowRemaining(
                safeKeyword, keywordId, safeStatus, safeScope, lowRemainingThreshold));
        response.setMaxSearchRows(resolveLimit("admin.coupons.search-max-rows", 500, HARD_MAX_COUPON_ROWS));
        response.setMaxGrantUsers(resolveLimit("admin.coupons.grant-max-users", 200, HARD_MAX_GRANT_USERS));
        response.setMaxPublicRows(resolveLimit("coupon.public-list-max-rows", 100, HARD_MAX_PUBLIC_COUPON_ROWS));
        response.setWalletMaxRows(resolveLimit("coupon.wallet-max-rows", 300, HARD_MAX_COUPON_ROWS));
        response.setAvailableMaxRows(resolveLimit("coupon.available-max-rows", 100, HARD_MAX_PUBLIC_COUPON_ROWS));
        response.setNameMaxChars(resolveLimit("admin.coupons.name-max-chars", 120, HARD_MAX_TEXT_LENGTH));
        response.setDescriptionMaxChars(resolveLimit("admin.coupons.description-max-chars", 1000, HARD_MAX_TEXT_LENGTH));
        response.setTotalQuantityMax(resolveLimit("admin.coupons.total-quantity-max", 100_000, HARD_MAX_TOTAL_QUANTITY));
        response.setExpiringSoonDays(expiringSoonDays);
        response.setLowRemainingThreshold(lowRemainingThreshold);
        response.setCheckedAt(now.toString());
        return response;
    }

    public List<UserCoupon> findUserCoupons(Long userId) {
        requirePositiveId(userId, "User");
        int limit = resolveLimit("coupon.wallet-max-rows", 300, HARD_MAX_COUPON_ROWS);
        return userCouponMapper.findByUserIdLimited(userId, limit);
    }

    public List<UserCouponResponse> findUserCouponResponses(Long userId) {
        return findUserCoupons(userId).stream()
                .map(UserCouponResponse::from)
                .collect(Collectors.toList());
    }

    public List<UserCoupon> findAvailableUserCoupons(Long userId) {
        requirePositiveId(userId, "User");
        int limit = resolveLimit("coupon.available-max-rows", 100, HARD_MAX_PUBLIC_COUPON_ROWS);
        return userCouponMapper.findUnusedByUserIdLimited(userId, limit);
    }

    public List<UserCouponResponse> findAvailableUserCouponResponses(Long userId) {
        return findAvailableUserCoupons(userId).stream()
                .map(UserCouponResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public Coupon save(CouponUpsertRequest request, Long id) {
        if (request == null) {
            throw new IllegalArgumentException("Coupon payload is required");
        }
        Coupon coupon = id == null ? new Coupon() : couponRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        coupon.setName(normalizeText(request.getName(), "Coupon name", resolveLimit("admin.coupons.name-max-chars", 120, HARD_MAX_TEXT_LENGTH)));
        String couponType = normalizeType(request.getCouponType());
        coupon.setCouponType(couponType);
        coupon.setScope(normalizeScope(request.getScope()));
        coupon.setStatus(normalizeStatus(request.getStatus()));
        coupon.setThresholdAmount(nonNegativeMoney(request.getThresholdAmount(), "Threshold amount"));
        if (FULL_REDUCTION.equals(couponType)) {
            coupon.setReductionAmount(nonNegativeMoney(request.getReductionAmount(), "Reduction amount"));
            coupon.setDiscountPercent(null);
            coupon.setMaxDiscountAmount(null);
        } else {
            coupon.setReductionAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            coupon.setDiscountPercent(request.getDiscountPercent());
            coupon.setMaxDiscountAmount(nonNegativeNullableMoney(request.getMaxDiscountAmount(), "Max discount amount"));
        }
        coupon.setTotalQuantity(normalizeTotalQuantity(request.getTotalQuantity()));
        coupon.setStartAt(request.getStartAt());
        coupon.setEndAt(request.getEndAt());
        coupon.setDescription(normalizeOptionalText(request.getDescription(), resolveLimit("admin.coupons.description-max-chars", 1000, HARD_MAX_TEXT_LENGTH)));
        validateCoupon(coupon);
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getCreatedAt() == null) {
            coupon.setCreatedAt(now);
        }
        coupon.setUpdatedAt(now);
        if (coupon.getClaimedQuantity() == null) {
            coupon.setClaimedQuantity(0);
        }
        if (coupon.getUsedCount() == null) {
            coupon.setUsedCount(0);
        }
        return couponRepository.save(coupon);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        requirePositiveId(id, "Coupon");
        if (!couponRepository.existsById(id)) {
            throw new IllegalArgumentException("Coupon not found");
        }
        if (userCouponMapper.countUsedByCouponId(id) > 0) {
            throw new IllegalStateException("Cannot delete coupon that has been used in orders");
        }
        petBirthdayCouponService.deleteBirthdayCouponRecords(id);
        couponRepository.deleteById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserCoupon claim(Long couponId, Long userId) {
        requirePositiveId(couponId, "Coupon");
        requirePositiveId(userId, "User");
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
        try {
            userCouponMapper.insert(userCoupon);
        } catch (DuplicateKeyException e) {
            couponRepository.decrementClaimedQuantity(couponId, 1);
            return userCouponMapper.findByCouponIdAndUserId(couponId, userId);
        }
        return userCouponMapper.findById(userCoupon.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public int grant(Long couponId, List<Long> userIds) {
        requirePositiveId(couponId, "Coupon");
        List<Long> normalizedUserIds = normalizeGrantUserIds(userIds);
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        ensureClaimable(coupon);
        validateGrantRecipientsExist(normalizedUserIds);
        int granted = 0;
        for (Long userId : normalizedUserIds) {
            if (userCouponMapper.findByCouponIdAndUserId(couponId, userId) != null) {
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
            try {
                userCouponMapper.insert(userCoupon);
                granted++;
            } catch (DuplicateKeyException e) {
                couponRepository.decrementClaimedQuantity(couponId, 1);
            }
        }
        return granted;
    }

    public CouponQuoteResponse quote(Long userId, List<CartItem> cartItems, Long userCouponId) {
        requirePositiveId(userId, "User");
        List<CartItem> safeItems = cartItems == null ? List.of() : cartItems;
        BigDecimal subtotal = safeItems.stream()
                .map(this::calculateLineAmount)
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
        List<UserCouponResponse> availableResponses = available.stream()
                .map(UserCouponResponse::from)
                .collect(Collectors.toList());
        return new CouponQuoteResponse(subtotal, discount, subtotal.subtract(discount).max(BigDecimal.ZERO), selectedUserCouponId, availableResponses);
    }

    @Transactional(rollbackFor = Exception.class)
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
        if (couponRepository.incrementUsedCount(userCoupon.getCouponId()) == 0) {
            throw new IllegalStateException("Coupon usage counter is unavailable");
        }
        return new AppliedCoupon(userCoupon.getId(), userCoupon.getCouponId(), userCoupon.getCouponName(), discount);
    }

    @Transactional(rollbackFor = Exception.class)
    public void releaseUsedCoupon(Long userCouponId) {
        if (userCouponId != null) {
            UserCoupon userCoupon = userCouponMapper.findById(userCouponId);
            if (userCoupon != null && "USED".equals(userCoupon.getStatus())
                    && userCouponMapper.releaseUsed(userCouponId) > 0) {
                couponRepository.decrementUsedCount(userCoupon.getCouponId());
            }
        }
    }

    private void validateUsable(UserCoupon userCoupon, BigDecimal subtotal) {
        if (userCoupon == null) {
            throw new IllegalArgumentException("Coupon not found");
        }
        if (!UNUSED.equals(userCoupon.getStatus())) {
            throw new IllegalStateException("Coupon is not available");
        }
        if (userCoupon.getCouponStatus() != null && !"ACTIVE".equals(userCoupon.getCouponStatus())) {
            throw new IllegalStateException("Coupon is inactive");
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
            int percent = coupon.getDiscountPercent() == null ? 0 : coupon.getDiscountPercent();
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
        if (coupon.getTotalQuantity() != null
                && (coupon.getTotalQuantity() <= 0 || Math.max(0, coupon.getClaimedQuantity() == null ? 0 : coupon.getClaimedQuantity()) >= coupon.getTotalQuantity())) {
            throw new IllegalStateException("Coupon is out of stock");
        }
    }

    private void validateCoupon(Coupon coupon) {
        if (coupon.getName() == null || coupon.getName().isBlank()) {
            throw new IllegalArgumentException("Coupon name is required");
        }
        if (!COUPON_STATUSES.contains(coupon.getStatus())) {
            throw new IllegalArgumentException("Unsupported coupon status");
        }
        if (FULL_REDUCTION.equals(coupon.getCouponType()) && defaultMoney(coupon.getReductionAmount()).compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Reduction amount is required");
        }
        if (DISCOUNT.equals(coupon.getCouponType())
                && (coupon.getDiscountPercent() == null || coupon.getDiscountPercent() <= 0 || coupon.getDiscountPercent() >= 100)) {
            throw new IllegalArgumentException("Discount percent must be between 1 and 99");
        }
        if (coupon.getTotalQuantity() != null && coupon.getClaimedQuantity() != null
                && coupon.getTotalQuantity() < coupon.getClaimedQuantity()) {
            throw new IllegalArgumentException("Coupon quantity cannot be lower than claimed quantity");
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

    private String normalizeStatus(String value) {
        String normalized = value == null || value.isBlank() ? "ACTIVE" : value.trim().toUpperCase(Locale.ROOT);
        if (!COUPON_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported coupon status");
        }
        return normalized;
    }

    private String normalizeAdminStatusFilter(String value) {
        String normalized = value == null ? null : value.trim().toUpperCase(Locale.ROOT);
        return normalized != null && COUPON_STATUSES.contains(normalized) ? normalized : null;
    }

    private String normalizeAdminScopeFilter(String value) {
        String normalized = value == null ? null : value.trim().toUpperCase(Locale.ROOT);
        if (PUBLIC.equals(normalized) || ASSIGNED.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String scopedStatus(String requestedStatus, String targetStatus) {
        if (requestedStatus == null) {
            return targetStatus;
        }
        return targetStatus.equals(requestedStatus) ? targetStatus : "__NO_MATCH__";
    }

    private String normalizeText(String value, String fieldName, int maxLength) {
        String normalized = normalizeOptionalText(value, maxLength);
        if (normalized == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private Integer normalizeTotalQuantity(Integer value) {
        if (value == null) {
            return null;
        }
        int maxQuantity = resolveLimit("admin.coupons.total-quantity-max", 100_000, HARD_MAX_TOTAL_QUANTITY);
        if (value < 1) {
            throw new IllegalArgumentException("Coupon quantity must be positive");
        }
        if (value > maxQuantity) {
            throw new IllegalArgumentException("Coupon quantity is too large");
        }
        return value;
    }

    private Long parseKeywordId(String keyword) {
        if (keyword == null || !keyword.matches("\\d+")) {
            return null;
        }
        try {
            long value = Long.parseLong(keyword);
            return value > 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private List<Long> normalizeGrantUserIds(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            throw new IllegalArgumentException("User ids are required");
        }
        int maxUsers = resolveLimit("admin.coupons.grant-max-users", 200, HARD_MAX_GRANT_USERS);
        if (userIds.size() > maxUsers) {
            throw new IllegalArgumentException("Too many coupon recipients");
        }
        LinkedHashSet<Long> uniqueIds = userIds.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (uniqueIds.isEmpty()) {
            throw new IllegalArgumentException("User ids are required");
        }
        return List.copyOf(uniqueIds);
    }

    private void validateGrantRecipientsExist(List<Long> userIds) {
        Set<Long> existingIds = new LinkedHashSet<>(userMapper.findExistingIds(userIds));
        List<Long> invalidUserIds = userIds.stream()
                .filter(id -> !existingIds.contains(id))
                .collect(Collectors.toList());
        if (invalidUserIds.isEmpty()) {
            return;
        }
        String invalidSummary = invalidUserIds.stream()
                .limit(INVALID_GRANT_USER_ID_MESSAGE_LIMIT)
                .map(String::valueOf)
                .collect(Collectors.joining(", "));
        if (invalidUserIds.size() > INVALID_GRANT_USER_ID_MESSAGE_LIMIT) {
            invalidSummary += ", ...";
        }
        throw new IllegalArgumentException("Unknown coupon recipient user IDs: " + invalidSummary);
    }

    private void requirePositiveId(Long id, String name) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(name + " is required");
        }
    }

    private BigDecimal calculateLineAmount(CartItem item) {
        if (item == null || item.getPrice() == null || item.getQuantity() == null || item.getQuantity() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return item.getPrice()
                .multiply(BigDecimal.valueOf(item.getQuantity()))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal nonNegativeMoney(BigDecimal value, String fieldName) {
        BigDecimal money = defaultMoney(value);
        if (money.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " cannot be negative");
        }
        return money;
    }

    private BigDecimal nonNegativeNullableMoney(BigDecimal value, String fieldName) {
        if (value == null) {
            return null;
        }
        BigDecimal money = defaultMoney(value);
        if (money.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " cannot be negative");
        }
        return money;
    }

    private int resolveLimit(String key, int defaultValue, int hardMax) {
        return Math.max(1, Math.min(runtimeConfig.getInt(key, defaultValue), hardMax));
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
