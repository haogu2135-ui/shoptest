package com.example.shop.security;

import com.example.shop.entity.User;
import com.example.shop.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserService userService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String login = normalizeLogin(username);
        User user = userService.findByUsernameOrPhoneOrEmail(normalizeEmailLogin(login));
        if (user == null) {
            throw new UsernameNotFoundException("User not found with login: " + login);
        }

        return UserDetailsImpl.build(user);
    }

    private String normalizeLogin(String value) {
        return value == null ? "" : value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeEmailLogin(String value) {
        return value != null && value.contains("@") ? value.toLowerCase() : value;
    }
}
