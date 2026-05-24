package com.example.shop.service;

import com.example.shop.dto.LogManagementStatusResponse;
import com.example.shop.dto.LogPreviewResponse;
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
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LogManagementService {
    private static final String DEFAULT_LOGGER = "com.example.shop";
    private static final String DEFAULT_LOG_FILE = "logs/shop-backend.log";
    private static final DateTimeFormatter LOG_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    private final LoggingSystem loggingSystem;
    private final Environment environment;

    public LogManagementService(LoggingSystem loggingSystem, Environment environment) {
        this.loggingSystem = loggingSystem;
        this.environment = environment;
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
        return response;
    }

    public LogManagementStatusResponse setDebug(boolean enabled, String loggerName) {
        String resolvedLogger = resolveLoggerName(loggerName);
        loggingSystem.setLogLevel(resolvedLogger, enabled ? LogLevel.DEBUG : LogLevel.INFO);
        return status(resolvedLogger);
    }

    public byte[] download(LocalDateTime start, LocalDateTime end) {
        return download(start, end, null, null);
    }

    public byte[] download(LocalDateTime start, LocalDateTime end, String keyword, String level) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid log time range");
        }
        List<Path> candidates = logCandidates();
        if (candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No log files found");
        }
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            String normalizedKeyword = normalizeKeyword(keyword);
            String normalizedLevel = normalizeLogLevel(level);
            for (Path candidate : candidates) {
                appendMatchingLines(candidate, start, end, normalizedKeyword, normalizedLevel, output);
            }
            if (output.size() == 0) {
                output.write(("# No logs found from " + start + " to " + end + System.lineSeparator()).getBytes(StandardCharsets.UTF_8));
            }
            return output.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read log files");
        }
    }

    public LogPreviewResponse preview(LocalDateTime start, LocalDateTime end, String keyword, String level, int limit) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid log time range");
        }
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 200 : limit, 1000));
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
        response.setKeyword(keyword == null ? "" : keyword.trim());
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

    private void appendMatchingLines(Path file, LocalDateTime start, LocalDateTime end, String keyword, String level, ByteArrayOutputStream output) throws IOException {
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
                    output.write(line.getBytes(StandardCharsets.UTF_8));
                    output.write(System.lineSeparator().getBytes(StandardCharsets.UTF_8));
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
                    accumulator.add(line);
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

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
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
            return LoggingSystem.ROOT_LOGGER_NAME;
        }
        return normalized;
    }

    private Path resolveLogFile() {
        String configuredName = environment.getProperty("logging.file.name", DEFAULT_LOG_FILE);
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
}
