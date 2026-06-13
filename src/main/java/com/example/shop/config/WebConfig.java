package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final CorsOriginProperties corsOriginProperties;
    private final RuntimeConfigService runtimeConfig;

    public WebConfig(CorsOriginProperties corsOriginProperties, RuntimeConfigService runtimeConfig) {
        this.corsOriginProperties = corsOriginProperties;
        this.runtimeConfig = runtimeConfig;
    }

    // Spring Boot 会自动配置 Thymeleaf，无需手动配置视图解析器

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(corsOriginProperties.getCorsAllowedOriginPatternArray())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders(Arrays.asList(
                        "Authorization",
                        "Content-Type",
                        "Accept",
                        "Accept-Language",
                        "X-Requested-With",
                        RequestCorrelationFilter.REQUEST_ID_HEADER,
                        RequestCorrelationFilter.CORRELATION_ID_HEADER,
                        "X-Bootstrap-Token",
                        "Idempotency-Key").toArray(new String[0]))
                .exposedHeaders(RequestCorrelationFilter.REQUEST_ID_HEADER)
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String petGalleryLocation = Paths.get(runtimeConfig.getString("pet-gallery.upload-dir", "uploads/pet-gallery")).toAbsolutePath().normalize().toUri().toString();
        if (!petGalleryLocation.endsWith("/")) {
            petGalleryLocation = petGalleryLocation + "/";
        }
        registry.addResourceHandler("/uploads/pet-gallery/**")
                .addResourceLocations(petGalleryLocation)
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());

        String reviewImageLocation = Paths.get(runtimeConfig.getString("review.image.upload-dir", "uploads/reviews")).toAbsolutePath().normalize().toUri().toString();
        if (!reviewImageLocation.endsWith("/")) {
            reviewImageLocation = reviewImageLocation + "/";
        }
        registry.addResourceHandler("/uploads/reviews/**")
                .addResourceLocations(reviewImageLocation)
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());
    }
} 
