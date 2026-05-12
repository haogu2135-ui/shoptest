import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class RestoreProductCategoryBackup {
    private static final String URL = "jdbc:mysql://localhost:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    private static final String USER = "root";
    private static final String PASSWORD = "84813378";
    private static final List<String> TABLES_TO_BACKUP = Arrays.asList(
        "categories",
        "products",
        "product_questions",
        "reviews",
        "wishlist",
        "cart_items",
        "order_items"
    );
    private static final Pattern INSERT_PATTERN = Pattern.compile(
        "(?is)^\\s*INSERT\\s+INTO\\s+(categories|products)\\s*\\((.*?)\\)\\s+VALUES\\s*\\("
    );

    public static void main(String[] args) throws Exception {
        Path restoreFile = args.length > 0
            ? Path.of(args[0])
            : Path.of("backups", "product_category_backup_20260510_092009.sql");
        if (!Files.exists(restoreFile)) {
            throw new IllegalArgumentException("Backup file not found: " + restoreFile.toAbsolutePath());
        }

        Files.createDirectories(Path.of("backups"));
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now());
        Path safetyBackup = Path.of("backups", "current_before_restore_" + stamp + ".sql");

        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {
            connection.setAutoCommit(false);
            backupCurrentState(connection, safetyBackup);
            Counts before = readCounts(connection);
            applyRestore(connection, restoreFile);
            Counts after = readCounts(connection);
            connection.commit();
            System.out.println("Safety backup: " + safetyBackup.toAbsolutePath());
            System.out.println("Restore source: " + restoreFile.toAbsolutePath());
            System.out.println("Before categories/products: " + before.categories + "/" + before.products);
            System.out.println("After categories/products: " + after.categories + "/" + after.products);
        }
    }

    private static void backupCurrentState(Connection connection, Path backupFile) throws Exception {
        List<String> lines = new ArrayList<>();
        lines.add("-- Current data backup before restore");
        lines.add("SET FOREIGN_KEY_CHECKS = 0;");
        for (String table : TABLES_TO_BACKUP) {
            if (!tableExists(connection, table)) {
                continue;
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
        }
        lines.add("");
        lines.add("SET FOREIGN_KEY_CHECKS = 1;");
        Files.write(backupFile, lines, StandardCharsets.UTF_8);
    }

    private static void applyRestore(Connection connection, Path restoreFile) throws Exception {
        String sql = Files.readString(restoreFile, StandardCharsets.UTF_8);
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET FOREIGN_KEY_CHECKS = 0");
        }
        for (String rawStatement : splitStatements(sql)) {
            String trimmed = removeLeadingComments(rawStatement).trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            String executable = toUpsert(trimmed);
            if (executable == null) {
                continue;
            }
            try (Statement statement = connection.createStatement()) {
                statement.execute(executable);
            }
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    private static String toUpsert(String statement) {
        String withoutSemicolon = statement.replaceFirst(";\\s*$", "");
        String upper = withoutSemicolon.toUpperCase(Locale.ROOT);
        if (upper.startsWith("SET FOREIGN_KEY_CHECKS")) {
            return withoutSemicolon;
        }
        Matcher matcher = INSERT_PATTERN.matcher(withoutSemicolon);
        if (!matcher.find()) {
            return null;
        }
        String columnsPart = matcher.group(2);
        List<String> assignments = new ArrayList<>();
        for (String rawColumn : columnsPart.split(",")) {
            String column = rawColumn.trim().replace("`", "");
            if ("id".equalsIgnoreCase(column)) {
                continue;
            }
            assignments.add(column + " = VALUES(" + column + ")");
        }
        return withoutSemicolon + " ON DUPLICATE KEY UPDATE " + String.join(", ", assignments);
    }

    private static String removeLeadingComments(String statement) {
        String result = statement;
        while (true) {
            String trimmed = result.trim();
            if (!trimmed.startsWith("--")) {
                return trimmed;
            }
            int newline = trimmed.indexOf('\n');
            if (newline < 0) {
                return "";
            }
            result = trimmed.substring(newline + 1);
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
        if (current.length() > 0) {
            statements.add(current.toString());
        }
        return statements;
    }

    private static Counts readCounts(Connection connection) throws SQLException {
        return new Counts(countRows(connection, "categories"), countRows(connection, "products"));
    }

    private static long countRows(Connection connection, String table) throws SQLException {
        if (!tableExists(connection, table)) {
            return 0;
        }
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        DatabaseMetaData metaData = connection.getMetaData();
        try (ResultSet resultSet = metaData.getTables(connection.getCatalog(), null, table, new String[] {"TABLE"})) {
            return resultSet.next();
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

    private static class Counts {
        final long categories;
        final long products;

        Counts(long categories, long products) {
            this.categories = categories;
            this.products = products;
        }
    }
}
