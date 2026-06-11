package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class FrontendApiErrorHandlingContractTest {

    @Test
    void apiClientReportsRetriesAndNotifiesTerminalErrors() throws Exception {
        String source = read("frontend/src/api/index.ts");

        assertTrue(source.contains("reportNonBlockingError"),
                "API client must report terminal request failures instead of console-only handling");
        assertTrue(source.contains("const reportTerminalApiError"),
                "API client must centralize terminal error reporting");
        assertTrue(source.contains("dispatchDomEvent('shop:api-error'"),
                "API client must notify UI listeners for user-facing failure feedback");
        assertTrue(source.contains("shouldRetryTransientError"),
                "Transient retry guard must remain in the API response interceptor");
        assertTrue(source.indexOf("shouldRetryTransientError") < source.indexOf("reportTerminalApiError(error"),
                "The interceptor should retry transient failures before reporting the terminal failure");
        assertTrue(source.contains("_terminalApiErrorNotified"),
                "Terminal failures must be deduplicated per request config");
        assertTrue(source.contains("apiErrorUserMessage"),
                "API errors must provide a generic user-safe message for UI notifications");
        assertFalse(source.contains("dispatchDomEvent('shop:api-error', error"),
                "UI notifications must not receive raw Axios errors or response payloads");
    }

    @Test
    void renderAndGlobalErrorsUseSanitizedRemoteReporter() throws Exception {
        String boundary = read("frontend/src/components/ErrorBoundary.tsx");
        String entrypoint = read("frontend/src/index.tsx");
        String reporter = read("frontend/src/utils/nonBlockingError.ts");

        assertTrue(boundary.contains("reportNonBlockingError('ErrorBoundary caught'"),
                "ErrorBoundary must report render crashes through the shared reporter");
        assertFalse(boundary.contains("console.error('ErrorBoundary caught:'"),
                "ErrorBoundary must not be console-only");
        assertTrue(entrypoint.contains("installGlobalErrorReporting();"),
                "Application entrypoint must install global error/unhandled-rejection reporting");
        assertTrue(reporter.contains("const maskSensitiveData"),
                "Reporter must sanitize sensitive values before remote dispatch");
        assertTrue(reporter.contains("MAX_REPORTS_PER_MINUTE"),
                "Reporter must rate-limit client error reports");
        assertTrue(reporter.contains("DEDUPE_WINDOW_MS"),
                "Reporter must deduplicate repeated client error reports");
        assertTrue(reporter.contains("credentials: 'omit'"),
                "Reporter must not include browser credentials when sending diagnostics");
        assertTrue(reporter.contains("sendBeacon") && reporter.contains("fetch(url"),
                "Reporter must support unload-safe sendBeacon with fetch fallback");
    }

    private static String read(String relativePath) throws Exception {
        return Files.readString(Path.of(relativePath), StandardCharsets.UTF_8);
    }
}
