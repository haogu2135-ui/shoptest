package com.example.shop.service;

import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.PetBirthdayCouponConfig;
import com.example.shop.entity.PetProfile;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.PetBirthdayCouponConfigRepository;
import com.example.shop.repository.PetBirthdayCouponGrantMapper;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.UserCouponMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PetBirthdayCouponService {
    private static final long DEFAULT_CONFIG_ID = 1L;
    private static final String FULL_REDUCTION = "FULL_REDUCTION";
    private static final String DISCOUNT = "DISCOUNT";

    private final PetProfileMapper petProfileMapper;
    private final CouponRepository couponRepository;
    private final PetBirthdayCouponConfigRepository configRepository;
    private final UserCouponMapper userCouponMapper;
    private final PetBirthdayCouponGrantMapper grantMapper;

    @Scheduled(cron = "${pet.birthday-coupon.cron:0 10 0 * * *}")
    @Transactional
    public void grantTodayBirthdayCoupons() {
        grantBirthdayCoupons(LocalDate.now());
    }

    public PetBirthdayCouponConfig getConfig() {
        return configRepository.findById(DEFAULT_CONFIG_ID).orElseGet(this::createDefaultConfig);
    }

    @Transactional
    public PetBirthdayCouponConfig updateConfig(PetBirthdayCouponConfigRequest request) {
        PetBirthdayCouponConfig config = getConfig();
        if (request.getEnabled() != null) {
            config.setEnabled(request.getEnabled());
        }
        config.setNamePrefix(trimOrDefault(request.getNamePrefix(), "Pet Birthday Gift"));
        config.setCouponType(normalizeType(request.getCouponType()));
        config.setThresholdAmount(defaultMoney(request.getThresholdAmount()));
        if (DISCOUNT.equals(config.getCouponType())) {
            config.setDiscountPercent(request.getDiscountPercent());
            config.setMaxDiscountAmount(defaultNullableMoney(request.getMaxDiscountAmount()));
            config.setReductionAmount(BigDecimal.ZERO);
        } else {
            config.setReductionAmount(defaultMoney(request.getReductionAmount()));
            config.setDiscountPercent(null);
            config.setMaxDiscountAmount(null);
        }
        config.setValidDays(request.getValidDays() == null ? 14 : request.getValidDays());
        config.setMaxBenefitsPerUser(request.getMaxBenefitsPerUser() == null ? 3 : request.getMaxBenefitsPerUser());
        config.setTotalQuantityPerCoupon(request.getTotalQuantityPerCoupon());
        config.setDescription(trimOrDefault(request.getDescription(),
                "Exclusive birthday coupon for pet profiles. Auto-granted once per pet birthday each year."));
        validateConfig(config);
        LocalDateTime now = LocalDateTime.now();
        if (config.getCreatedAt() == null) {
            config.setCreatedAt(now);
        }
        config.setUpdatedAt(now);
        return configRepository.save(config);
    }

    @Transactional
    public int grantBirthdayCoupons(LocalDate date) {
        PetBirthdayCouponConfig config = getConfig();
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            return 0;
        }
        validateConfig(config);
        List<PetProfile> pets = petProfileMapper.findBirthdayPets(date.getMonthValue(), date.getDayOfMonth());
        int granted = 0;
        for (PetProfile pet : pets) {
            if (pet.getId() == null || pet.getUserId() == null) {
                continue;
            }
            if (config.getMaxBenefitsPerUser() != null
                    && config.getMaxBenefitsPerUser() > 0
                    && grantMapper.countByUserIdAndBirthdayYear(pet.getUserId(), date.getYear()) >= config.getMaxBenefitsPerUser()) {
                continue;
            }
            Coupon coupon = getOrCreateBirthdayCoupon(date, pet, config);
            int reserved = grantMapper.insertIgnore(pet.getId(), pet.getUserId(), coupon.getId(), date.getYear());
            if (reserved == 0) {
                continue;
            }
            UserCoupon userCoupon = new UserCoupon();
            userCoupon.setUserId(pet.getUserId());
            userCoupon.setCouponId(coupon.getId());
            userCoupon.setStatus("UNUSED");
            userCoupon.setClaimedAt(LocalDateTime.now());
            userCouponMapper.insert(userCoupon);
            couponRepository.incrementClaimedQuantity(coupon.getId());
            granted++;
        }
        return granted;
    }

    @Transactional
    public int reissueBirthdayCoupons(Long userId, LocalDate date) {
        if (userId == null) {
            throw new IllegalArgumentException("User is required");
        }
        PetBirthdayCouponConfig config = getConfig();
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("Pet birthday coupon automation is disabled");
        }
        validateConfig(config);
        List<PetProfile> pets = petProfileMapper.findBirthdayPetsByUserId(userId, date.getMonthValue(), date.getDayOfMonth());
        int granted = 0;
        for (PetProfile pet : pets) {
            granted += reissueBirthdayCouponForPet(date, pet, config);
        }
        return granted;
    }

    @Transactional
    public void deleteBirthdayCouponRecords(Long couponId) {
        int deleted = userCouponMapper.deleteUnusedByCouponId(couponId);
        if (deleted > 0) {
            couponRepository.decrementClaimedQuantity(couponId, deleted);
        }
        grantMapper.deleteByCouponId(couponId);
    }

    private int reissueBirthdayCouponForPet(LocalDate date, PetProfile pet, PetBirthdayCouponConfig config) {
        if (pet.getId() == null || pet.getUserId() == null) {
            return 0;
        }
        Coupon coupon = getOrCreateBirthdayCoupon(date, pet, config);
        if (userCouponMapper.countUsedByCouponId(coupon.getId()) > 0) {
            return 0;
        }
        int deleted = userCouponMapper.deleteUnusedByCouponIdAndUserId(coupon.getId(), pet.getUserId());
        if (deleted > 0) {
            couponRepository.decrementClaimedQuantity(coupon.getId(), deleted);
        }
        grantMapper.deleteByPetIdAndBirthdayYear(pet.getId(), date.getYear());
        int reserved = grantMapper.insertIgnore(pet.getId(), pet.getUserId(), coupon.getId(), date.getYear());
        if (reserved == 0) {
            return 0;
        }
        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(pet.getUserId());
        userCoupon.setCouponId(coupon.getId());
        userCoupon.setStatus("UNUSED");
        userCoupon.setClaimedAt(LocalDateTime.now());
        userCouponMapper.insert(userCoupon);
        couponRepository.incrementClaimedQuantity(coupon.getId());
        return 1;
    }

    private Coupon getOrCreateBirthdayCoupon(LocalDate date, PetProfile pet, PetBirthdayCouponConfig config) {
        String couponName = config.getNamePrefix().trim()
                + " "
                + date.format(DateTimeFormatter.ISO_LOCAL_DATE)
                + " - "
                + safePetName(pet)
                + " #"
                + pet.getId();
        return couponRepository.findFirstByNameOrderByIdDesc(couponName)
                .map(coupon -> activateCoupon(coupon, date, config))
                .orElseGet(() -> createBirthdayCoupon(couponName, date, config));
    }

    private Coupon createBirthdayCoupon(String couponName, LocalDate date, PetBirthdayCouponConfig config) {
        Coupon coupon = new Coupon();
        coupon.setName(couponName);
        coupon.setCouponType(config.getCouponType());
        coupon.setScope("ASSIGNED");
        coupon.setStatus("ACTIVE");
        coupon.setThresholdAmount(defaultMoney(config.getThresholdAmount()));
        coupon.setReductionAmount(FULL_REDUCTION.equals(config.getCouponType()) ? defaultMoney(config.getReductionAmount()) : BigDecimal.ZERO);
        coupon.setDiscountPercent(DISCOUNT.equals(config.getCouponType()) ? config.getDiscountPercent() : null);
        coupon.setMaxDiscountAmount(DISCOUNT.equals(config.getCouponType()) ? defaultNullableMoney(config.getMaxDiscountAmount()) : null);
        coupon.setTotalQuantity(config.getTotalQuantityPerCoupon());
        coupon.setClaimedQuantity(0);
        coupon.setStartAt(date.atStartOfDay());
        coupon.setEndAt(date.plusDays(config.getValidDays()).atTime(23, 59, 59));
        coupon.setDescription(config.getDescription());
        coupon.setCreatedAt(LocalDateTime.now());
        coupon.setUpdatedAt(LocalDateTime.now());
        return couponRepository.save(coupon);
    }

    private Coupon activateCoupon(Coupon coupon, LocalDate date, PetBirthdayCouponConfig config) {
        LocalDateTime now = LocalDateTime.now();
        coupon.setStatus("ACTIVE");
        coupon.setCouponType(config.getCouponType());
        coupon.setThresholdAmount(defaultMoney(config.getThresholdAmount()));
        coupon.setReductionAmount(FULL_REDUCTION.equals(config.getCouponType()) ? defaultMoney(config.getReductionAmount()) : BigDecimal.ZERO);
        coupon.setDiscountPercent(DISCOUNT.equals(config.getCouponType()) ? config.getDiscountPercent() : null);
        coupon.setMaxDiscountAmount(DISCOUNT.equals(config.getCouponType()) ? defaultNullableMoney(config.getMaxDiscountAmount()) : null);
        coupon.setTotalQuantity(config.getTotalQuantityPerCoupon());
        coupon.setDescription(config.getDescription());
        if (coupon.getStartAt() == null || coupon.getStartAt().toLocalDate().isAfter(date)) {
            coupon.setStartAt(date.atStartOfDay());
        }
        if (coupon.getEndAt() == null || coupon.getEndAt().isBefore(now)) {
            coupon.setEndAt(date.plusDays(config.getValidDays()).atTime(23, 59, 59));
        }
        coupon.setUpdatedAt(now);
        return couponRepository.save(coupon);
    }

    private PetBirthdayCouponConfig createDefaultConfig() {
        PetBirthdayCouponConfig config = new PetBirthdayCouponConfig();
        LocalDateTime now = LocalDateTime.now();
        config.setId(DEFAULT_CONFIG_ID);
        config.setCreatedAt(now);
        config.setUpdatedAt(now);
        return configRepository.save(config);
    }

    private void validateConfig(PetBirthdayCouponConfig config) {
        if (!FULL_REDUCTION.equals(config.getCouponType()) && !DISCOUNT.equals(config.getCouponType())) {
            throw new IllegalArgumentException("Unsupported birthday coupon type");
        }
        if (config.getValidDays() == null || config.getValidDays() < 1 || config.getValidDays() > 365) {
            throw new IllegalArgumentException("Valid days must be between 1 and 365");
        }
        if (config.getMaxBenefitsPerUser() == null || config.getMaxBenefitsPerUser() < 0) {
            throw new IllegalArgumentException("Max benefits per user cannot be negative");
        }
        if (config.getTotalQuantityPerCoupon() != null && config.getTotalQuantityPerCoupon() < 1) {
            throw new IllegalArgumentException("Coupon quantity must be positive");
        }
        if (FULL_REDUCTION.equals(config.getCouponType()) && defaultMoney(config.getReductionAmount()).compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Reduction amount is required");
        }
        if (DISCOUNT.equals(config.getCouponType())
                && (config.getDiscountPercent() == null || config.getDiscountPercent() <= 0 || config.getDiscountPercent() >= 100)) {
            throw new IllegalArgumentException("Discount percent must be between 1 and 99");
        }
    }

    private String normalizeType(String value) {
        String normalized = value == null || value.isBlank() ? FULL_REDUCTION : value.trim().toUpperCase(Locale.ROOT);
        if (!FULL_REDUCTION.equals(normalized) && !DISCOUNT.equals(normalized)) {
            throw new IllegalArgumentException("Unsupported birthday coupon type");
        }
        return normalized;
    }

    private BigDecimal defaultMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal defaultNullableMoney(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    private String trimOrDefault(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String safePetName(PetProfile pet) {
        if (pet.getName() == null || pet.getName().trim().isEmpty()) {
            return "Pet";
        }
        String name = pet.getName().trim();
        return name.length() > 32 ? name.substring(0, 32) : name;
    }
}
