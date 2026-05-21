package com.example.shop.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailAccountProperties {
    private List<Account> accounts = new ArrayList<>();
    private int codeTtlMinutes = 10;
    private int resendIntervalSeconds = 60;
    private int maxCodeAttempts = 5;
    private String brandName = "ShopMX";

    @Data
    public static class Account {
        private String host;
        private Integer port;
        private String username;
        private String password;
        private String from;
        private boolean ssl;
        private boolean starttls = true;
    }
}
