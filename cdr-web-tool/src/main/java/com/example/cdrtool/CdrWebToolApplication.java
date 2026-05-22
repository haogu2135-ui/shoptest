package com.example.cdrtool;

import com.example.cdrtool.config.CdrToolProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CdrToolProperties.class)
public class CdrWebToolApplication {
    public static void main(String[] args) {
        SpringApplication.run(CdrWebToolApplication.class, args);
    }
}
