package com.example.shop.security;

import com.example.shop.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public class UserDetailsImpl implements UserDetails {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String username;
    private String email;
    private String status;
    private LocalDateTime passwordChangedAt;

    @JsonIgnore
    private String password;

    private Collection<? extends GrantedAuthority> authorities;

    public UserDetailsImpl(Long id, String username, String email, String status, String password,
            Collection<? extends GrantedAuthority> authorities) {
        this(id, username, email, status, password, null, authorities);
    }

    public UserDetailsImpl(Long id, String username, String email, String status, String password,
            LocalDateTime passwordChangedAt, Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.status = status;
        this.password = password;
        this.passwordChangedAt = passwordChangedAt;
        this.authorities = authorities;
    }

    public static UserDetailsImpl build(User user) {
        Set<String> authorityNames = new LinkedHashSet<>();
        String role = user.getRole() == null ? "USER" : user.getRole().trim().toUpperCase();
        String roleCode = user.getRoleCode() == null ? "" : user.getRoleCode().trim().toUpperCase();
        if (!role.isEmpty()) {
            authorityNames.add("ROLE_" + role);
        }
        boolean adminRole = "ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        if (adminRole && !roleCode.isEmpty() && !roleCode.equals(role)) {
            authorityNames.add("ROLE_" + roleCode);
        }
        if ("SUPER_ADMIN".equals(role)) {
            authorityNames.add("ROLE_SUPER_ADMIN");
        }
        if (adminRole) {
            authorityNames.add("ROLE_ADMIN");
        }
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorityNames.forEach(authority -> authorities.add(new SimpleGrantedAuthority(authority)));

        return new UserDetailsImpl(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getStatus(),
                user.getPassword(),
                user.getPasswordChangedAt(),
                authorities);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public LocalDateTime getPasswordChangedAt() {
        return passwordChangedAt;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == null || !"BANNED".equalsIgnoreCase(status);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        UserDetailsImpl user = (UserDetailsImpl) o;
        return Objects.equals(id, user.id);
    }
}
