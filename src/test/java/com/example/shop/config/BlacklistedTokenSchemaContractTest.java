package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class BlacklistedTokenSchemaContractTest {
    private static final Pattern BLACKLISTED_TOKEN_TABLE_STATEMENT = Pattern.compile(
            "(?is)(create|alter)\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?`?blacklisted_tokens`?.*?;");
    private static final Pattern PASSWORD_COLUMN = Pattern.compile("(?is)(^|[,\\s])`?password`?\\s+");

    @Test
    void blacklistedTokenSchemaDoesNotUsePasswordColumnForEncryptionKeys() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/resources"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".sql"))
                    .forEach(path -> collectBlacklistedTokenPasswordColumns(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "blacklisted_tokens must not use a password column for encryption keys:\n"
                + String.join("\n", offenders));
    }

    private static void collectBlacklistedTokenPasswordColumns(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read SQL resource " + path, ex);
        }

        Matcher matcher = BLACKLISTED_TOKEN_TABLE_STATEMENT.matcher(source);
        while (matcher.find()) {
            String statement = matcher.group();
            if (PASSWORD_COLUMN.matcher(statement.toLowerCase(Locale.ROOT)).find()) {
                offenders.add(path + ":" + lineNumber(source, matcher.start()));
            }
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
