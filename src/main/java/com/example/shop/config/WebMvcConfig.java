package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {
    private final AdminPermissionInterceptor adminPermissionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminPermissionInterceptor).addPathPatterns(
                "/admin/**",
                "/products",
                "/products/**",
                "/brands",
                "/brands/**",
                "/categories",
                "/categories/**",
                "/product-questions/**");
    }
}
