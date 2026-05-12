package com.example.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Value("${pet-gallery.upload-dir:uploads/pet-gallery}")
    private String petGalleryUploadDir;

    // Spring Boot 会自动配置 Thymeleaf，无需手动配置视图解析器

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        "http://10.*:*",
                        "http://172.*:*",
                        "http://192.168.*:*"
                )
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
                .addResourceLocations(petGalleryLocation);
    }
} 
