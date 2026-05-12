import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class CleanupNonPetCategories {
    private static final String URL = "jdbc:mysql://localhost:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    private static final String USER = "root";
    private static final String PASSWORD = "84813378";
    private static final String CONFIRMATION = "--delete-non-pet-categories";
    private static final String PET_CATEGORY_IDS = "1,2,3,4,5,6,7,8,9,10,11,12,13";

    public static void main(String[] args) throws Exception {
        if (args.length == 0 || !CONFIRMATION.equals(args[0])) {
            System.err.println("Refusing to run without confirmation. Use " + CONFIRMATION);
            System.exit(2);
        }

        Files.createDirectories(Path.of("backups"));
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now());
        Path backupFile = Path.of("backups", "before_non_pet_category_cleanup_" + stamp + ".sql");

        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {
            connection.setAutoCommit(false);
            backupTable(connection, "categories", backupFile, false);
            backupTable(connection, "products", backupFile, true);

            long blockingProducts = count(connection, "SELECT COUNT(*) FROM products WHERE category_id NOT IN (" + PET_CATEGORY_IDS + ")");
            if (blockingProducts > 0) {
                connection.rollback();
                throw new IllegalStateException("Aborted: " + blockingProducts + " products still reference non-pet categories.");
            }

            long before = count(connection, "SELECT COUNT(*) FROM categories");
            long toDelete = count(connection, "SELECT COUNT(*) FROM categories WHERE id NOT IN (" + PET_CATEGORY_IDS + ")");
            try (Statement statement = connection.createStatement()) {
                statement.execute("SET FOREIGN_KEY_CHECKS = 0");
                statement.executeUpdate("DELETE FROM categories WHERE id NOT IN (" + PET_CATEGORY_IDS + ")");
                statement.execute("SET FOREIGN_KEY_CHECKS = 1");
            }
            long after = count(connection, "SELECT COUNT(*) FROM categories");
            connection.commit();

            System.out.println("Backup: " + backupFile.toAbsolutePath());
            System.out.println("Categories before: " + before);
            System.out.println("Non-pet categories deleted: " + toDelete);
            System.out.println("Categories after: " + after);
        }
    }

    private static long count(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private static void backupTable(Connection connection, String table, Path backupFile, boolean append) throws Exception {
        List<String> lines = new ArrayList<>();
        if (!append) {
            lines.add("-- Backup before deleting non-pet categories");
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
}
