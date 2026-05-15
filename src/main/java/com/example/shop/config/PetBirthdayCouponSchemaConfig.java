package com.example.shop.config;

import com.example.shop.entity.PetBirthdayCouponConfig;
import com.example.shop.repository.PetBirthdayCouponConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;

@Configuration
@RequiredArgsConstructor
public class PetBirthdayCouponSchemaConfig {
    private final JdbcTemplate jdbcTemplate;
    private final PetBirthdayCouponConfigRepository configRepository;

    @Bean
    public ApplicationRunner ensurePetBirthdayCouponSchema() {
        return args -> {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS pet_birthday_coupon_configs ("
                    + "id BIGINT PRIMARY KEY,"
                    + "enabled BOOLEAN NOT NULL DEFAULT TRUE,"
                    + "name_prefix VARCHAR(100) NOT NULL DEFAULT 'Pet Birthday Gift',"
                    + "coupon_type VARCHAR(30) NOT NULL DEFAULT 'FULL_REDUCTION',"
                    + "threshold_amount DECIMAL(10,2) DEFAULT 30.00,"
                    + "reduction_amount DECIMAL(10,2) DEFAULT 8.00,"
                    + "discount_percent INT,"
                    + "max_discount_amount DECIMAL(10,2),"
                    + "valid_days INT NOT NULL DEFAULT 14,"
                    + "max_benefits_per_user INT NOT NULL DEFAULT 3,"
                    + "total_quantity_per_coupon INT,"
                    + "description TEXT,"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                    + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            configRepository.findById(1L).orElseGet(() -> {
                PetBirthdayCouponConfig config = new PetBirthdayCouponConfig();
                LocalDateTime now = LocalDateTime.now();
                config.setId(1L);
                config.setCreatedAt(now);
                config.setUpdatedAt(now);
                return configRepository.save(config);
            });
        };
    }
}
