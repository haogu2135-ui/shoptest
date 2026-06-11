package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

class ServiceLoggingContractTest {
    private static final Pattern TOP_LEVEL_CLASS_PATTERN =
            Pattern.compile("(?m)^(?:public\\s+)?(?:abstract\\s+)?class\\s+\\w+\\b");
    private static final Pattern LOGGING_PATTERN =
            Pattern.compile("@Slf4j|LoggerFactory\\s*\\.\\s*getLogger\\s*\\(|Logger\\s+\\w+\\s*=");

    @Test
    void trackedConcreteServiceClassesExposeLogger() throws Exception {
        List<String> offenders = new ArrayList<>();
        for (String path : gitLines("ls-files",
                "src/main/java/com/example/shop/service",
                "src/main/java/com/example/shop/service/impl")) {
            if (!path.endsWith(".java")) {
                continue;
            }
            String source = gitShowIndex(path);
            if (TOP_LEVEL_CLASS_PATTERN.matcher(source).find()
                    && !LOGGING_PATTERN.matcher(source).find()) {
                offenders.add(path);
            }
        }

        assertTrue(offenders.isEmpty(), () -> "Tracked concrete service classes must expose a logger:\n"
                + String.join("\n", offenders));
    }

    private static List<String> gitLines(String... args) throws IOException, InterruptedException {
        String output = runGit(args);
        if (output.isBlank()) {
            return List.of();
        }
        return output.lines()
                .filter(line -> !line.isBlank())
                .toList();
    }

    private static String gitShowIndex(String path) throws IOException, InterruptedException {
        return runGit("show", ":" + path);
    }

    private static String runGit(String... args) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException("git command failed: " + String.join(" ", command) + "\n" + output);
        }
        return output;
    }
}
