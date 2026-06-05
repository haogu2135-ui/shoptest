package com.example.shop.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GatewayUrlValidatorTest {
    @Test
    void rejectsLocalAndPrivateIpv6GatewayUrlsByDefault() {
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://[::1]/pay", false, "Create payment URL"));
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://[0:0:0:0:0:0:0:1]/pay", false, "Create payment URL"));
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://[fd00::1]/pay", false, "Create payment URL"));
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://[fe80::1]/pay", false, "Create payment URL"));
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://[::ffff:127.0.0.1]/pay", false, "Create payment URL"));
    }

    @Test
    void acceptsPublicGatewayUrlAndAllowsLocalOnlyWhenExplicitlyEnabled() {
        assertEquals(
                "https://payments.example.com/pay",
                GatewayUrlValidator.requireOutboundHttpUrl("https://payments.example.com/pay", false, "Create payment URL")
        );
        assertEquals(
                "http://[::1]/pay",
                GatewayUrlValidator.requireOutboundHttpUrl("http://[::1]/pay", true, "Create payment URL")
        );
    }

    @Test
    void rejectsPublicHttpGatewayUrlsEvenWhenLocalGatewaysAreEnabled() {
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://payments.example.com/pay", false, "Create payment URL"));
        assertThrows(IllegalStateException.class,
                () -> GatewayUrlValidator.requireOutboundHttpUrl("http://payments.example.com/pay", true, "Create payment URL"));
    }
}
