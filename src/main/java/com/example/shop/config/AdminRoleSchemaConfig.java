package com.example.shop.config;

import com.example.shop.service.AdminRoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class AdminRoleSchemaConfig {
    private final AdminRoleService adminRoleService;

    @Bean
    public ApplicationRunner ensureAdminRoleSchema() {
        return args -> adminRoleService.ensureSchema();
    }
}
