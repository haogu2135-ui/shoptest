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

    @Test
    void masksCookieHeadersAndPiiKeys() {
        assertEquals(
                "Cookie: ******\nSet-Cookie: ******\nphone=****** idCard=****** cardNumber=****** cvv=******",
                SensitiveDataMasker.mask(
                        "Cookie: access=raw-token; refresh=raw-refresh\n"
                                + "Set-Cookie: JSESSIONID=session-secret; Path=/\n"
                                + "phone=15555551234 idCard=ID123456 cardNumber=4111111111111111 cvv=123"));
    }
}
