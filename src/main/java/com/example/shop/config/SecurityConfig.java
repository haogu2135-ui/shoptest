package com.example.shop.config;

import com.example.shop.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors().and()
            .csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .and()
            .authorizeRequests()
            .antMatchers(HttpMethod.GET, "/app/config").permitAll()
            .antMatchers("/auth/login", "/auth/register", "/auth/forgot-password").permitAll()
            .antMatchers("/ws/support").permitAll()
            .antMatchers(HttpMethod.GET, "/orders/track").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/checkout/guest").permitAll()
            .antMatchers(HttpMethod.POST, "/payments").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/*/simulate-paid").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/*/simulate-callback").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/callback").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/stripe/webhook").permitAll()
            .antMatchers("/users/create-admin").permitAll()
            .antMatchers("/products/**").permitAll()
            .antMatchers("/categories/**").permitAll()
            .antMatchers(HttpMethod.GET, "/pet-gallery").permitAll()
            .antMatchers(HttpMethod.POST, "/pet-gallery/*/like").permitAll()
            .antMatchers(HttpMethod.GET, "/uploads/pet-gallery/**").permitAll()
            .antMatchers(HttpMethod.POST, "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.PUT, "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.DELETE, "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.GET, "/brands/**").permitAll()
            .antMatchers(HttpMethod.GET, "/coupons/public").permitAll()
            .antMatchers(HttpMethod.GET, "/reviews/**").permitAll()
            .antMatchers(HttpMethod.POST, "/reviews/**").authenticated()
            .antMatchers(HttpMethod.GET, "/product-questions/**").permitAll()
            .antMatchers(HttpMethod.POST, "/product-questions/**").authenticated()
            .antMatchers("/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
            .and()
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList(
            "http://localhost:*",
            "http://127.0.0.1:*",
            "http://10.*:*",
            "http://172.*:*",
            "http://192.168.*:*"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
} 
