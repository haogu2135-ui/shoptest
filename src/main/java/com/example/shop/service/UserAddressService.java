package com.example.shop.service;

import com.example.shop.entity.UserAddress;
import com.example.shop.repository.UserAddressMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserAddressService {
    private final UserAddressMapper userAddressMapper;
    private final RuntimeConfigService runtimeConfig;

    public List<UserAddress> getAddresses(Long userId) {
        return userAddressMapper.findByUserId(userId);
    }

    public UserAddress getAddress(Long id) {
        return userAddressMapper.findById(id);
    }

    public UserAddress getDefaultAddress(Long userId) {
        return userAddressMapper.findDefaultByUserId(userId);
    }

    @Transactional
    public void addAddress(UserAddress address) {
        normalizeAddress(address);
        List<UserAddress> existing = userAddressMapper.findByUserId(address.getUserId());
        int maxAddresses = normalizedMaxAddressesPerUser();
        if (existing.size() >= maxAddresses) {
            throw new IllegalStateException("Address limit reached");
        }
        boolean shouldBeDefault = existing.isEmpty() || Boolean.TRUE.equals(address.getIsDefault());
        if (shouldBeDefault && !existing.isEmpty()) {
            userAddressMapper.clearDefault(address.getUserId());
        }
        address.setIsDefault(shouldBeDefault);
        address.setCreatedAt(LocalDateTime.now());
        address.setUpdatedAt(LocalDateTime.now());
        userAddressMapper.insert(address);
    }

    @Transactional
    public void updateAddress(UserAddress address) {
        normalizeAddress(address);
        address.setUpdatedAt(LocalDateTime.now());
        if (userAddressMapper.update(address) == 0) {
            throw new IllegalStateException("Address update failed");
        }
    }

    @Transactional
    public void deleteAddress(Long id) {
        UserAddress addr = userAddressMapper.findById(id);
        if (addr == null) return;
        if (userAddressMapper.deleteByIdAndUserId(id, addr.getUserId()) == 0) {
            throw new IllegalStateException("Address delete failed");
        }
        if (Boolean.TRUE.equals(addr.getIsDefault())) {
            List<UserAddress> remaining = userAddressMapper.findByUserId(addr.getUserId());
            if (!remaining.isEmpty()) {
                userAddressMapper.setDefault(remaining.get(0).getId(), addr.getUserId());
            }
        }
    }

    @Transactional
    public void setDefault(Long id) {
        UserAddress address = userAddressMapper.findById(id);
        if (address == null) {
            throw new IllegalArgumentException("Address not found");
        }
        Long userId = address.getUserId();
        userAddressMapper.clearDefault(userId);
        int updated = userAddressMapper.setDefault(id, userId);
        if (updated == 0) {
            throw new IllegalStateException("Default address update failed");
        }
    }

    private void normalizeAddress(UserAddress address) {
        if (address == null) {
            throw new IllegalArgumentException("Address is required");
        }
        if (address.getUserId() == null) {
            throw new IllegalArgumentException("User is required");
        }
        address.setRecipientName(normalizeRequiredText(address.getRecipientName(), "Recipient name",
                runtimeConfig.getInt("user-address.recipient-name-max-chars", 80)));
        address.setPhone(normalizeRequiredText(address.getPhone(), "Phone number",
                runtimeConfig.getInt("user-address.phone-max-chars", 30)));
        address.setAddress(normalizeRequiredText(address.getAddress(), "Address",
                runtimeConfig.getInt("user-address.address-max-chars", 500)));
    }

    private String normalizeRequiredText(String value, String field, int maxLength) {
        String normalized = value == null ? "" : value
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .trim()
                .replaceAll("\\s+", " ");
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        int safeMaxLength = Math.max(1, maxLength);
        if (normalized.length() > safeMaxLength) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return normalized;
    }

    private int normalizedMaxAddressesPerUser() {
        return Math.max(1, Math.min(runtimeConfig.getInt("user-address.max-per-user", 20), 100));
    }
}
