package scripts;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ImportMysqlData {
    private static final Path ROOT = Path.of("").toAbsolutePath();
    private static final Pattern PROPERTY_EXPR = Pattern.compile("\\$\\{([^:}]+)(?::([^}]*))?}");

    public static void main(String[] args) throws Exception {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(ROOT.resolve("src/main/resources/application.properties"), StandardCharsets.UTF_8)) {
            properties.load(reader);
        }

        String configuredUrl = resolveProperty(properties.getProperty("spring.datasource.url"));
        String username = resolveProperty(properties.getProperty("spring.datasource.username"));
        String password = resolveProperty(properties.getProperty("spring.datasource.password"));
        String database = extractDatabaseName(configuredUrl);
        String serverUrl = buildServerUrl(configuredUrl);
        List<Path> sqlFiles = sqlFiles(args);

        Class.forName("com.mysql.cj.jdbc.Driver");
        System.out.println("Connecting to " + maskCredentials(configuredUrl) + " as " + username + ".");
        try (Connection serverConnection = DriverManager.getConnection(serverUrl, username, password);
             Statement statement = serverConnection.createStatement()) {
            statement.execute("CREATE DATABASE IF NOT EXISTS `" + database + "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        try (Connection connection = DriverManager.getConnection(configuredUrl, username, password)) {
            for (Path sqlFile : sqlFiles) {
                runSqlFile(connection, sqlFile);
            }
        }

        System.out.println("Imported schema and sample data into database `" + database + "`.");
    }

    private static String resolveProperty(String value) {
        if (value == null) return "";
        Matcher matcher = PROPERTY_EXPR.matcher(value);
        StringBuffer resolved = new StringBuffer();
        while (matcher.find()) {
            String envValue = System.getenv(matcher.group(1));
            String fallback = matcher.group(2) == null ? "" : matcher.group(2);
            matcher.appendReplacement(resolved, Matcher.quoteReplacement(envValue == null || envValue.isBlank() ? fallback : envValue));
        }
        matcher.appendTail(resolved);
        return resolved.toString();
    }

    private static List<Path> sqlFiles(String[] args) {
        if (args.length > 0) {
            return Arrays.stream(args)
                .map((arg) -> ROOT.resolve(arg).normalize())
                .toList();
        }
        return List.of(
            ROOT.resolve("src/main/resources/schema.sql"),
            ROOT.resolve("scripts/pet_catalog_test_data.sql"),
            ROOT.resolve("scripts/bundle_product_samples.sql")
        );
    }

    private static String maskCredentials(String jdbcUrl) {
        return jdbcUrl.replaceAll("(?i)(password=)[^&]+", "$1****");
    }

    private static String extractDatabaseName(String jdbcUrl) {
        Matcher matcher = Pattern.compile("jdbc:mysql://[^/]+/([^?]+)").matcher(jdbcUrl);
        if (!matcher.find()) {
            throw new IllegalArgumentException("Cannot find database name in URL: " + jdbcUrl);
        }
        return matcher.group(1);
    }

    private static String buildServerUrl(String jdbcUrl) {
        Matcher matcher = Pattern.compile("(jdbc:mysql://[^/]+)/[^?]+(\\?(.*))?").matcher(jdbcUrl);
        if (!matcher.find()) {
            throw new IllegalArgumentException("Cannot build server URL from: " + jdbcUrl);
        }
        String query = matcher.group(3);
        return matcher.group(1) + "/?createDatabaseIfNotExist=true" + (query == null || query.isBlank() ? "" : "&" + query);
    }

    private static void runSqlFile(Connection connection, Path file) throws IOException, SQLException {
        String sql = Files.readString(file, StandardCharsets.UTF_8);
        if (!sql.isEmpty() && sql.charAt(0) == '\uFEFF') {
            sql = sql.substring(1);
        }
        List<String> statements = splitStatements(sql);
        try (Statement statement = connection.createStatement()) {
            for (String entry : statements) {
                String trimmed = entry.trim();
                if (!trimmed.isEmpty()) {
                    try {
                        statement.execute(trimmed);
                    } catch (SQLException error) {
                        if (isBenignSchemaError(error)) {
                            System.out.println("Skipped idempotent schema statement: " + error.getMessage());
                        } else {
                            throw error;
                        }
                    }
                }
            }
        }
        System.out.println("Executed " + statements.size() + " statements from " + ROOT.relativize(file));
    }

    private static boolean isBenignSchemaError(SQLException error) {
        int code = error.getErrorCode();
        return code == 1050 || code == 1060 || code == 1061 || code == 1091;
    }

    private static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;

        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';

            if (inLineComment) {
                current.append(c);
                if (c == '\n') inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                current.append(c);
                if (c == '*' && next == '/') {
                    current.append(next);
                    i++;
                    inBlockComment = false;
                }
                continue;
            }
            if (!inSingleQuote && !inDoubleQuote && c == '-' && next == '-') {
                inLineComment = true;
                current.append(c);
                continue;
            }
            if (!inSingleQuote && !inDoubleQuote && c == '/' && next == '*') {
                inBlockComment = true;
                current.append(c);
                continue;
            }
            if (c == '\'' && !inDoubleQuote && !isEscaped(sql, i)) {
                inSingleQuote = !inSingleQuote;
            } else if (c == '"' && !inSingleQuote && !isEscaped(sql, i)) {
                inDoubleQuote = !inDoubleQuote;
            }
            if (c == ';' && !inSingleQuote && !inDoubleQuote) {
                statements.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (current.toString().trim().length() > 0) {
            statements.add(current.toString());
        }
        return statements;
    }

    private static boolean isEscaped(String sql, int index) {
        int slashCount = 0;
        for (int i = index - 1; i >= 0 && sql.charAt(i) == '\\'; i--) {
            slashCount++;
        }
        return slashCount % 2 == 1;
    }
}
