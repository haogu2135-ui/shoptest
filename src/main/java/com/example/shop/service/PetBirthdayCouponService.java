package com.example.shop.service;

import com.example.shop.entity.Coupon;
import com.example.shop.entity.PetProfile;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.PetBirthdayCouponGrantMapper;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.UserCouponMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PetBirthdayCouponService {
    private static final String BIRTHDAY_COUPON_NAME_PREFIX = "Pet Birthday Gift ";

    private final PetProfileMapper petProfileMapper;
    private final CouponRepository couponRepository;
    private final UserCouponMapper userCouponMapper;
    private final PetBirthdayCouponGrantMapper grantMapper;

    @Value("${pet.birthday-coupon.max-benefits-per-user:3}")
    private int maxBenefitsPerUser;

    @Scheduled(cron = "${pet.birthday-coupon.cron:0 10 0 * * *}")
    @Transactional
    public void grantTodayBirthdayCoupons() {
        grantBirthdayCoupons(LocalDate.now());
    }

    @Transactional
    public int grantBirthdayCoupons(LocalDate date) {
        List<PetProfile> pets = petProfileMapper.findBirthdayPets(date.getMonthValue(), date.getDayOfMonth());
        int granted = 0;
        for (PetProfile pet : pets) {
            if (pet.getId() == null || pet.getUserId() == null) {
                continue;
            }
            if (maxBenefitsPerUser > 0
                    && grantMapper.countByUserIdAndBirthdayYear(pet.getUserId(), date.getYear()) >= maxBenefitsPerUser) {
                continue;
            }
            Coupon coupon = getOrCreateBirthdayCoupon(date, pet);
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

    private Coupon getOrCreateBirthdayCoupon(LocalDate date, PetProfile pet) {
        String couponName = BIRTHDAY_COUPON_NAME_PREFIX
                + date.format(DateTimeFormatter.ISO_LOCAL_DATE)
                + " - "
                + safePetName(pet)
                + " #"
                + pet.getId();
        return couponRepository.findFirstByNameOrderByIdDesc(couponName)
                .map(coupon -> activateCoupon(coupon, date))
                .orElseGet(() -> createBirthdayCoupon(couponName, date));
    }

    private Coupon createBirthdayCoupon(String couponName, LocalDate date) {
        Coupon coupon = new Coupon();
        coupon.setName(couponName);
        coupon.setCouponType("FULL_REDUCTION");
        coupon.setScope("ASSIGNED");
        coupon.setStatus("ACTIVE");
        coupon.setThresholdAmount(new BigDecimal("30.00"));
        coupon.setReductionAmount(new BigDecimal("8.00"));
        coupon.setClaimedQuantity(0);
        coupon.setStartAt(date.atStartOfDay());
        coupon.setEndAt(date.plusDays(14).atTime(23, 59, 59));
        coupon.setDescription("Exclusive birthday coupon for pet profiles. Auto-granted once per pet birthday each year.");
        coupon.setCreatedAt(LocalDateTime.now());
        coupon.setUpdatedAt(LocalDateTime.now());
        return couponRepository.save(coupon);
    }

    private Coupon activateCoupon(Coupon coupon, LocalDate date) {
        LocalDateTime now = LocalDateTime.now();
        coupon.setStatus("ACTIVE");
        if (coupon.getStartAt() == null || coupon.getStartAt().toLocalDate().isAfter(date)) {
            coupon.setStartAt(date.atStartOfDay());
        }
        if (coupon.getEndAt() == null || coupon.getEndAt().isBefore(now)) {
            coupon.setEndAt(date.plusDays(14).atTime(23, 59, 59));
        }
        coupon.setUpdatedAt(now);
        return couponRepository.save(coupon);
    }

    private String safePetName(PetProfile pet) {
        if (pet.getName() == null || pet.getName().trim().isEmpty()) {
            return "Pet";
        }
        String name = pet.getName().trim();
        return name.length() > 32 ? name.substring(0, 32) : name;
    }
}
