package com.example.shop.service;

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

class FrontendBroadAnyContractTest {

    private static final Pattern BROAD_ANY = Pattern.compile(
            "(catch\\s*\\([^)]*:\\s*any\\b)"
                    + "|(:\\s*any\\b)"
                    + "|(as\\s+any\\b)"
                    + "|(\\bany\\[\\])"
                    + "|(<any>)"
                    + "|(Promise<any>)"
                    + "|(Record<[^>]*\\bany\\b[^>]*>)"
                    + "|(useRef<any>)"
                    + "|(useState<any>)");

    @Test
    void productionFrontendSourceDoesNotUseBroadAnyTypes() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("frontend/src"))) {
            paths.filter(Files::isRegularFile)
                    .filter(FrontendBroadAnyContractTest::isProductionTypeScript)
                    .forEach(path -> collectBroadAny(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Replace broad frontend any usage with precise or unknown types:\n"
                + String.join("\n", offenders));
    }

    private static boolean isProductionTypeScript(Path path) {
        String fileName = path.getFileName().toString();
        if (!(fileName.endsWith(".ts") || fileName.endsWith(".tsx"))) {
            return false;
        }
        return !fileName.endsWith(".test.ts")
                && !fileName.endsWith(".test.tsx")
                && !fileName.endsWith(".d.ts")
                && !fileName.endsWith("TypeSafety.test.ts")
                && !fileName.endsWith("TypeSafety.test.tsx");
    }

    private static void collectBroadAny(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read frontend source " + path, ex);
        }

        Matcher matcher = BROAD_ANY.matcher(source);
        while (matcher.find()) {
            offenders.add(path + ":" + lineNumber(source, matcher.start()) + ": " + matcher.group());
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
