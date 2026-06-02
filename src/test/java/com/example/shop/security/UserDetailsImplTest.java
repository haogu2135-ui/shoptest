package com.example.shop.security;

import com.example.shop.entity.User;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserDetailsImplTest {

    @Test
    void customRoleCodeDoesNotGrantAdminAuthorityToUserRole() {
        User user = user("USER", "CUSTOMER_SERVICE");

        Set<String> authorities = authorities(user);

        assertTrue(authorities.contains("ROLE_USER"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_CUSTOMER_SERVICE"));
    }

    @Test
    void adminRoleCanCarryCustomRoleCodeWithoutLosingAdminAuthority() {
        User user = user("ADMIN", "CUSTOMER_SERVICE");

        Set<String> authorities = authorities(user);

        assertTrue(authorities.contains("ROLE_ADMIN"));
        assertTrue(authorities.contains("ROLE_CUSTOMER_SERVICE"));
    }

    private Set<String> authorities(User user) {
        return UserDetailsImpl.build(user).getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());
    }

    private User user(String role, String roleCode) {
        User user = new User();
        user.setId(1L);
        user.setUsername("buyer");
        user.setEmail("buyer@example.com");
        user.setPassword("encoded");
        user.setStatus("ACTIVE");
        user.setRole(role);
        user.setRoleCode(roleCode);
        return user;
    }
}
