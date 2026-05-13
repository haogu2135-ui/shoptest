package com.example.shop.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

public final class SecurityUtils {
    private SecurityUtils() {
    }

    public static UserDetailsImpl requireUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetailsImpl)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return (UserDetailsImpl) authentication.getPrincipal();
    }

    public static boolean isAdmin(UserDetailsImpl user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    public static boolean isSuperAdmin(UserDetailsImpl user) {
        return user != null && user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_SUPER_ADMIN".equals(authority.getAuthority()));
    }

    public static void assertSelfOrAdmin(Authentication authentication, Long userId) {
        UserDetailsImpl user = requireUser(authentication);
        if (isAdmin(user)) {
            return;
        }
        if (userId == null || !Objects.equals(user.getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
    }

    public static void assertAdmin(Authentication authentication) {
        UserDetailsImpl user = requireUser(authentication);
        if (!isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin permission required");
        }
    }

    public static void assertSuperAdmin(Authentication authentication) {
        UserDetailsImpl user = requireUser(authentication);
        if (!isSuperAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super admin permission required");
        }
    }
}
