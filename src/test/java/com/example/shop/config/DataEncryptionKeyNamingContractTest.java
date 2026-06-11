package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class DataEncryptionKeyNamingContractTest {
    private static final Pattern DEPRECATED_DATA_ENCRYPTION_KEY = Pattern.compile(
            "(?<![A-Za-z0-9_.-])data\\.encryption\\.key(?![A-Za-z0-9_.-])");

    @Test
    void backendConfigurationDoesNotUseDeprecatedDataEncryptionKeyName() throws IOException {
        List<String> offenders = new ArrayList<>();
        for (Path root : List.of(Path.of("src/main/resources"), Path.of("src/main/java"))) {
            collectDeprecatedKeyUses(root, offenders);
        }

        assertTrue(offenders.isEmpty(), () -> "Use shop.data.encryption.key instead of data.encryption.key:\n"
                + String.join("\n", offenders));
    }

    private static void collectDeprecatedKeyUses(Path root, List<String> offenders) throws IOException {
        try (Stream<Path> paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile)
                    .filter(DataEncryptionKeyNamingContractTest::isBackendConfigurationOrJavaSource)
                    .forEach(path -> collectMatches(path, offenders));
        }
    }

    private static boolean isBackendConfigurationOrJavaSource(Path path) {
        String fileName = path.getFileName().toString();
        return fileName.endsWith(".properties")
                || fileName.endsWith(".yml")
                || fileName.endsWith(".yaml")
                || fileName.endsWith(".java");
    }

    private static void collectMatches(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read backend source " + path, ex);
        }

        Matcher matcher = DEPRECATED_DATA_ENCRYPTION_KEY.matcher(source);
        while (matcher.find()) {
            offenders.add(path + ":" + lineNumber(source, matcher.start()));
        }
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
