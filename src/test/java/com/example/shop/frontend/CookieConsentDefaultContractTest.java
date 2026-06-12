package com.example.shop.frontend;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CookieConsentDefaultContractTest {

    private static final List<Pattern> CONSENT_ACCEPTED_PATTERNS = List.of(
            Pattern.compile("(?is)cookie[-_\\s]?consent.{0,200}['\"]accepted['\"]"),
            Pattern.compile("(?is)consent.{0,120}(?:default|initial|fallback).{0,120}['\"]accepted['\"]"),
            Pattern.compile("(?is)(?:localStorage|sessionStorage)\\.setItem\\([^)]*consent[^)]*['\"]accepted['\"]"),
            Pattern.compile("(?is)set(?:Local|Session)StorageItem\\([^)]*consent[^)]*['\"]accepted['\"]")
    );

    private static final Pattern PRE_CONSENT_ANALYTICS_SCRIPT = Pattern.compile(
            "(?is)googletagmanager|google-analytics|gtag\\s*\\(|dataLayer|fbq\\s*\\(|connect\\.facebook\\.net|hotjar|clarity\\.ms|segment\\.io|mixpanel|amplitude"
    );

    @Test
    void frontendDoesNotDefaultCookieConsentToAccepted() throws Exception {
        List<Path> sources = productionFrontendFiles();
        List<Path> offenders = sources.stream()
                .filter(CookieConsentDefaultContractTest::containsAcceptedConsentDefault)
                .collect(Collectors.toList());

        assertFalse(sources.isEmpty(), "Sanity check should inspect frontend production files");
        assertTrue(offenders.isEmpty(),
                "Cookie consent must require an explicit user action instead of defaulting to accepted: " + offenders);
    }

    @Test
    void frontendDoesNotPreloadThirdPartyAnalyticsWithoutConsentGate() throws Exception {
        List<Path> sources = productionFrontendFiles();
        List<Path> offenders = sources.stream()
                .filter(CookieConsentDefaultContractTest::containsPreConsentAnalyticsScript)
                .collect(Collectors.toList());

        assertFalse(sources.isEmpty(), "Sanity check should inspect frontend production files");
        assertTrue(offenders.isEmpty(),
                "Third-party analytics scripts must not load before an explicit consent gate: " + offenders);
    }

    private static List<Path> productionFrontendFiles() throws Exception {
        List<Path> roots = List.of(Path.of("frontend/src"), Path.of("frontend/public"));
        try (Stream<Path> paths = roots.stream().flatMap(CookieConsentDefaultContractTest::walk)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(CookieConsentDefaultContractTest::isProductionFrontendFile)
                    .collect(Collectors.toList());
        }
    }

    private static Stream<Path> walk(Path root) {
        try {
            return Files.exists(root) ? Files.walk(root) : Stream.empty();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to inspect " + root, e);
        }
    }

    private static boolean isProductionFrontendFile(Path path) {
        String name = path.getFileName().toString();
        String lowerName = name.toLowerCase(Locale.ROOT);
        if (lowerName.contains(".test.") || lowerName.contains(".spec.")) {
            return false;
        }
        return lowerName.endsWith(".ts")
                || lowerName.endsWith(".tsx")
                || lowerName.endsWith(".js")
                || lowerName.endsWith(".jsx")
                || lowerName.endsWith(".html");
    }

    private static boolean containsAcceptedConsentDefault(Path path) {
        String source = read(path);
        return CONSENT_ACCEPTED_PATTERNS.stream().anyMatch(pattern -> pattern.matcher(source).find());
    }

    private static boolean containsPreConsentAnalyticsScript(Path path) {
        return PRE_CONSENT_ANALYTICS_SCRIPT.matcher(read(path)).find();
    }

    private static String read(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to inspect " + path, e);
        }
    }
}
