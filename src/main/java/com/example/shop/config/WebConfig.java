package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private static final String[] ALLOWED_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"};
    private static final String[] ALLOWED_HEADERS = {
            "Authorization", "Content-Type", "Accept", "Accept-Language", "X-Requested-With",
            RequestCorrelationFilter.REQUEST_ID_HEADER, RequestCorrelationFilter.CORRELATION_ID_HEADER,
            "X-Bootstrap-Token", "X-Guest-Access-Token", "Idempotency-Key"
    };
    private static final CacheControl UPLOAD_CACHE_CONTROL =
            CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic();
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
                .allowedMethods(ALLOWED_METHODS)
                .allowedHeaders(ALLOWED_HEADERS)
                .exposedHeaders(RequestCorrelationFilter.REQUEST_ID_HEADER)
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String petGalleryLocation = uploadResourceLocation("pet-gallery.upload-dir", "uploads/pet-gallery");
        registry.addResourceHandler("/uploads/pet-gallery/**")
                .addResourceLocations(petGalleryLocation)
                .setCacheControl(UPLOAD_CACHE_CONTROL);

        String reviewImageLocation = uploadResourceLocation("review.image.upload-dir", "uploads/reviews");
        registry.addResourceHandler("/uploads/reviews/**")
                .addResourceLocations(reviewImageLocation)
                .setCacheControl(UPLOAD_CACHE_CONTROL);
    }

    private String uploadResourceLocation(String key, String fallback) {
        String location = Paths.get(runtimeConfig.getString(key, fallback))
                .toAbsolutePath().normalize().toUri().toString();
        return location.endsWith("/") ? location : location + "/";
    }
} 
