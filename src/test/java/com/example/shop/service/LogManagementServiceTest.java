package com.example.shop.service;

import com.example.shop.dto.LogManagementStatusResponse;
import com.example.shop.dto.LogPreviewResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class LogManagementServiceTest {
    @TempDir
    Path tempDir;

    private LoggingSystem loggingSystem;
    private MockEnvironment environment;
    private LogManagementService service;

    @BeforeEach
    void setUp() throws Exception {
        loggingSystem = mock(LoggingSystem.class);
        environment = new MockEnvironment();
        Path logFile = tempDir.resolve("shop-backend.log");
        environment.setProperty("logging.file.name", logFile.toString());
        environment.setProperty("admin.logs.allowed-logger-prefixes", "com.example.shop,org.mybatis,org.springframework.web,org.springframework.security");
        environment.setProperty("admin.logs.additional-debug-loggers", "org.mybatis,org.springframework.web,org.springframework.security");
        environment.setProperty("admin.logs.max-range-hours", "2");
        environment.setProperty("admin.logs.preview-max-lines", "2");
        environment.setProperty("admin.logs.max-download-bytes", "1024");
        service = new LogManagementService(loggingSystem, environment);

        Files.writeString(logFile,
                "2026-05-24 10:00:00.000  INFO [requestId:a] first shop event\n"
                        + "stack continuation line\n"
                        + "2026-05-24 10:05:00.000 ERROR [requestId:b] second shop event\n"
                        + "2026-05-24 10:10:00.000  WARN [requestId:c] third shop event\n",
                StandardCharsets.UTF_8);
    }

    @Test
    void onlyAllowsConfiguredLoggerPrefixesForDebugToggle() {
        service.setDebug(true, "com.example.shop.service.PaymentService");

        verify(loggingSystem).setLogLevel("com.example.shop.service.PaymentService", LogLevel.DEBUG);
        verify(loggingSystem).setLogLevel("org.mybatis", LogLevel.DEBUG);
        verify(loggingSystem).setLogLevel("org.springframework.web", LogLevel.DEBUG);
        verify(loggingSystem).setLogLevel("org.springframework.security", LogLevel.DEBUG);
        assertThrows(ResponseStatusException.class, () -> service.setDebug(true, "org.hibernate.SQL"));
        assertThrows(ResponseStatusException.class, () -> service.setDebug(true, "com.example.shop\nBad"));
    }

    @Test
    void statusExposesOperationalLimits() {
        LogManagementStatusResponse status = service.status(null);

        assertEquals("com.example.shop", status.getLoggerName());
        assertEquals(2, status.getMaxRangeHours());
        assertEquals(2, status.getMaxPreviewLines());
        assertEquals(1024, status.getMaxDownloadBytes());
        assertTrue(status.getAllowedLoggerPrefixes().contains("com.example.shop"));
        assertTrue(status.getAvailableFiles().contains("shop-backend.log"));
    }

    @Test
    void statusDoesNotFollowSymlinkedLogFiles() throws Exception {
        Path outside = tempDir.resolve("outside-secret.log");
        Files.writeString(outside, "2026-05-24 10:00:00.000 ERROR secret\n", StandardCharsets.UTF_8);
        Files.createSymbolicLink(tempDir.resolve("linked-secret.log"), outside);

        LogManagementStatusResponse status = service.status(null);

        assertTrue(status.getAvailableFiles().contains("shop-backend.log"));
        assertTrue(status.getAvailableFiles().stream().noneMatch("linked-secret.log"::equals));
    }

    @Test
    void previewClampsLineLimitAndRejectsLargeTimeRanges() {
        LocalDateTime start = LocalDateTime.of(2026, 5, 24, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 5, 24, 10, 30);

        LogPreviewResponse response = service.preview(start, end, "shop", null, 20);

        assertEquals(2, response.getLimit());
        assertEquals(3, response.getMatchedLines());
        assertTrue(response.isTruncated());
        assertEquals(2, response.getLines().size());
        assertThrows(ResponseStatusException.class, () -> service.preview(start, start.plusHours(3), null, null, 20));
    }

    @Test
    void downloadStopsAtConfiguredByteLimitAndAddsMarker() throws Exception {
        environment.setProperty("admin.logs.max-download-bytes", "1024");
        Files.writeString(tempDir.resolve("shop-backend.log"),
                "2026-05-24 10:00:00.000  INFO [requestId:a] first shop event\n"
                        + "2026-05-24 10:01:00.000  INFO [requestId:b] " + "x".repeat(1500) + "\n",
                StandardCharsets.UTF_8);

        byte[] bytes = service.download(
                LocalDateTime.of(2026, 5, 24, 10, 0),
                LocalDateTime.of(2026, 5, 24, 10, 30),
                null,
                null);

        String body = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(body.contains("first shop event"));
        assertTrue(body.contains("Log download truncated at 1024 bytes"));
    }
}
