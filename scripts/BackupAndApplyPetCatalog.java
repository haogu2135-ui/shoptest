import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class BackupAndApplyPetCatalog {
    private static final String URL = envOrDefault(
            "DB_URL",
            "jdbc:mysql://localhost:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true");
    private static final String USER = envOrDefault("DB_USERNAME", "root");
    private static final String PASSWORD = envOrDefault("DB_PASSWORD", "");

    public static void main(String[] args) throws Exception {
        Path backupDir = Path.of("backups");
        Files.createDirectories(backupDir);
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now());
        Path backupFile = backupDir.resolve("product_category_backup_" + stamp + ".sql");

        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {
            backupTable(connection, "categories", backupFile, false);
            backupTable(connection, "products", backupFile, true);
            applySql(connection, Path.of("scripts", "pet_catalog_test_data.sql"));
            printCounts(connection, backupFile);
        }
    }

    private static void backupTable(Connection connection, String table, Path backupFile, boolean append) throws Exception {
        List<String> lines = new ArrayList<>();
        if (!append) {
            lines.add("-- Product/category backup before pet catalog reset");
            lines.add("-- Restore order: categories first, then products");
            lines.add("SET FOREIGN_KEY_CHECKS = 0;");
        }
        lines.add("");
        lines.add("-- " + table);
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT * FROM " + table + " ORDER BY id")) {
            ResultSetMetaData meta = resultSet.getMetaData();
            int columnCount = meta.getColumnCount();
            while (resultSet.next()) {
                StringBuilder sql = new StringBuilder("INSERT INTO ").append(table).append(" (");
                for (int i = 1; i <= columnCount; i++) {
                    if (i > 1) sql.append(", ");
                    sql.append(meta.getColumnName(i));
                }
                sql.append(") VALUES (");
                for (int i = 1; i <= columnCount; i++) {
                    if (i > 1) sql.append(", ");
                    sql.append(toSqlLiteral(resultSet.getObject(i)));
                }
                sql.append(");");
                lines.add(sql.toString());
            }
        }
        if (append) {
            lines.add("");
            lines.add("SET FOREIGN_KEY_CHECKS = 1;");
        }
        if (append) {
            Files.write(backupFile, lines, StandardCharsets.UTF_8, java.nio.file.StandardOpenOption.APPEND);
        } else {
            Files.write(backupFile, lines, StandardCharsets.UTF_8);
        }
    }

    private static String toSqlLiteral(Object value) {
        if (value == null) return "NULL";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Timestamp) return "'" + value.toString().replace(".0", "") + "'";
        if (value instanceof java.sql.Date) return "'" + value + "'";
        if (value instanceof BigDecimal) return value.toString();
        return "'" + value.toString().replace("\\", "\\\\").replace("'", "''") + "'";
    }

    private static void applySql(Connection connection, Path sqlFile) throws Exception {
        String sql = Files.readString(sqlFile, StandardCharsets.UTF_8);
        for (String statementSql : splitStatements(sql)) {
            String trimmed = statementSql.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("--")) continue;
            try (Statement statement = connection.createStatement()) {
                statement.execute(trimmed);
            }
        }
    }

    private static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inString = false;
        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            current.append(c);
            if (c == '\'' && (i == 0 || sql.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (c == ';' && !inString) {
                statements.add(current.toString());
                current.setLength(0);
            }
        }
        if (current.length() > 0) statements.add(current.toString());
        return statements;
    }

    private static void printCounts(Connection connection, Path backupFile) throws SQLException {
        System.out.println("Backup: " + backupFile.toAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            try (ResultSet categories = statement.executeQuery("SELECT COUNT(*) FROM categories")) {
                categories.next();
                System.out.println("Categories: " + categories.getLong(1));
            }
            try (ResultSet products = statement.executeQuery("SELECT COUNT(*) FROM products")) {
                products.next();
                System.out.println("Products: " + products.getLong(1));
            }
        }
    }

    private static String envOrDefault(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
