package com.example.shop.service;

import com.example.shop.entity.User;
import com.example.shop.entity.UserAddress;
import com.example.shop.repository.UserAddressMapper;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAddressServiceTest {
    private UserAddressMapper userAddressMapper;
    private UserMapper userMapper;
    private RuntimeConfigService runtimeConfig;
    private UserAddressService service;

    @BeforeEach
    void setUp() {
        userAddressMapper = mock(UserAddressMapper.class);
        userMapper = mock(UserMapper.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("user-address.max-per-user", 20)).thenReturn(2);
        when(runtimeConfig.getInt("user-address.recipient-name-max-chars", 80)).thenReturn(40);
        when(runtimeConfig.getInt("user-address.phone-max-chars", 30)).thenReturn(20);
        when(runtimeConfig.getInt("user-address.region-max-chars", 1000)).thenReturn(120);
        when(runtimeConfig.getInt("user-address.postal-code-max-chars", 20)).thenReturn(20);
        when(runtimeConfig.getInt("user-address.detail-address-max-chars", 260)).thenReturn(80);
        when(runtimeConfig.getInt("user-address.address-max-chars", 500)).thenReturn(80);
        when(userMapper.findByIdForUpdate(7L)).thenReturn(new User());
        service = new UserAddressService(userAddressMapper, userMapper, runtimeConfig);
    }

    @Test
    void addAddressNormalizesFieldsBeforeSaving() {
        UserAddress address = address(7L, "  Mia\tChen  ", "  555\n0101  ", "  1 Main\u0000 Street\tApt 2  ");
        when(userAddressMapper.countByUserId(7L)).thenReturn(0);

        service.addAddress(address);

        InOrder inOrder = inOrder(userMapper, userAddressMapper);
        inOrder.verify(userMapper).findByIdForUpdate(7L);
        inOrder.verify(userAddressMapper).countByUserId(7L);
        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).insert(captor.capture());
        assertEquals("Mia Chen", captor.getValue().getRecipientName());
        assertEquals("555 0101", captor.getValue().getPhone());
        assertEquals("中国 | 北京市 | 朝阳区", captor.getValue().getRegion());
        assertEquals("100000", captor.getValue().getPostalCode());
        assertEquals("1 Main Street Apt 2", captor.getValue().getDetailAddress());
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
        when(userAddressMapper.countByUserId(7L)).thenReturn(1);

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
        when(userAddressMapper.countByUserId(7L)).thenReturn(1);

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
        when(userAddressMapper.countByUserId(7L)).thenReturn(2);

        assertThrows(IllegalStateException.class, () -> service.addAddress(third));

        verify(userAddressMapper, never()).insert(any());
    }

    @Test
    void setDefaultLocksUserBeforeClearingDefaults() {
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(12L);
        when(userAddressMapper.findById(12L)).thenReturn(existing);
        when(userAddressMapper.setDefault(12L, 7L)).thenReturn(1);

        service.setDefault(12L);

        InOrder inOrder = inOrder(userAddressMapper, userMapper);
        inOrder.verify(userAddressMapper).findById(12L);
        inOrder.verify(userMapper).findByIdForUpdate(7L);
        inOrder.verify(userAddressMapper).findById(12L);
        inOrder.verify(userAddressMapper).clearDefault(7L);
        inOrder.verify(userAddressMapper).setDefault(12L, 7L);
    }

    @Test
    void updateAddressNormalizesFieldsBeforeSaving() {
        UserAddress address = address(7L, "  Mia\tChen  ", "  555\n0101  ", "  1 Main\u0000 Street  ");
        address.setId(12L);
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(12L);
        when(userAddressMapper.findById(12L)).thenReturn(existing);
        when(userAddressMapper.update(any(UserAddress.class))).thenReturn(1);

        service.updateAddress(address);

        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).update(captor.capture());
        assertEquals("Mia Chen", captor.getValue().getRecipientName());
        assertEquals("555 0101", captor.getValue().getPhone());
        assertEquals("中国 | 北京市 | 朝阳区", captor.getValue().getRegion());
        assertEquals("100000", captor.getValue().getPostalCode());
        assertEquals("1 Main Street", captor.getValue().getDetailAddress());
        assertEquals("1 Main Street", captor.getValue().getAddress());
    }

    @Test
    void updateAddressRejectsMissingIdBeforeSaving() {
        UserAddress address = address(7L, "Mia Chen", "5550101", "1 Main Street");

        assertThrows(IllegalArgumentException.class, () -> service.updateAddress(address));

        verify(userAddressMapper, never()).update(any(UserAddress.class));
    }

    @Test
    void updateAddressClearsExistingDefaultWhenAddressBecomesDefault() {
        UserAddress address = address(7L, "Mia Chen", "5550101", "2 Main Street");
        address.setId(12L);
        address.setIsDefault(true);
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(12L);
        when(userAddressMapper.findById(12L)).thenReturn(existing);
        when(userAddressMapper.update(any(UserAddress.class))).thenReturn(1);

        service.updateAddress(address);

        InOrder inOrder = inOrder(userAddressMapper, userMapper);
        inOrder.verify(userAddressMapper).findById(12L);
        inOrder.verify(userMapper).findByIdForUpdate(7L);
        inOrder.verify(userAddressMapper).findById(12L);
        inOrder.verify(userAddressMapper).clearDefault(7L);
        inOrder.verify(userAddressMapper).update(any(UserAddress.class));
    }

    @Test
    void updateAddressRejectsAddressDeletedAfterUserLock() {
        UserAddress address = address(7L, "Mia Chen", "5550101", "2 Main Street");
        address.setId(12L);
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(12L);
        when(userAddressMapper.findById(12L)).thenReturn(existing, null);

        assertThrows(IllegalArgumentException.class, () -> service.updateAddress(address));

        verify(userMapper).findByIdForUpdate(7L);
        verify(userAddressMapper, never()).update(any(UserAddress.class));
    }

    @Test
    void updateAddressUsesExistingOwnerInsteadOfSubmittedUserId() {
        UserAddress address = address(99L, "Mia Chen", "5550101", "2 Main Street");
        address.setId(12L);
        address.setIsDefault(true);
        UserAddress existing = address(7L, "Mia Chen", "5550101", "1 Main Street");
        existing.setId(12L);
        when(userAddressMapper.findById(12L)).thenReturn(existing);
        when(userAddressMapper.update(any(UserAddress.class))).thenReturn(1);

        service.updateAddress(address);

        verify(userMapper).findByIdForUpdate(7L);
        verify(userMapper, never()).findByIdForUpdate(99L);
        verify(userAddressMapper).clearDefault(7L);
        ArgumentCaptor<UserAddress> captor = ArgumentCaptor.forClass(UserAddress.class);
        verify(userAddressMapper).update(captor.capture());
        assertEquals(7L, captor.getValue().getUserId());
    }

    private UserAddress address(Long userId, String recipientName, String phone, String addressText) {
        UserAddress address = new UserAddress();
        address.setUserId(userId);
        address.setRecipientName(recipientName);
        address.setPhone(phone);
        address.setRegion(" 中国 | 北京市 | 朝阳区 ");
        address.setPostalCode(" 100000 ");
        address.setDetailAddress(addressText);
        address.setAddress(addressText);
        return address;
    }
}
