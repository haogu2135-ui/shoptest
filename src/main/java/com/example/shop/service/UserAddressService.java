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
        List<UserAddress> existing = userAddressMapper.findByUserId(address.getUserId());
        address.setIsDefault(existing.isEmpty());
        address.setCreatedAt(LocalDateTime.now());
        address.setUpdatedAt(LocalDateTime.now());
        userAddressMapper.insert(address);
    }

    @Transactional
    public void updateAddress(UserAddress address) {
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
}
