package com.example.shop.security;

import com.example.shop.entity.User;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetails;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomUserDetailsServiceTest {
    private UserService userService;
    private CustomUserDetailsService service;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        service = new CustomUserDetailsService(userService);
    }

    @Test
    void loadUserByUsernameFallsBackToEmailForPasswordLogin() {
        User user = new User();
        user.setId(7L);
        user.setUsername("mia");
        user.setEmail("mia@example.com");
        user.setPassword("encoded-password");
        user.setRole("USER");
        user.setStatus("ACTIVE");

        when(userService.findByUsernameOrPhoneOrEmail("mia@example.com")).thenReturn(user);

        UserDetails details = service.loadUserByUsername("  MIA@Example.COM  ");

        assertEquals("mia", details.getUsername());
        assertEquals("encoded-password", details.getPassword());
        verify(userService).findByUsernameOrPhoneOrEmail("mia@example.com");
    }
}
