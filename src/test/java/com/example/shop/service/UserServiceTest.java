package com.example.shop.service;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {
    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private UserService service;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");
        service = new UserService(userMapper, passwordEncoder);
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

    @Test
    void registerNormalizesFieldsAndChecksDuplicatesBeforeInsert() {
        User user = new User();
        user.setUsername("  NewUser  ");
        user.setPassword("secret123");
        user.setEmail("  USER@Example.COM  ");
        user.setPhone("  15551234567  ");

        service.register(user);

        assertEquals("NewUser", user.getUsername());
        assertEquals("user@example.com", user.getEmail());
        assertEquals("15551234567", user.getPhone());
        assertEquals("encoded-secret", user.getPassword());
        assertEquals("USER", user.getRole());
        assertEquals("ACTIVE", user.getStatus());
        verify(userMapper).findByPhone("15551234567");
        verify(userMapper).findByUsername("NewUser");
        verify(userMapper).findByUsernameOrPhoneOrEmail("user@example.com");
        verify(userMapper).insert(user);
    }

    @Test
    void registerRejectsDuplicateUsernameBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("duplicate");
        user.setPassword("secret123");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");
        when(userMapper.findByUsername("duplicate")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Username already registered", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsMissingEmailBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email is required", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsDuplicateEmailBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setEmail("Taken@Example.COM");
        user.setPhone("15551234567");
        when(userMapper.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email already registered", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }
}
