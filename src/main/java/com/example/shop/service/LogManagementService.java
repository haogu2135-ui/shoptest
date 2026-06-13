package com.example.shop.service;

import com.example.shop.dto.LogManagementStatusResponse;
import com.example.shop.dto.LogPreviewResponse;
import com.example.shop.util.SensitiveDataMasker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.annotation.PreDestroy;

@Service
public class LogManagementService {
    private static final Logger log = LoggerFactory.getLogger(LogManagementService.class);
    private static final String DEFAULT_LOGGER = "com.example.shop";
    private static final String DEFAULT_ALLOWED_LOGGERS = "com.example.shop";
    private static final String DEFAULT_ADDITIONAL_DEBUG_LOGGERS = "";
    private static final String DEFAULT_LOG_FILE = "logs/shop-backend.log";
    private static final int DEFAULT_MAX_RANGE_HOURS = 24;
    private static final int DEFAULT_PREVIEW_MAX_LINES = 1000;
    private static final int DEFAULT_MAX_DOWNLOAD_BYTES = 1024 * 1024;
    private static final int DEFAULT_DEBUG_AUTO_RESTORE_MINUTES = 15;
    private static final DateTimeFormatter LOG_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    private final LoggingSystem loggingSystem;
    private final Environment environment;
    private final ScheduledExecutorService debugRestoreScheduler;
    private final boolean ownsDebugRestoreScheduler;
    private final AtomicReference<ScheduledFuture<?>> debugRestoreTask = new AtomicReference<>();

    public LogManagementService(LoggingSystem loggingSystem, Environment environment) {
        this(loggingSystem, environment, Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "shop-log-debug-restore");
            thread.setDaemon(true);
            return thread;
        }), true);
    }

    LogManagementService(LoggingSystem loggingSystem, Environment environment, ScheduledExecutorService debugRestoreScheduler) {
        this(loggingSystem, environment, debugRestoreScheduler, false);
    }

    private LogManagementService(LoggingSystem loggingSystem,
                                 Environment environment,
                                 ScheduledExecutorService debugRestoreScheduler,
                                 boolean ownsDebugRestoreScheduler) {
        this.loggingSystem = loggingSystem;
        this.environment = environment;
        this.debugRestoreScheduler = debugRestoreScheduler;
        this.ownsDebugRestoreScheduler = ownsDebugRestoreScheduler;
    }

    public LogManagementStatusResponse status(String loggerName) {
        String resolvedLogger = resolveLoggerName(loggerName);
        LoggerConfiguration configuration = loggingSystem.getLoggerConfiguration(resolvedLogger);
        Path logFile = resolveLogFile();
        LogManagementStatusResponse response = new LogManagementStatusResponse();
        response.setLoggerName(resolvedLogger);
        response.setConfiguredLevel(configuration == null || configuration.getConfiguredLevel() == null ? "INHERITED" : configuration.getConfiguredLevel().name());
        response.setEffectiveLevel(configuration == null || configuration.getEffectiveLevel() == null ? "UNKNOWN" : configuration.getEffectiveLevel().name());
        response.setDebugEnabled(configuration != null && LogLevel.DEBUG.equals(configuration.getEffectiveLevel()));
        response.setLogDirectory(logFile.getParent().toAbsolutePath().normalize().toString());
        response.setLogFileName(logFile.getFileName().toString());
        response.setAvailableFiles(listLogFiles(logFile.getParent()));
        response.setTotalLogBytes(listLogFilePaths(logFile.getParent()).stream().mapToLong(this::fileSize).sum());
        response.setAllowedLoggerPrefixes(new ArrayList<>(allowedLoggerPrefixes()));
        response.setMaxRangeHours(maxRangeHours());
        response.setMaxPreviewLines(maxPreviewLines());
        response.setMaxDownloadBytes(maxDownloadBytes());
        return response;
    }

    public LogManagementStatusResponse setDebug(boolean enabled, String loggerName) {
        String resolvedLogger = resolveLoggerName(loggerName);
        Set<String> additionalLoggers = additionalDebugLoggers(resolvedLogger);
        LogLevel level = enabled ? LogLevel.DEBUG : LogLevel.INFO;
        setLogLevels(resolvedLogger, additionalLoggers, level);
        if (enabled) {
            scheduleDebugRestore(resolvedLogger, additionalLoggers);
        } else {
            cancelDebugRestore();
        }
        log.debug("Runtime debug logging probe: enabled={}, primaryLogger={}, additionalLoggers={}",
                enabled, resolvedLogger, additionalLoggers);
        return status(resolvedLogger);
    }

    public boolean isApplicationLogger(String loggerName) {
        String resolvedLogger = resolveLoggerName(loggerName);
        return DEFAULT_LOGGER.equals(resolvedLogger) || resolvedLogger.startsWith(DEFAULT_LOGGER + ".");
    }

    @PreDestroy
    public void shutdownDebugRestoreScheduler() {
        cancelDebugRestore();
        if (ownsDebugRestoreScheduler) {
            debugRestoreScheduler.shutdownNow();
        }
    }

    public byte[] download(LocalDateTime start, LocalDateTime end) {
        return download(start, end, null, null);
    }

    public byte[] download(LocalDateTime start, LocalDateTime end, String keyword, String level) {
        validateRange(start, end);
        List<Path> candidates = logCandidates();
        if (candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No log files found");
        }
        try {
            DownloadAccumulator output = new DownloadAccumulator(maxDownloadBytes());
            String normalizedKeyword = normalizeKeyword(keyword);
            String normalizedLevel = normalizeLogLevel(level);
            for (Path candidate : candidates) {
                appendMatchingLines(candidate, start, end, normalizedKeyword, normalizedLevel, output);
                if (output.isTruncated()) {
                    break;
                }
            }
            if (output.size() == 0) {
                output.addLine("# No logs found from " + start + " to " + end);
            }
            if (output.isTruncated()) {
                output.addMarker("# Log download truncated at " + output.maxBytes() + " bytes");
            }
            return output.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read log files");
        }
    }

    public LogPreviewResponse preview(LocalDateTime start, LocalDateTime end, String keyword, String level, int limit) {
        validateRange(start, end);
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, maxPreviewLines()));
        List<Path> candidates = logCandidates();
        if (candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No log files found");
        }
        String normalizedKeyword = normalizeKeyword(keyword);
        String normalizedLevel = normalizeLogLevel(level);
        PreviewAccumulator accumulator = new PreviewAccumulator(safeLimit);
        try {
            for (Path candidate : candidates) {
                collectMatchingLines(candidate, start, end, normalizedKeyword, normalizedLevel, accumulator);
                if (accumulator.isTruncated()) {
                    break;
                }
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read log files");
        }

        LogPreviewResponse response = new LogPreviewResponse();
        response.setStart(start.toString());
        response.setEnd(end.toString());
        response.setKeyword(normalizedKeyword == null ? "" : normalizedKeyword);
        response.setLevel(normalizedLevel == null ? "ALL" : normalizedLevel);
        response.setLimit(safeLimit);
        response.setMatchedLines(accumulator.getMatchedLines());
        response.setTruncated(accumulator.isTruncated());
        response.setLines(accumulator.getLines());
        return response;
    }

    public static LocalDateTime parseClientDateTime(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return OffsetDateTime.parse(trimmed).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            return LocalDateTime.parse(trimmed, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
    }

    private void appendMatchingLines(Path file, LocalDateTime start, LocalDateTime end, String keyword, String level, DownloadAccumulator output) throws IOException {
        boolean includeContinuation = false;
        boolean includeCurrentEvent = false;
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                LocalDateTime timestamp = parseLogTimestamp(line);
                if (timestamp != null) {
                    includeContinuation = !timestamp.isBefore(start) && !timestamp.isAfter(end);
                    includeCurrentEvent = includeContinuation && matchesFilters(line, keyword, level);
                }
                if (includeContinuation && includeCurrentEvent) {
                    output.addLine(maskLogLine(line));
                    if (output.isTruncated()) {
                        return;
                    }
                }
            }
        }
    }

    private void collectMatchingLines(Path file, LocalDateTime start, LocalDateTime end, String keyword, String level, PreviewAccumulator accumulator) throws IOException {
        boolean includeContinuation = false;
        boolean includeCurrentEvent = false;
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                LocalDateTime timestamp = parseLogTimestamp(line);
                if (timestamp != null) {
                    includeContinuation = !timestamp.isBefore(start) && !timestamp.isAfter(end);
                    includeCurrentEvent = includeContinuation && matchesFilters(line, keyword, level);
                }
                if (includeContinuation && includeCurrentEvent) {
                    accumulator.add(maskLogLine(line));
                    if (accumulator.isTruncated()) {
                        return;
                    }
                }
            }
        }
    }

    private boolean matchesFilters(String line, String keyword, String level) {
        String normalizedLine = line == null ? "" : line;
        if (keyword != null && !normalizedLine.toLowerCase(Locale.ROOT).contains(keyword)) {
            return false;
        }
        return level == null || normalizedLine.contains(" " + level + " ") || normalizedLine.contains(level + " [");
    }

    private String maskLogLine(String line) {
        return SensitiveDataMasker.mask(line);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return null;
        }
        String normalized = keyword.replaceAll("[\\p{Cntrl}]+", " ").replaceAll("\\s+", " ").trim();
        if (normalized.length() > 120) {
            normalized = normalized.substring(0, 120);
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private String normalizeLogLevel(String level) {
        if (level == null || level.trim().isEmpty() || "ALL".equalsIgnoreCase(level.trim())) {
            return null;
        }
        String normalized = level.trim().toUpperCase(Locale.ROOT);
        return List.of("TRACE", "DEBUG", "INFO", "WARN", "ERROR").contains(normalized) ? normalized : null;
    }

    private LocalDateTime parseLogTimestamp(String line) {
        if (line == null || line.length() < 23) {
            return null;
        }
        try {
            return LocalDateTime.parse(line.substring(0, 23), LOG_TIMESTAMP);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String resolveLoggerName(String loggerName) {
        if (loggerName == null || loggerName.trim().isEmpty()) {
            return DEFAULT_LOGGER;
        }
        String normalized = loggerName.trim();
        if ("root".equalsIgnoreCase(normalized)) {
            normalized = LoggingSystem.ROOT_LOGGER_NAME;
        }
        if (!normalized.matches("[A-Za-z0-9_.\\-$]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid logger name");
        }
        if (!isAllowedLogger(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Logger is not allowed");
        }
        return normalized;
    }

    private Path resolveLogFile() {
        String configuredName = stringProperty("logging.file.name", DEFAULT_LOG_FILE);
        Path configuredPath = Paths.get(configuredName);
        if (!configuredPath.isAbsolute()) {
            configuredPath = Paths.get(System.getProperty("user.dir", ".")).resolve(configuredPath);
        }
        return configuredPath.toAbsolutePath().normalize();
    }

    private List<String> listLogFiles(Path directory) {
        return listLogFilePaths(directory).stream()
                .map(path -> path.getFileName().toString())
                .collect(Collectors.toList());
    }

    private List<Path> listLogFilePaths(Path directory) {
        if (directory == null || !Files.isDirectory(directory)) {
            return List.of();
        }
        try (Stream<Path> paths = Files.list(directory)) {
            return paths
                .filter(Files::isRegularFile)
                .filter(path -> {
                    try {
                        return Files.isRegularFile(path, java.nio.file.LinkOption.NOFOLLOW_LINKS)
                                && path.toRealPath(java.nio.file.LinkOption.NOFOLLOW_LINKS)
                                        .getParent()
                                        .equals(directory.toRealPath(java.nio.file.LinkOption.NOFOLLOW_LINKS));
                    } catch (IOException e) {
                        return false;
                    }
                })
                .filter(path -> {
                    String filename = path.getFileName().toString().toLowerCase(Locale.ROOT);
                    return filename.contains(".log") && !filename.endsWith(".gz");
                    })
                    .sorted(Comparator.comparing(this::lastModifiedTime))
                    .collect(Collectors.toList());
        } catch (IOException e) {
            return List.of();
        }
    }

    private List<Path> logCandidates() {
        Path logFile = resolveLogFile();
        return listLogFilePaths(logFile.getParent());
    }

    private void validateRange(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid log time range");
        }
        if (Duration.between(start, end).compareTo(Duration.ofHours(maxRangeHours())) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Log time range is too large");
        }
    }

    private boolean isAllowedLogger(String loggerName) {
        return allowedLoggerPrefixes().stream().anyMatch(prefix ->
                LoggingSystem.ROOT_LOGGER_NAME.equals(prefix)
                        ? LoggingSystem.ROOT_LOGGER_NAME.equals(loggerName)
                        : loggerName.equals(prefix) || loggerName.startsWith(prefix + "."));
    }

    private void setLogLevels(String primaryLogger, Set<String> additionalLoggers, LogLevel level) {
        loggingSystem.setLogLevel(primaryLogger, level);
        additionalLoggers.forEach(name -> loggingSystem.setLogLevel(name, level));
    }

    private void scheduleDebugRestore(String primaryLogger, Set<String> additionalLoggers) {
        AtomicReference<ScheduledFuture<?>> current = new AtomicReference<>();
        Runnable restore = () -> {
            try {
                setLogLevels(primaryLogger, additionalLoggers, LogLevel.INFO);
                log.debug("Runtime debug logging auto-restored: primaryLogger={}, additionalLoggers={}",
                        primaryLogger, additionalLoggers);
            } finally {
                debugRestoreTask.compareAndSet(current.get(), null);
            }
        };
        ScheduledFuture<?> future = debugRestoreScheduler.schedule(
                restore,
                debugAutoRestoreMinutes(),
                TimeUnit.MINUTES);
        current.set(future);
        ScheduledFuture<?> previous = debugRestoreTask.getAndSet(future);
        if (previous != null) {
            previous.cancel(false);
        }
    }

    private void cancelDebugRestore() {
        ScheduledFuture<?> previous = debugRestoreTask.getAndSet(null);
        if (previous != null) {
            previous.cancel(false);
        }
    }

    private Set<String> allowedLoggerPrefixes() {
        String configured = stringProperty("admin.logs.allowed-logger-prefixes", DEFAULT_ALLOWED_LOGGERS);
        Set<String> prefixes = Arrays.stream(configured.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .map(item -> "root".equalsIgnoreCase(item) ? LoggingSystem.ROOT_LOGGER_NAME : item)
                .filter(item -> item.matches("[A-Za-z0-9_.\\-$]+"))
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        return prefixes.isEmpty() ? Set.of(DEFAULT_LOGGER) : prefixes;
    }

    private Set<String> additionalDebugLoggers(String primaryLogger) {
        String configured = stringProperty("admin.logs.additional-debug-loggers", DEFAULT_ADDITIONAL_DEBUG_LOGGERS);
        return Arrays.stream(configured.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .map(item -> "root".equalsIgnoreCase(item) ? LoggingSystem.ROOT_LOGGER_NAME : item)
                .filter(item -> item.matches("[A-Za-z0-9_.\\-$]+"))
                .filter(this::isAllowedLogger)
                .filter(item -> !item.equals(primaryLogger))
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private int maxRangeHours() {
        return intProperty("admin.logs.max-range-hours", DEFAULT_MAX_RANGE_HOURS, 1, 168);
    }

    private int maxPreviewLines() {
        return intProperty("admin.logs.preview-max-lines", DEFAULT_PREVIEW_MAX_LINES, 1, 5000);
    }

    private int maxDownloadBytes() {
        return intProperty("admin.logs.max-download-bytes", DEFAULT_MAX_DOWNLOAD_BYTES, 1024, 20 * 1024 * 1024);
    }

    private int debugAutoRestoreMinutes() {
        return intProperty("admin.logs.debug-auto-restore-minutes", DEFAULT_DEBUG_AUTO_RESTORE_MINUTES, 1, 60);
    }

    private String stringProperty(String key, String defaultValue) {
        String value = environment.getProperty(key);
        return value == null || value.trim().isEmpty() ? defaultValue : value.trim();
    }

    private int intProperty(String key, int defaultValue, int min, int max) {
        String value = environment.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        try {
            return Math.max(min, Math.min(max, Integer.parseInt(value.trim())));
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private long lastModifiedTime(Path path) {
        try {
            return Files.getLastModifiedTime(path).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }

    private long fileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException e) {
            return 0L;
        }
    }

    private static class PreviewAccumulator {
        private final int limit;
        private final List<String> lines = new ArrayList<>();
        private int matchedLines;
        private boolean truncated;

        private PreviewAccumulator(int limit) {
            this.limit = limit;
        }

        private void add(String line) {
            matchedLines++;
            if (lines.size() < limit) {
                lines.add(line);
                return;
            }
            truncated = true;
        }

        private int getMatchedLines() {
            return matchedLines;
        }

        private boolean isTruncated() {
            return truncated;
        }

        private List<String> getLines() {
            return lines;
        }
    }

    private static class DownloadAccumulator {
        private final int maxBytes;
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private boolean truncated;

        private DownloadAccumulator(int maxBytes) {
            this.maxBytes = maxBytes;
        }

        private void addLine(String line) {
            if (truncated) {
                return;
            }
            byte[] bytes = (line + System.lineSeparator()).getBytes(StandardCharsets.UTF_8);
            if (output.size() + bytes.length > maxBytes) {
                truncated = true;
                return;
            }
            output.write(bytes, 0, bytes.length);
        }

        private void addMarker(String line) {
            byte[] bytes = (line + System.lineSeparator()).getBytes(StandardCharsets.UTF_8);
            output.write(bytes, 0, bytes.length);
        }

        private int size() {
            return output.size();
        }

        private int maxBytes() {
            return maxBytes;
        }

        private boolean isTruncated() {
            return truncated;
        }

        private byte[] toByteArray() {
            return output.toByteArray();
        }
    }
}
