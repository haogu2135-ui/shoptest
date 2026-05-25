package com.example.shop.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SensitiveDataMaskerTest {
    @Test
    void masksAuthorizationKeyValueWithoutLeakingBearerToken() {
        assertEquals(
                "Authorization: Bearer ******; password=******",
                SensitiveDataMasker.mask("Authorization: Bearer abcdefghijklmnop; password=raw-secret"));
    }

    @Test
    void masksStandaloneAuthorizationHeadersJwtAndStripeKeys() {
        assertEquals(
                "Webhook Authorization Bearer ****** jwt.****** stripe_key_******",
                SensitiveDataMasker.mask(
                        "Webhook Authorization Bearer abcdefghijklmnop "
                                + "eyJabc.def.ghi "
                                + "sk_live_abcdefghijklmnop"));
    }
}
