package com.example.shop.service;

import com.example.shop.entity.UserAddress;
import com.example.shop.repository.UserAddressMapper;
import com.example.shop.repository.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserAddressService {
    private static final int MAX_ADDRESSES_PER_USER = 100;
    private static final Pattern CONTROL_TEXT_PATTERN = Pattern.compile("[\\p{Cntrl}&&[^\\r\\n\\t]]");
    private static final Pattern WHITESPACE_TEXT_PATTERN = Pattern.compile("\\s+");

    private final UserAddressMapper userAddressMapper;
    private final UserMapper userMapper;
    private final RuntimeConfigService runtimeConfig;

    public List<UserAddress> getAddresses(Long userId) {
        return userAddressMapper.findByUserId(userId, normalizedMaxAddressesPerUser());
    }

    public UserAddress getAddress(Long id) {
        return userAddressMapper.findById(id);
    }

    public UserAddress getDefaultAddress(Long userId) {
        return userAddressMapper.findDefaultByUserId(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserAddress addAddress(UserAddress address) {
        normalizeAddress(address);
        lockAddressOwner(address.getUserId());
        int existingCount = Math.max(0, userAddressMapper.countByUserId(address.getUserId()));
        int maxAddresses = normalizedMaxAddressesPerUser();
        if (existingCount >= maxAddresses) {
            throw new IllegalStateException("Address limit reached");
        }
        boolean shouldBeDefault = existingCount == 0 || Boolean.TRUE.equals(address.getIsDefault());
        if (shouldBeDefault && existingCount > 0) {
            userAddressMapper.clearDefault(address.getUserId());
        }
        address.setIsDefault(shouldBeDefault);
        LocalDateTime now = LocalDateTime.now();
        address.setCreatedAt(now);
        address.setUpdatedAt(now);
        userAddressMapper.insert(address);
        return address;
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateAddress(UserAddress address) {
        if (address == null || address.getId() == null) {
            throw new IllegalArgumentException("Address not found");
        }
        normalizeAddress(address);
        UserAddress existing = userAddressMapper.findById(address.getId());
        if (existing == null) {
            throw new IllegalArgumentException("Address not found");
        }
        address.setUserId(existing.getUserId());
        lockAddressOwner(existing.getUserId());
        address.setUpdatedAt(LocalDateTime.now());
        if (Boolean.TRUE.equals(address.getIsDefault())) {
            userAddressMapper.clearDefault(existing.getUserId());
        }
        if (userAddressMapper.update(address) == 0) {
            throw new IllegalStateException("Address update failed");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAddress(Long id) {
        UserAddress addr = userAddressMapper.findById(id);
        if (addr == null) return;
        lockAddressOwner(addr.getUserId());
        if (userAddressMapper.deleteByIdAndUserId(id, addr.getUserId()) == 0) {
            return;
        }
        if (Boolean.TRUE.equals(addr.getIsDefault())) {
            List<UserAddress> remaining = userAddressMapper.findByUserId(
                    addr.getUserId(), normalizedMaxAddressesPerUser());
            if (!remaining.isEmpty()) {
                userAddressMapper.setDefault(remaining.get(0).getId(), addr.getUserId());
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void setDefault(Long id) {
        UserAddress address = userAddressMapper.findById(id);
        if (address == null) {
            throw new IllegalArgumentException("Address not found");
        }
        Long userId = address.getUserId();
        lockAddressOwner(userId);
        userAddressMapper.clearDefault(userId);
        int updated = userAddressMapper.setDefault(id, userId);
        if (updated == 0) {
            throw new IllegalArgumentException("Address not found");
        }
    }

    private void normalizeAddress(UserAddress address) {
        if (address == null) {
            throw new IllegalArgumentException("Address is required");
        }
        Long userId = address.getUserId();
        if (userId == null) {
            throw new IllegalArgumentException("User is required");
        }
        if (userId <= 0) {
            throw new IllegalArgumentException("User is required");
        }
        address.setRecipientName(normalizeRequiredText(address.getRecipientName(), "Recipient name",
                runtimeConfig.getInt("user-address.recipient-name-max-chars", 80)));
        address.setPhone(normalizeRequiredText(address.getPhone(), "Phone number",
                runtimeConfig.getInt("user-address.phone-max-chars", 30)));
        String region = normalizeRequiredText(address.getRegion(), "Region",
                runtimeConfig.getInt("user-address.region-max-chars", 1000));
        String postalCode = normalizeRequiredText(address.getPostalCode(), "Postal code",
                runtimeConfig.getInt("user-address.postal-code-max-chars", 20)).toUpperCase(Locale.ROOT);
        String detailAddress = normalizeRequiredText(address.getDetailAddress(), "Detailed address",
                runtimeConfig.getInt("user-address.detail-address-max-chars", 260));
        address.setRegion(region);
        address.setPostalCode(postalCode);
        address.setDetailAddress(detailAddress);
        String combinedAddress = address.getAddress();
        if (combinedAddress == null) {
            combinedAddress = (region.replace('|', ' ') + " " + postalCode + " " + detailAddress).trim();
        } else {
            String trimmedAddress = combinedAddress.trim();
            if (trimmedAddress.isEmpty()) {
                combinedAddress = (region.replace('|', ' ') + " " + postalCode + " " + detailAddress).trim();
            }
        }
        address.setAddress(normalizeRequiredText(combinedAddress, "Address",
                runtimeConfig.getInt("user-address.address-max-chars", 500)));
    }

    private String normalizeRequiredText(String value, String field, int maxLength) {
        String normalized = value == null ? "" : WHITESPACE_TEXT_PATTERN
                .matcher(CONTROL_TEXT_PATTERN.matcher(value).replaceAll(" "))
                .replaceAll(" ")
                .trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        int safeMaxLength = Math.max(1, maxLength);
        if (normalized.length() > safeMaxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private void lockAddressOwner(Long userId) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("User not found");
        }
        if (userMapper.findByIdForUpdate(userId) == null) {
            throw new IllegalArgumentException("User not found");
        }
    }

    private int normalizedMaxAddressesPerUser() {
        return Math.max(1, Math.min(runtimeConfig.getInt("user-address.max-per-user", 20), MAX_ADDRESSES_PER_USER));
    }
}
