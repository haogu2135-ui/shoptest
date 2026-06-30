package com.example.shop.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminBootstrapTokenPolicyTest {

    @Test
    void strongConfiguredTokenIsAccepted() {
        assertTrue(AdminBootstrapTokenPolicy.isStrongConfiguredToken("admin-bootstrap-token-2026-06-17-strong"));
    }

    @Test
    void weakConfiguredTokensAreRejected() {
        assertFalse(AdminBootstrapTokenPolicy.isStrongConfiguredToken("temporary-token"));
        assertFalse(AdminBootstrapTokenPolicy.isStrongConfiguredToken("your-bootstrap-token"));
        assertFalse(AdminBootstrapTokenPolicy.isStrongConfiguredToken("secret"));
    }

    @Test
    void blankConfiguredTokenKeepsBootstrapDisabled() {
        assertFalse(AdminBootstrapTokenPolicy.isConfiguredButWeak(""));
        assertFalse(AdminBootstrapTokenPolicy.isConfiguredButWeak(null));
    }

    @Test
    void startupRunnerRejectsWeakConfiguredToken() {
        AdminBootstrapTokenPolicy policy = new AdminBootstrapTokenPolicy("temporary-token");

        assertThrows(IllegalStateException.class,
                () -> policy.validateAdminBootstrapTokenAtStartup().run(new DefaultApplicationArguments(new String[0])));
    }
}
