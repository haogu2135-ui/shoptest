package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CheckoutSupportPanelDismissContractTest {
    private static final Path CHECKOUT_SOURCE = Path.of("frontend/src/pages/Checkout.tsx");

    @Test
    void supportPanelDismissSuppressesImmediateAutoReopenAcrossStateKeyChanges() throws IOException {
        String source = Files.readString(CHECKOUT_SOURCE);

        assertTrue(source.contains("SUPPORT_PANEL_DISMISS_SUPPRESS_MS"),
                "Checkout support panel should define a manual-dismiss suppression window");
        assertTrue(source.contains("supportPanelDismissedUntilRef"),
                "Checkout support panel should remember when manual dismissal suppression expires");
        assertTrue(Pattern.compile("supportPanelDismissedUntilRef\\.current\\s*>\\s*Date\\.now\\(\\)[\\s\\S]{0,120}return;")
                        .matcher(source)
                        .find(),
                "Auto-open effect should skip reopening while a recent manual dismissal is active");
        assertTrue(Pattern.compile("supportPanelDismissedUntilRef\\.current\\s*=\\s*Date\\.now\\(\\)\\s*\\+\\s*SUPPORT_PANEL_DISMISS_SUPPRESS_MS")
                        .matcher(source)
                        .results()
                        .count() >= 2,
                "Both summary dismissal and native-back dismissal should start the suppression window");
        assertTrue(Pattern.compile("if \\(nextOpen\\) \\{[\\s\\S]{0,180}supportPanelDismissedUntilRef\\.current\\s*=\\s*0;")
                        .matcher(source)
                        .find(),
                "Manual or programmatic reopening should clear the dismissal suppression");
    }
}
