package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class ServiceLoggingContractTest {
    private static final Pattern TOP_LEVEL_CLASS_PATTERN =
            Pattern.compile("(?m)^(?:public\\s+)?(?:abstract\\s+)?class\\s+\\w+\\b");
    private static final Pattern LOGGING_PATTERN =
            Pattern.compile("@Slf4j|LoggerFactory\\s*\\.\\s*getLogger\\s*\\(|Logger\\s+\\w+\\s*=");

    @Test
    void trackedConcreteServiceClassesExposeLogger() throws Exception {
        List<String> offenders = new ArrayList<>();
        List<String> paths = new ArrayList<>();
        collectJavaFiles(Path.of("src/main/java/com/example/shop/service"), paths);
        collectJavaFiles(Path.of("src/main/java/com/example/shop/service/impl"), paths);
        for (String path : paths) {
            String source = Files.readString(Path.of(path), StandardCharsets.UTF_8);
            if (TOP_LEVEL_CLASS_PATTERN.matcher(source).find()
                    && !LOGGING_PATTERN.matcher(source).find()) {
                offenders.add(path);
            }
        }

        assertTrue(offenders.isEmpty(), () -> "Tracked concrete service classes must expose a logger:\n"
                + String.join("\n", offenders));
    }

    private static void collectJavaFiles(Path dir, List<String> out) throws IOException {
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(dir)) {
            stream.filter(path -> path.toString().endsWith(".java"))
                    .filter(Files::isRegularFile)
                    .map(path -> path.toString().replace('\\', '/'))
                    .forEach(out::add);
        }
    }
}
