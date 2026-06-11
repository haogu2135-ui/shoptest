package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class RedisKeysUsageContractTest {
    @Test
    void productionRedisCodeDoesNotUseBlockingKeysCommand() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectKeysUsages(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Production Redis code must use SCAN instead of KEYS:\n"
                + String.join("\n", offenders));
    }

    @Test
    void currentRedisPatternEnumerationUsesScanOptions() throws IOException {
        String rateLimitService = read("src/main/java/com/example/shop/service/RateLimitService.java");
        String tokenBlacklistService = read("src/main/java/com/example/shop/service/TokenBlacklistService.java");

        assertTrue(rateLimitService.contains("ScanOptions.scanOptions()"));
        assertTrue(rateLimitService.contains("connection.scan(options)"));
        assertTrue(rateLimitService.contains("traffic.rate-limit.redis-clear-scan-count"));

        assertTrue(tokenBlacklistService.contains("ScanOptions.scanOptions()"));
        assertTrue(tokenBlacklistService.contains("connection.scan(options)"));
        assertTrue(tokenBlacklistService.contains("security.ip-blacklist.redis-scan-count"));
    }

    private static void collectKeysUsages(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }

        int index = source.indexOf(".keys(");
        while (index >= 0) {
            offenders.add(path + ":" + lineNumber(source, index));
            index = source.indexOf(".keys(", index + 1);
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static int lineNumber(String source, int offset) {
        int line = 1;
        for (int index = 0; index < offset && index < source.length(); index++) {
            if (source.charAt(index) == '\n') {
                line++;
            }
        }
        return line;
    }
}
