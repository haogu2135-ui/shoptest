package com.example.shop.security;

import com.example.shop.entity.User;

public final class UserAccountStatusPolicy {
    private static final String ACTIVE_STATUS = "ACTIVE";

    private UserAccountStatusPolicy() {
    }

    public static boolean canIssueUserSession(User user) {
        return user != null && isActiveStatus(user.getStatus());
    }

    public static boolean isActiveStatus(String status) {
        return status != null && ACTIVE_STATUS.equalsIgnoreCase(status.trim());
    }
}
