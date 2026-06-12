package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class DependencyArchiveExposureContractTest {
    private static final List<String> DISALLOWED_POM_MARKERS = List.of(
            "<groupId>org.codehaus.janino</groupId>",
            "<artifactId>janino</artifactId>",
            "<artifactId>commons-compiler</artifactId>",
            "<artifactId>commons-compress</artifactId>",
            "<artifactId>junrar</artifactId>",
            "<artifactId>zip4j</artifactId>",
            "<artifactId>sevenzipjbinding</artifactId>",
            "<artifactId>unrar</artifactId>"
    );

    private static final List<String> DISALLOWED_SOURCE_MARKERS = List.of(
            "org.apache.commons.compress",
            "com.github.junrar",
            "net.lingala.zip4j",
            "net.sf.sevenzipjbinding",
            "archiveinputstream",
            "rararchive",
            "sevenzip",
            "ziparchiveinputstream"
    );

    @Test
    void buildDoesNotDeclareJaninoOrArchiveParserDependencies() throws Exception {
        List<String> violations = new ArrayList<>();

        for (Path pom : listPomFiles()) {
            String normalized = Files.readString(pom, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            for (String marker : DISALLOWED_POM_MARKERS) {
                if (normalized.contains(marker.toLowerCase(Locale.ROOT))) {
                    violations.add(pom + " declares " + marker);
                }
            }
        }

        assertTrue(violations.isEmpty(), () -> String.join(System.lineSeparator(), violations));
    }

    @Test
    void productionSourceDoesNotAcceptOrParseArchivePayloads() throws Exception {
        List<String> violations = new ArrayList<>();

        for (Path source : listProductionJavaFiles()) {
            String normalized = Files.readString(source, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            for (String marker : DISALLOWED_SOURCE_MARKERS) {
                if (normalized.contains(marker)) {
                    violations.add(source + " contains archive parser marker " + marker);
                }
            }
        }

        assertTrue(violations.isEmpty(), () -> String.join(System.lineSeparator(), violations));
    }

    private static List<Path> listPomFiles() throws IOException {
        try (Stream<Path> paths = Files.walk(Path.of("."), 4)) {
            return paths
                    .filter(path -> path.getFileName().toString().equals("pom.xml"))
                    .filter(DependencyArchiveExposureContractTest::isNotGeneratedPath)
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    private static List<Path> listProductionJavaFiles() throws IOException {
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".java"))
                    .filter(DependencyArchiveExposureContractTest::isNotGeneratedPath)
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    private static boolean isNotGeneratedPath(Path path) {
        String value = path.toString().replace('\\', '/');
        return !value.contains("/target/")
                && !value.contains("/frontend/node_modules/")
                && !value.contains("/.git/");
    }
}
