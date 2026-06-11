package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class EmptyCatchBlockContractTest {
    private static final Pattern CATCH_PATTERN = Pattern.compile("catch(?:\\s*\\([^)]*\\))?\\s*\\{");
    private static final Set<String> SOURCE_EXTENSIONS = Set.of(".java", ".ts", ".tsx", ".js", ".jsx");
    private static final List<Path> SOURCE_ROOTS = List.of(
            Path.of("src/main/java"),
            Path.of("frontend/src"));

    @Test
    void productionSourcesDoNotContainEmptyCatchBlocks() throws IOException {
        List<String> offenders = new ArrayList<>();
        for (Path root : SOURCE_ROOTS) {
            if (!Files.exists(root)) {
                continue;
            }
            try (Stream<Path> paths = Files.walk(root)) {
                paths.filter(Files::isRegularFile)
                        .filter(EmptyCatchBlockContractTest::isSourceFile)
                        .forEach(path -> collectEmptyCatchBlocks(path, offenders));
            }
        }

        assertTrue(offenders.isEmpty(), () -> "Empty or comment-only catch blocks must log, rethrow, "
                + "return an explicit fallback, or otherwise handle the error:\n"
                + String.join("\n", offenders));
    }

    private static boolean isSourceFile(Path path) {
        String fileName = path.getFileName().toString();
        return SOURCE_EXTENSIONS.stream().anyMatch(fileName::endsWith);
    }

    private static void collectEmptyCatchBlocks(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read source file " + path, ex);
        }

        Matcher matcher = CATCH_PATTERN.matcher(source);
        while (matcher.find()) {
            int bodyStart = matcher.end();
            int bodyEnd = findMatchingBrace(source, bodyStart);
            if (bodyEnd < 0) {
                continue;
            }
            String body = source.substring(bodyStart, bodyEnd);
            if (stripComments(body).trim().isEmpty()) {
                offenders.add(path + ":" + lineNumber(source, matcher.start()));
            }
            matcher.region(bodyEnd + 1, source.length());
        }
    }

    private static int findMatchingBrace(String source, int bodyStart) {
        int depth = 1;
        Character stringQuote = null;
        boolean escaped = false;
        boolean lineComment = false;
        boolean blockComment = false;
        for (int index = bodyStart; index < source.length(); index++) {
            char current = source.charAt(index);
            char next = index + 1 < source.length() ? source.charAt(index + 1) : '\0';
            if (lineComment) {
                if (current == '\n') {
                    lineComment = false;
                }
                continue;
            }
            if (blockComment) {
                if (current == '*' && next == '/') {
                    blockComment = false;
                    index++;
                }
                continue;
            }
            if (stringQuote != null) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (current == '\\') {
                    escaped = true;
                    continue;
                }
                if (current == stringQuote) {
                    stringQuote = null;
                }
                continue;
            }
            if (current == '/' && next == '/') {
                lineComment = true;
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                blockComment = true;
                index++;
                continue;
            }
            if (current == '"' || current == '\'' || current == '`') {
                stringQuote = current;
                continue;
            }
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return index;
                }
            }
        }
        return -1;
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
