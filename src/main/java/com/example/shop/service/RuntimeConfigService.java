package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@Slf4j
public class RuntimeConfigService {
    private final Environment environment;

    public RuntimeConfigService(Environment environment) {
        this.environment = environment;
    }

    public String getString(String key, String defaultValue) {
        return environment.getProperty(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        return environment.getProperty(key, Integer.class, defaultValue);
    }

    public long getLong(String key, long defaultValue) {
        return environment.getProperty(key, Long.class, defaultValue);
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        return environment.getProperty(key, Boolean.class, defaultValue);
    }

    public BigDecimal getBigDecimal(String key, BigDecimal defaultValue) {
        String value = environment.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
