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
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LogManagementServiceTest {
    @TempDir
    Path tempDir;

    private LoggingSystem loggingSystem;
    private MockEnvironment environment;
    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> scheduledFuture;
    private LogManagementService service;

    @BeforeEach
    void setUp() throws Exception {
        loggingSystem = mock(LoggingSystem.class);
        scheduler = mock(ScheduledExecutorService.class);
        scheduledFuture = mock(ScheduledFuture.class);
        doReturn(scheduledFuture).when(scheduler).schedule(any(Runnable.class), anyLong(), eq(TimeUnit.MINUTES));
        environment = new MockEnvironment();
        Path logFile = tempDir.resolve("shop-backend.log");
        environment.setProperty("logging.file.name", logFile.toString());
        environment.setProperty("admin.logs.allowed-logger-prefixes", "com.example.shop");
        environment.setProperty("admin.logs.max-range-hours", "2");
        environment.setProperty("admin.logs.preview-max-lines", "2");
        environment.setProperty("admin.logs.max-download-bytes", "1024");
        service = new LogManagementService(loggingSystem, environment, scheduler);

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
        verify(loggingSystem, never()).setLogLevel("org.mybatis", LogLevel.DEBUG);
        verify(loggingSystem, never()).setLogLevel("org.springframework.web", LogLevel.DEBUG);
        verify(loggingSystem, never()).setLogLevel("org.springframework.security", LogLevel.DEBUG);
        assertThrows(ResponseStatusException.class, () -> service.setDebug(true, "org.hibernate.SQL"));
        assertThrows(ResponseStatusException.class, () -> service.setDebug(true, "com.example.shop\nBad"));
    }

    @Test
    void optionalAdditionalDebugLoggersRequireExplicitAllowlist() {
        environment.setProperty("admin.logs.allowed-logger-prefixes", "com.example.shop,org.mybatis");
        environment.setProperty("admin.logs.additional-debug-loggers", "org.mybatis");

        service.setDebug(true, "com.example.shop");

        verify(loggingSystem).setLogLevel("com.example.shop", LogLevel.DEBUG);
        verify(loggingSystem).setLogLevel("org.mybatis", LogLevel.DEBUG);
    }

    @Test
    void debugToggleSchedulesAutoRestoreToInfo() {
        org.mockito.ArgumentCaptor<Runnable> restoreTask = forClass(Runnable.class);

        service.setDebug(true, "com.example.shop");

        verify(scheduler).schedule(restoreTask.capture(), eq(15L), eq(TimeUnit.MINUTES));
        restoreTask.getValue().run();

        verify(loggingSystem).setLogLevel("com.example.shop", LogLevel.DEBUG);
        verify(loggingSystem).setLogLevel("com.example.shop", LogLevel.INFO);
    }

    @Test
    void disablingDebugCancelsPendingAutoRestore() {
        service.setDebug(true, "com.example.shop");
        service.setDebug(false, "com.example.shop");

        verify(scheduledFuture).cancel(false);
        verify(loggingSystem).setLogLevel("com.example.shop", LogLevel.INFO);
    }

    @Test
    void statusExposesOperationalLimits() {
        LogManagementStatusResponse status = service.status(null);

        assertEquals("com.example.shop", status.getLoggerName());
        assertEquals(2, status.getMaxRangeHours());
        assertEquals(2, status.getMaxPreviewLines());
        assertEquals(1024, status.getMaxDownloadBytes());
        assertTrue(status.getAllowedLoggerPrefixes().contains("com.example.shop"));
        assertTrue(status.getAllowedLoggerPrefixes().stream().noneMatch(prefix -> prefix.startsWith("org.springframework")));
        assertNull(status.getLogDirectory());
        assertTrue(status.getAvailableFiles().contains("shop-backend.log"));
        assertTrue(status.getAvailableFiles().stream().noneMatch(file ->
                Path.of(file).isAbsolute() || file.contains("/") || file.contains("\\")));
    }

    @Test
    void statusContractDoesNotExposeAbsoluteLogDirectory() throws Exception {
        String serviceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/LogManagementService.java"), StandardCharsets.UTF_8);
        String responseSource = Files.readString(Path.of("src/main/java/com/example/shop/dto/LogManagementStatusResponse.java"), StandardCharsets.UTF_8);

        assertFalse(serviceSource.contains("setLogDirectory(logFile.getParent().toAbsolutePath()"));
        assertTrue(responseSource.contains("@JsonInclude(JsonInclude.Include.NON_NULL)\n    private String logDirectory;"));
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
    void previewAndDownloadMaskSensitiveLogValues() throws Exception {
        Files.writeString(tempDir.resolve("shop-backend.log"),
                "2026-05-24 10:00:00.000 ERROR [requestId:s] password=secret123 token=Bearer abcdef1234567890\n"
                        + "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturevalue\n",
                StandardCharsets.UTF_8);
        LocalDateTime start = LocalDateTime.of(2026, 5, 24, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 5, 24, 10, 30);

        LogPreviewResponse preview = service.preview(start, end, "password", null, 10);
        String previewBody = String.join("\n", preview.getLines());
        String downloadBody = new String(service.download(start, end, "password", null), StandardCharsets.UTF_8);

        assertTrue(previewBody.contains("password=******"));
        assertTrue(previewBody.contains("token=Bearer ******"));
        assertTrue(previewBody.contains("Authorization: Bearer ******"));
        assertTrue(downloadBody.contains("password=******"));
        assertTrue(downloadBody.contains("token=Bearer ******"));
        assertTrue(downloadBody.contains("Authorization: Bearer ******"));
        assertTrue(!previewBody.contains("secret123"));
        assertTrue(!downloadBody.contains("abcdef1234567890"));
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
