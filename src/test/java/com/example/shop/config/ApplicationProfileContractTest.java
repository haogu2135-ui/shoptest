package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApplicationProfileContractTest {

    @Test
    void environmentSpecificProfilesDeclareRuntimeModeAndSafetyDefaults() throws Exception {
        Properties dev = load("application-dev.properties");
        Properties staging = load("application-staging.properties");
        Properties prod = load("application-prod.properties");

        assertEquals("dev", dev.getProperty("app.runtime-mode"));
        assertEquals("${PAYMENT_SIMULATION_ENABLED:true}", dev.getProperty("payment.simulation-enabled"));
        assertNoPrivateLanCorsDefaults(dev.getProperty("app.cors.allowed-origin-patterns"));

        assertEquals("${APP_RUNTIME_MODE:staging}", staging.getProperty("app.runtime-mode"));
        assertEquals("${PAYMENT_SIMULATION_ENABLED:false}", staging.getProperty("payment.simulation-enabled"));
        assertEquals("false", staging.getProperty("payment.gateway-allow-local"));

        assertEquals("production", prod.getProperty("app.runtime-mode"));
        assertEquals("${JPA_DDL_AUTO:validate}", prod.getProperty("spring.jpa.hibernate.ddl-auto"));
        assertEquals("${PAYMENT_SIMULATION_ENABLED:false}", prod.getProperty("payment.simulation-enabled"));
        assertEquals("false", prod.getProperty("payment.simulation-allow-production"));
        assertEquals("false", prod.getProperty("payment.gateway-allow-local"));
    }

    @Test
    void baseCorsDefaultExcludesPrivateLanOriginPatterns() throws Exception {
        Properties base = load("application.properties");

        assertNoPrivateLanCorsDefaults(base.getProperty("app.cors.allowed-origin-patterns"));
    }

    @Test
    void actuatorHealthDetailsAreNeverExposedByDefaultOrProductionProfile() throws Exception {
        Properties base = load("application.properties");
        Properties prod = load("application-prod.properties");

        assertEquals("${MANAGEMENT_HEALTH_SHOW_DETAILS:never}", base.getProperty("management.endpoint.health.show-details"));
        assertEquals("never", prod.getProperty("management.endpoint.health.show-details"));
    }

    @Test
    void schemaMigrationsUseFlywayAndKeepSchemaSqlDisabled() throws Exception {
        Properties base = load("application.properties");
        String pom = Files.readString(Path.of("pom.xml"), StandardCharsets.UTF_8);

        assertContains(pom, "<artifactId>flyway-core</artifactId>");
        assertEquals("${JPA_DDL_AUTO:validate}", base.getProperty("spring.jpa.hibernate.ddl-auto"));
        assertEquals("${FLYWAY_ENABLED:true}", base.getProperty("spring.flyway.enabled"));
        assertEquals("classpath:db/migration", base.getProperty("spring.flyway.locations"));
        assertEquals("${FLYWAY_BASELINE_ON_MIGRATE:true}", base.getProperty("spring.flyway.baseline-on-migrate"));
        assertEquals("${FLYWAY_BASELINE_VERSION:1}", base.getProperty("spring.flyway.baseline-version"));
        assertEquals("${FLYWAY_VALIDATE_ON_MIGRATE:true}", base.getProperty("spring.flyway.validate-on-migrate"));
        assertEquals("false", base.getProperty("spring.flyway.out-of-order"));
        assertEquals("never", base.getProperty("spring.sql.init.mode"));
    }

    @Test
    void adminLogDebugDefaultsLimitFrameworkLoggerFanout() throws Exception {
        Properties base = load("application.properties");

        assertEquals("${ADMIN_LOGS_ALLOWED_LOGGER_PREFIXES:com.example.shop}",
                base.getProperty("admin.logs.allowed-logger-prefixes"));
        assertEquals("${ADMIN_LOGS_ADDITIONAL_DEBUG_LOGGERS:}",
                base.getProperty("admin.logs.additional-debug-loggers"));
        assertEquals("${ADMIN_LOGS_DEBUG_AUTO_RESTORE_MINUTES:15}",
                base.getProperty("admin.logs.debug-auto-restore-minutes"));
    }

    @Test
    void baseDatasourceDeclaresProductionHikariDefaults() throws Exception {
        Properties base = load("application.properties");
        String yaml = loadText("application.yml");

        assertEquals("${DB_HIKARI_MAXIMUM_POOL_SIZE:20}", base.getProperty("spring.datasource.hikari.maximum-pool-size"));
        assertEquals("${DB_HIKARI_MINIMUM_IDLE:5}", base.getProperty("spring.datasource.hikari.minimum-idle"));
        assertEquals("${DB_HIKARI_CONNECTION_TIMEOUT_MS:10000}", base.getProperty("spring.datasource.hikari.connection-timeout"));
        assertEquals("${DB_HIKARI_IDLE_TIMEOUT_MS:300000}", base.getProperty("spring.datasource.hikari.idle-timeout"));
        assertEquals("${DB_HIKARI_MAX_LIFETIME_MS:1800000}", base.getProperty("spring.datasource.hikari.max-lifetime"));

        assertContains(yaml, "maximum-pool-size: ${DB_HIKARI_MAXIMUM_POOL_SIZE:20}");
        assertContains(yaml, "minimum-idle: ${DB_HIKARI_MINIMUM_IDLE:5}");
        assertContains(yaml, "connection-timeout: ${DB_HIKARI_CONNECTION_TIMEOUT_MS:10000}");
        assertContains(yaml, "idle-timeout: ${DB_HIKARI_IDLE_TIMEOUT_MS:300000}");
        assertContains(yaml, "max-lifetime: ${DB_HIKARI_MAX_LIFETIME_MS:1800000}");
        assertNoPrivateLanCorsDefaults(yaml);
    }

    @Test
    void datasourceDefaultsDoNotUseRootOrDockerBridgeCredentials() throws Exception {
        Properties base = load("application.properties");
        Properties prod = load("application-prod.properties");
        String yaml = loadText("application.yml");
        String backendEnvExample = Files.readString(Path.of("deploy/backend.env.example"), StandardCharsets.UTF_8);
        String backendCompose = Files.readString(Path.of("deploy/docker-compose.backend.yml"), StandardCharsets.UTF_8);

        assertEquals("${DB_URL:}", base.getProperty("spring.datasource.url"));
        assertEquals("${DB_USERNAME:shop}", base.getProperty("spring.datasource.username"));
        assertEquals("${DB_PASSWORD:}", base.getProperty("spring.datasource.password"));
        assertEquals("${DB_URL:}", prod.getProperty("spring.datasource.url"));
        assertEquals("${DB_PASSWORD:}", prod.getProperty("spring.datasource.password"));
        assertContains(yaml, "url: ${DB_URL:}");
        assertContains(yaml, "username: ${DB_USERNAME:shop}");
        assertContains(yaml, "password: ${DB_PASSWORD:}");

        assertContains(backendEnvExample, "DB_USERNAME=shop");
        assertFalse(backendEnvExample.contains("DB_USERNAME=root"));
        assertFalse(backendEnvExample.contains("MYSQL_ROOT_PASSWORD"));
        assertFalse(backendEnvExample.contains("172.18."));
        assertFalse(backendEnvExample.contains("localhost:3306"));
        assertFalse(backendEnvExample.contains("127.0.0.1:3306"));
        assertFalse(backendCompose.contains("DB_USERNAME=root"));
        assertFalse(backendCompose.contains("MYSQL_ROOT_PASSWORD"));
    }

    @Test
    void stripeSecretsUseEnvironmentPlaceholdersOnly() throws Exception {
        Properties base = load("application.properties");
        String properties = loadText("application.properties");
        String yaml = loadText("application.yml");
        String backendEnvExample = Files.readString(Path.of("deploy/backend.env.example"), StandardCharsets.UTF_8);

        assertEquals("${STRIPE_SECRET_KEY:}", base.getProperty("stripe.secret-key"));
        assertEquals("${STRIPE_WEBHOOK_SECRET:}", base.getProperty("stripe.webhook-secret"));
        assertFalse(yaml.contains("stripe.key"), "application.yml should not contain a stale hardcoded stripe.key");
        assertNoHardcodedStripeSecret(properties);
        assertNoHardcodedStripeSecret(yaml);
        assertFalse(backendEnvExample.contains("STRIPE_SECRET_KEY=sk_"),
                "deployment examples should not ship real-looking Stripe secret keys");
        assertFalse(backendEnvExample.contains("STRIPE_WEBHOOK_SECRET=whsec_"),
                "deployment examples should not ship real-looking Stripe webhook secrets");
    }

    @Test
    void baseRuntimeDefaultsCapAdminCouponPageSize() throws Exception {
        Properties base = load("application.properties");
        String configCenterDefaults = configCenterDefaults();

        assertEquals("${ADMIN_COUPONS_PAGE_MAX_SIZE:100}", base.getProperty("admin.coupons.page-max-size"));
        assertContains(configCenterDefaults, "admin.coupons.page-max-size=100");
    }

    @Test
    void baseRuntimeDefaultsCapLegacyProductListAndImportSkuScans() throws Exception {
        Properties base = load("application.properties");
        String configCenterDefaults = configCenterDefaults();

        assertEquals("${PRODUCT_PUBLIC_LEGACY_LIST_MAX_ROWS:100}", base.getProperty("product.public-legacy-list-max-rows"));
        assertEquals("${PRODUCT_LEGACY_LIST_MAX_ROWS:500}", base.getProperty("product.legacy-list-max-rows"));
        assertEquals("${PRODUCT_DISCOUNT_LIST_MAX_ROWS:100}", base.getProperty("product.discount-list-max-rows"));
        assertEquals("${PRODUCT_IMPORT_VARIANT_SKU_SCAN_PAGE_SIZE:500}", base.getProperty("product.import.variant-sku-scan-page-size"));
        assertEquals("${PRODUCT_IMPORT_VARIANT_SKU_SCAN_MAX_ROWS:5000}", base.getProperty("product.import.variant-sku-scan-max-rows"));

        assertContains(configCenterDefaults, "product.public-legacy-list-max-rows=100");
        assertContains(configCenterDefaults, "product.legacy-list-max-rows=500");
        assertContains(configCenterDefaults, "product.discount-list-max-rows=100");
        assertContains(configCenterDefaults, "product.import.variant-sku-scan-page-size=500");
        assertContains(configCenterDefaults, "product.import.variant-sku-scan-max-rows=5000");
    }

    private static void assertNoPrivateLanCorsDefaults(String value) {
        assertNotNull(value);
        assertFalse(value.contains("10.*"), "default CORS origins must not allow 10/8 LAN wildcards");
        assertFalse(value.contains("172.*"), "default CORS origins must not allow 172/8 LAN wildcards");
        assertFalse(value.contains("192.168"), "default CORS origins must not allow 192.168/16 LAN wildcards");
    }

    private static void assertNoHardcodedStripeSecret(String value) {
        assertNotNull(value);
        assertFalse(value.contains("stripe.key=sk_"), "Stripe secrets should not be hardcoded with the stale stripe.key property");
        assertFalse(value.contains("stripe.secret-key=sk_"), "Stripe secret keys should be supplied by environment placeholders");
        assertFalse(value.contains("stripe.webhook-secret=whsec_"), "Stripe webhook secrets should be supplied by environment placeholders");
        assertFalse(value.contains("sk_test_"), "test-mode Stripe secret keys must not be committed");
    }

    private Properties load(String resourceName) throws IOException {
        Properties properties = new Properties();
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resourceName)) {
            assertNotNull(input, resourceName + " must exist");
            properties.load(input);
        }
        return properties;
    }

    private String loadText(String resourceName) throws IOException {
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resourceName)) {
            assertNotNull(input, resourceName + " must exist");
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String configCenterDefaults() throws ReflectiveOperationException {
        java.lang.reflect.Field field = com.example.shop.service.ConfigCenterService.class.getDeclaredField("DEFAULT_CONTENT");
        field.setAccessible(true);
        return (String) field.get(null);
    }

    private static void assertContains(String value, String expected) {
        assertNotNull(value);
        assertTrue(value.contains(expected), "expected configuration to contain: " + expected);
    }
}
