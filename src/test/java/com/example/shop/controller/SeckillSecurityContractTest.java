package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SeckillSecurityContractTest {
    @Test
    void publicCampaignReadsAreAnonymousButPurchaseIsNot() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertTrue(source.contains(".antMatchers(HttpMethod.GET, \"/seckill/campaigns\", \"/seckill/campaigns/**\").permitAll()"));
        assertTrue(source.contains(".anyRequest().authenticated()"));
    }
}
