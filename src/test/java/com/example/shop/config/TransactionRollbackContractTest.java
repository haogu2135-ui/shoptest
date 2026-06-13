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

class TransactionRollbackContractTest {
    private static final Pattern TRANSACTIONAL_PATTERN = Pattern.compile("@Transactional(?:\\s*\\((.*?)\\))?", Pattern.DOTALL);
    private static final Path SERVICE_SOURCE_ROOT = Path.of("src/main/java/com/example/shop/service");

    @Test
    void serviceTransactionsRollbackForCheckedExceptions() throws IOException {
        List<String> offenders = new ArrayList<>();
        if (Files.exists(SERVICE_SOURCE_ROOT)) {
            try (Stream<Path> paths = Files.walk(SERVICE_SOURCE_ROOT)) {
                paths.filter(Files::isRegularFile)
                        .filter(path -> path.getFileName().toString().endsWith(".java"))
                        .forEach(path -> collectTransactionalAnnotationsWithoutRollbackFor(path, offenders));
            }
        }

        assertTrue(offenders.isEmpty(), () -> "Service @Transactional annotations must declare "
                + "rollbackFor = Exception.class so checked exceptions cannot commit partial writes:\n"
                + String.join("\n", offenders));
    }

    private static void collectTransactionalAnnotationsWithoutRollbackFor(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read source file " + path, ex);
        }

        Matcher matcher = TRANSACTIONAL_PATTERN.matcher(stripComments(source));
        while (matcher.find()) {
            String attributes = matcher.group(1);
            if (attributes == null || !attributes.contains("rollbackFor = Exception.class")) {
                offenders.add(path + ":" + lineNumber(source, matcher.start()));
            }
        }
    }

    private static String stripComments(String source) {
        return source
                .replaceAll("(?s)/\\*.*?\\*/", "")
                .replaceAll("(?m)(^|[^:])//.*$", "$1");
    }

    private static long lineNumber(String source, int offset) {
        return source.substring(0, offset).chars().filter(ch -> ch == '\n').count() + 1;
    }
}
