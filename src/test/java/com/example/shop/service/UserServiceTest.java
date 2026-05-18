package com.example.shop.service;

import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {
    private UserMapper userMapper;
    private UserService service;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        service = new UserService(userMapper, mock(PasswordEncoder.class));
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(userMapper.countAll()).thenReturn(12L);

        assertEquals(12L, service.count());

        verify(userMapper).countAll();
        verify(userMapper, never()).findAll();
    }

    @Test
    void searchNormalizesTextFilters() {
        when(userMapper.search("Jane Doe", "ADMIN", "ACTIVE")).thenReturn(List.of());

        service.search("  Jane\u0000   Doe  ", " ADMIN ", " ACTIVE ");

        verify(userMapper).search("Jane Doe", "ADMIN", "ACTIVE");
    }

    @Test
    void searchConvertsBlankFiltersToNull() {
        when(userMapper.search(null, null, null)).thenReturn(List.of());

        service.search(" \u0000 ", " ", null);

        verify(userMapper).search(null, null, null);
    }
}
