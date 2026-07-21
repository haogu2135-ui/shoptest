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
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

import static org.springframework.security.config.Customizer.withDefaults;

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
            // The API authenticates unsafe requests with explicit JWT bearer headers
            // and does not use browser session cookies.
            .csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .and()
            .exceptionHandling()
            .authenticationEntryPoint(securityApiErrorHandler)
            .accessDeniedHandler(securityApiErrorHandler)
            .and()
            .headers(headers -> headers
                    .contentTypeOptions(withDefaults())
                    .frameOptions(frameOptions -> frameOptions.sameOrigin())
                    .httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .preload(true)
                            .maxAgeInSeconds(31536000))
                    .referrerPolicy(referrer -> referrer
                            .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                    .addHeaderWriter((request, response) -> response.setHeader("Content-Security-Policy",
                            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http: data: blob:; "
                                    + "font-src 'self' data:; connect-src 'self' https: http: wss: ws:; "
                                    + "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"))
                    .addHeaderWriter((request, response) -> response.setHeader("Permissions-Policy",
                            "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=(), serial=(), bluetooth=(), browsing-topics=()")))
            .authorizeRequests()
            .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            .antMatchers(HttpMethod.GET, "/actuator/health", "/actuator/info").permitAll()
            .antMatchers(HttpMethod.GET, "/announcements/active").permitAll()
            .antMatchers(HttpMethod.GET, "/app/config").permitAll()
            .antMatchers(HttpMethod.POST, "/errors").permitAll()
            .antMatchers(HttpMethod.GET, "/search").permitAll()
            .antMatchers(HttpMethod.GET, "/home/products", "/home/products/**").permitAll()
            .antMatchers(HttpMethod.GET, "/payment", "/payment/").permitAll()
            .antMatchers(HttpMethod.GET, "/payment/channels", "/payments/channels").permitAll()
            .antMatchers(HttpMethod.GET, "/payment/webhook-evidence", "/payments/webhook-evidence").permitAll()
            .antMatchers(HttpMethod.POST, "/payment/guest/order/*", "/payment/guest/order/**", "/payments/guest/order/*", "/payments/guest/order/**").permitAll()
            .antMatchers("/auth/login", "/auth/register", "/auth/forgot-password", "/auth/password-reset-code", "/auth/email-code", "/auth/email-login", "/auth/refresh").permitAll()
            .antMatchers("/ws/support").permitAll()
            .antMatchers(HttpMethod.GET, "/support", "/support/").permitAll()
            .antMatchers(HttpMethod.POST, "/support/guest/session", "/support/guest/session/lookup",
                    "/support/guest/sessions/*/messages", "/support/guest/sessions/**/messages").permitAll()
            .antMatchers(HttpMethod.POST, "/support/guest/messages").permitAll()
            .antMatchers(HttpMethod.PUT, "/support/guest/sessions/*/read", "/support/guest/sessions/**/read").permitAll()
            .antMatchers(HttpMethod.GET, "/orders/track").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/track").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/guest/*", "/orders/guest/**").permitAll()
            .antMatchers(HttpMethod.GET, "/logistics/track").permitAll()
            .antMatchers(HttpMethod.POST, "/logistics/track").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/checkout/guest").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/guest/*/cancel", "/orders/guest/**/cancel").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/guest/*/confirm", "/orders/guest/**/confirm").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/guest/*/return", "/orders/guest/**/return").permitAll()
            .antMatchers(HttpMethod.POST, "/orders/guest/*/return-shipment", "/orders/guest/**/return-shipment").permitAll()
            .antMatchers(HttpMethod.POST, "/payments").permitAll()
            .antMatchers(HttpMethod.POST, "/payment").permitAll()
            .antMatchers(HttpMethod.POST, "/payment/*/sync", "/payment/**/sync").permitAll()
            .antMatchers(HttpMethod.POST, "/payment/callback").permitAll()
            .antMatchers(HttpMethod.POST, "/payment/stripe/webhook").permitAll()
            .antMatchers(HttpMethod.POST, "/payment/mercado-pago/webhook", "/payment/mercadopago/webhook").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/*/sync", "/payments/**/sync").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/callback").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/stripe/webhook").permitAll()
            .antMatchers(HttpMethod.POST, "/payments/mercado-pago/webhook", "/payments/mercadopago/webhook").permitAll()
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
            .antMatchers(HttpMethod.GET, "/uploads/reviews/**").permitAll()
            .antMatchers(HttpMethod.POST, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.PUT, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.DELETE, "/brands", "/brands/**").hasRole("ADMIN")
            .antMatchers(HttpMethod.GET, "/brands", "/brands/**").permitAll()
            .antMatchers(HttpMethod.GET, "/coupons/public").permitAll()
            .antMatchers(HttpMethod.GET, "/reviews/product/*/reviewable-orders", "/reviews/product/**/reviewable-orders").authenticated()
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
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(corsOriginProperties.getCorsAllowedOriginPatterns());
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "Accept",
                "Accept-Language",
                "X-Requested-With",
                RequestCorrelationFilter.REQUEST_ID_HEADER,
                RequestCorrelationFilter.CORRELATION_ID_HEADER,
                "X-Bootstrap-Token",
                "Idempotency-Key"));
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
