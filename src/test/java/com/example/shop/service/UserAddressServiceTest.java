package com.example.shop.service;

import com.example.shop.entity.UserAddress;
import com.example.shop.repository.UserAddressMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAddressServiceTest {
    private UserAddressMapper userAddressMapper;
    private RuntimeConfigService runtimeConfig;
    private UserAddressService service;

    @BeforeEach
    void setUp() {
        userAddressMapper = mock(UserAddressMapper.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("user-address.max-per-user", 20)).thenReturn(2);
        when(runtimeConfig.getInt("user-address.recipient-name-max-chars", 80)).thenReturn(40);
        when(runtimeConfig.getInt("user-address.phone-max-chars", 30)).thenReturn(20);
        when(runtimeConfig.getInt("user-address.address-max-chars", 500)).thenReturn(80);
        service = new UserAddressService(userAddressMapper, runtimeConfig);
    }

    @Test
    void addAddressNormalizesFieldsBeforeSaving() {
        UserAddress address = address(7L, "  Mia\tChen  ", "  555\n0101  ", "  1 Main\u0000 Street\tApt 2  ");
        when(userAddressMapper.findByUserId(7L)).thenReturn(List.of());

        service.addAddress(address);

        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).insert(captor.capture());
        assertEquals("Mia Chen", captor.getValue().getRecipientName());
        assertEquals("555 0101", captor.getValue().getPhone());
        assertEquals("1 Main Street Apt 2", captor.getValue().getAddress());
        assertEquals(Boolean.TRUE, captor.getValue().getIsDefault());
    }

    @Test
    void addAddressCanReplaceExistingDefaultWhenRequested() {
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(11L);
        existing.setIsDefault(true);
        UserAddress next = address(7L, "Mia Chen", "5550101", "2 Main Street");
        next.setIsDefault(true);
        when(userAddressMapper.findByUserId(7L)).thenReturn(List.of(existing));

        service.addAddress(next);

        verify(userAddressMapper).clearDefault(7L);
        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).insert(captor.capture());
        assertEquals(Boolean.TRUE, captor.getValue().getIsDefault());
    }

    @Test
    void addAddressKeepsExistingDefaultWhenNotRequested() {
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(11L);
        existing.setIsDefault(true);
        UserAddress next = address(7L, "Mia Chen", "5550101", "2 Main Street");
        when(userAddressMapper.findByUserId(7L)).thenReturn(List.of(existing));

        service.addAddress(next);

        verify(userAddressMapper, never()).clearDefault(7L);
        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).insert(captor.capture());
        assertEquals(Boolean.FALSE, captor.getValue().getIsDefault());
    }

    @Test
    void addAddressRejectsMissingRequiredFieldsBeforeSaving() {
        UserAddress address = address(7L, " ", "5550101", "1 Main Street");

        assertThrows(IllegalArgumentException.class, () -> service.addAddress(address));

        verify(userAddressMapper, never()).insert(any());
    }

    @Test
    void addAddressRejectsUserAddressLimitBeforeSaving() {
        UserAddress first = address(7L, "Mia Chen", "5550101", "1 Main Street");
        UserAddress second = address(7L, "Mia Chen", "5550101", "2 Main Street");
        UserAddress third = address(7L, "Mia Chen", "5550101", "3 Main Street");
        when(userAddressMapper.findByUserId(7L)).thenReturn(List.of(first, second));

        assertThrows(IllegalStateException.class, () -> service.addAddress(third));

        verify(userAddressMapper, never()).insert(any());
    }

    @Test
    void updateAddressNormalizesFieldsBeforeSaving() {
        UserAddress address = address(7L, "  Mia\tChen  ", "  555\n0101  ", "  1 Main\u0000 Street  ");
        address.setId(12L);
        when(userAddressMapper.update(any(UserAddress.class))).thenReturn(1);

        service.updateAddress(address);

        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).update(captor.capture());
        assertEquals("Mia Chen", captor.getValue().getRecipientName());
        assertEquals("555 0101", captor.getValue().getPhone());
        assertEquals("1 Main Street", captor.getValue().getAddress());
    }

    private UserAddress address(Long userId, String recipientName, String phone, String addressText) {
        UserAddress address = new UserAddress();
        address.setUserId(userId);
        address.setRecipientName(recipientName);
        address.setPhone(phone);
        address.setAddress(addressText);
        return address;
    }
}
