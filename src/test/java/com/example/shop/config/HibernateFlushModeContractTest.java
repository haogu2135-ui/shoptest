package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
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

class HibernateFlushModeContractTest {
    private static final List<Path> PRODUCTION_CONFIG_ROOTS = List.of(
            Path.of("src/main/resources"),
            Path.of("deploy"));
    private static final Pattern ALWAYS_FLUSH_MODE = Pattern.compile(
            "(?i)(spring\\.jpa\\.properties\\.hibernate[._-]flush[._-]?mode|"
                    + "hibernate[._-]?flush[._-]?mode|flush[._-]?mode)\\s*[:=]\\s*['\"]?always['\"]?");
    private static final Pattern BASE_APPLICATION_FLUSH_MODE = Pattern.compile(
            "(?im)^\\s*spring\\.jpa\\.properties\\.hibernate[._-]flush[._-]?mode\\s*[:=]");

    @Test
    void productionConfigurationDoesNotForceHibernateAlwaysFlush() throws IOException {
        List<String> offenders = new ArrayList<>();
        for (Path root : PRODUCTION_CONFIG_ROOTS) {
            collectAlwaysFlushMode(root, offenders);
        }

        assertTrue(offenders.isEmpty(), () -> "Production configuration must not force Hibernate flush_mode=always:\n"
                + String.join("\n", offenders));
    }

    @Test
    void baseApplicationPropertiesReliesOnHibernateDefaultFlushMode() throws IOException {
        String applicationProperties = Files.readString(
                Path.of("src/main/resources/application.properties"),
                StandardCharsets.UTF_8);

        assertFalse(BASE_APPLICATION_FLUSH_MODE.matcher(applicationProperties).find(),
                "Base application.properties should rely on Hibernate's default AUTO flush mode");
    }

    private static void collectAlwaysFlushMode(Path root, List<String> offenders) throws IOException {
        if (!Files.exists(root)) {
            return;
        }

        try (Stream<Path> paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile)
                    .filter(HibernateFlushModeContractTest::isConfigFile)
                    .forEach(path -> collectAlwaysFlushModeInFile(path, offenders));
        }
    }

    private static boolean isConfigFile(Path path) {
        String fileName = path.getFileName().toString();
        return fileName.endsWith(".properties")
                || fileName.endsWith(".yml")
                || fileName.endsWith(".yaml")
                || fileName.endsWith(".env")
                || fileName.endsWith(".example");
    }

    private static void collectAlwaysFlushModeInFile(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production configuration " + path, ex);
        }

        String[] lines = source.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            String line = uncomment(lines[index]).trim();
            if (ALWAYS_FLUSH_MODE.matcher(line).find()) {
                offenders.add(path + ":" + (index + 1) + ": " + line);
            }
        }
    }

    private static String uncomment(String line) {
        String trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
            return "";
        }
        int inlineComment = line.indexOf('#');
        return inlineComment >= 0 ? line.substring(0, inlineComment) : line;
    }
}
