package com.example.shop.config;

import com.example.shop.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private CorsOriginProperties corsOriginProperties;

    @Autowired
    private SecurityApiErrorHandler securityApiErrorHandler;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @Autowired
    private IpBlacklistFilter ipBlacklistFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors().and()
            .csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .and()
            .exceptionHandling()
            .authenticationEntryPoint(securityApiErrorHandler)
            .accessDeniedHandler(securityApiErrorHandler)
            .and()
            .authorizeRequests()
            .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            .antMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
            .antMatchers(HttpMethod.GET, "/announcements/active").permitAll()
            .antMatchers(HttpMethod.GET, "/app/config").permitAll()
            .antMatchers(HttpMethod.GET, "/payments/channels").permitAll()
            .antMatchers(HttpMethod.GET, "/payments/order/**").permitAll()
            .antMatchers("/auth/login", "/auth/register", "/auth/forgot-password", "/auth/email-code", "/auth/email-login", "/auth/refresh").permitAll()
            .antMatchers("/ws/support").permitAll()
            .antMatchers(HttpMethod.GET, "/support/guest/session", "/support/guest/sessions/*/messages", "/support/guest/sessions/**/messages").permitAll()
            .antMatchers(HttpMethod.POST, "/support/guest/messages").permitAll()
            .antMatchers(HttpMethod.PUT, "/support/guest/sessions/*/read", "/support/guest/sessions/**/read").permitAll()
            .antMatchers(HttpMethod.GET, "/orders/track").permitAll()
            .antMatchers(HttpMethod.GET, "/orders/*", "/orders/*/items").permitAll()
            .antMatchers(HttpMethod.GET, "/logistics/track").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/checkout/guest").permitAll()
            .antMatchers(HttpMethod.PUT, "/orders/*/cancel", "/orders/**/cancel").permitAll()
            .antMatchers(HttpMethod.PUT, "/orders/*/confirm", "/orders/**/confirm").permitAll()
            .antMatchers(HttpMethod.PUT, "/orders/*/return", "/orders/**/return").permitAll()
            .antMatchers(HttpMethod.PUT, "/orders/*/return-shipment", "/orders/**/return-shipment").permitAll()
            .antMatchers(HttpMethod.POST, "/payments").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/*/sync", "/payments/**/sync").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/callback").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/stripe/webhook").permitAll()
            .antMatchers(HttpMethod.POST, "/users/create-admin").permitAll()
            .antMatchers(HttpMethod.POST, "/users/profile/email-code").authenticated()
            .antMatchers(HttpMethod.POST, "/products", "/products/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.PUT, "/products", "/products/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.DELETE, "/products", "/products/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.GET, "/products", "/products/**").permitAll()
            .antMatchers(HttpMethod.POST, "/categories", "/categories/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.PUT, "/categories", "/categories/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.DELETE, "/categories", "/categories/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.GET, "/categories", "/categories/**").permitAll()
            .antMatchers(HttpMethod.GET, "/pet-gallery/quota").authenticated()
            .antMatchers(HttpMethod.GET, "/pet-gallery", "/pet-gallery/**").permitAll()
            .antMatchers(HttpMethod.POST, "/pet-gallery/*/like").permitAll()
            .antMatchers(HttpMethod.GET, "/uploads/pet-gallery/**").permitAll()
            .antMatchers(HttpMethod.POST, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.PUT, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.DELETE, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.GET, "/brands", "/brands/**").permitAll()
            .antMatchers(HttpMethod.GET, "/coupons/public").permitAll()
            .antMatchers(HttpMethod.GET, "/reviews/**").permitAll()
            .antMatchers(HttpMethod.POST, "/reviews/**").authenticated()
            .antMatchers(HttpMethod.GET, "/product-questions/**").permitAll()
            .antMatchers(HttpMethod.POST, "/product-questions/**").authenticated()
            .antMatchers("/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
            .and()
            .addFilterBefore(ipBlacklistFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(rateLimitFilter, BasicAuthenticationFilter.class);

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
        configuration.setAllowedOriginPatterns(corsOriginProperties.getCorsAllowedOriginPatterns());
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList(
                RequestCorrelationFilter.REQUEST_ID_HEADER,
                RateLimitFilter.LIMIT_HEADER,
                RateLimitFilter.REMAINING_HEADER,
                RateLimitFilter.RESET_HEADER,
                "Retry-After"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
} 
