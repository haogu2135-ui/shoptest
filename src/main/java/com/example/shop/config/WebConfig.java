package com.example.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final CorsOriginProperties corsOriginProperties;

    @Value("${pet-gallery.upload-dir:uploads/pet-gallery}")
    private String petGalleryUploadDir;

    public WebConfig(CorsOriginProperties corsOriginProperties) {
        this.corsOriginProperties = corsOriginProperties;
    }

    // Spring Boot 会自动配置 Thymeleaf，无需手动配置视图解析器

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(corsOriginProperties.getCorsAllowedOriginPatternArray())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String petGalleryLocation = Paths.get(petGalleryUploadDir).toAbsolutePath().normalize().toUri().toString();
        if (!petGalleryLocation.endsWith("/")) {
            petGalleryLocation = petGalleryLocation + "/";
        }
        registry.addResourceHandler("/uploads/pet-gallery/**")
                .addResourceLocations(petGalleryLocation)
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());
    }
} 
