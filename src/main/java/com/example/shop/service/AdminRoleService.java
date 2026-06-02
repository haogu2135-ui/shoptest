package com.example.shop.service;

import com.example.shop.entity.AdminRole;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminRoleService {
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ADMIN = "ADMIN";
    public static final String CUSTOMER_SERVICE = "CUSTOMER_SERVICE";
    public static final String ORDER_STATUS_PERMISSION = "orders:status";
    public static final String ORDER_FULFILLMENT_PERMISSION = "orders:fulfillment";
    public static final String ORDER_PAYMENT_PERMISSION = "orders:payment";
    public static final String ORDER_REFUND_PERMISSION = "orders:refund";
    public static final String ORDER_EXPORT_PERMISSION = "orders:export";
    public static final String SUPPORT_REPLY_PERMISSION = "support:reply";
    public static final String SUPPORT_ASSIGN_PERMISSION = "support:assign";
    public static final String SUPPORT_CLOSE_PERMISSION = "support:close";
    public static final String SUPPORT_REOPEN_PERMISSION = "support:reopen";
    public static final String SUPPORT_READ_STATE_PERMISSION = "support:read-state";
    public static final String PRODUCTS_WRITE_PERMISSION = "products:write";
    public static final String PRODUCTS_DELETE_PERMISSION = "products:delete";
    public static final String PRODUCTS_STATUS_PERMISSION = "products:status";
    public static final String PRODUCTS_IMPORT_PERMISSION = "products:import";
    public static final String BRANDS_WRITE_PERMISSION = "brands:write";
    public static final String BRANDS_DELETE_PERMISSION = "brands:delete";
    public static final String CATEGORIES_WRITE_PERMISSION = "categories:write";
    public static final String CATEGORIES_DELETE_PERMISSION = "categories:delete";
    public static final String LOGISTICS_CARRIERS_WRITE_PERMISSION = "logistics-carriers:write";
    public static final String LOGISTICS_CARRIERS_DELETE_PERMISSION = "logistics-carriers:delete";
    public static final String USERS_WRITE_PERMISSION = "users:write";
    public static final String USERS_STATUS_PERMISSION = "users:status";
    public static final String USERS_DELETE_PERMISSION = "users:delete";
    public static final String USERS_EXPORT_PERMISSION = "users:export";
    public static final String COUPONS_WRITE_PERMISSION = "coupons:write";
    public static final String COUPONS_DELETE_PERMISSION = "coupons:delete";
    public static final String COUPONS_GRANT_PERMISSION = "coupons:grant";
    public static final String COUPONS_BIRTHDAY_RUN_PERMISSION = "coupons:birthday-run";
    public static final String COUPONS_BIRTHDAY_CONFIG_PERMISSION = "coupons:birthday-config";
    public static final String COUPONS_BIRTHDAY_REISSUE_PERMISSION = "coupons:birthday-reissue";
    public static final String NOTIFICATIONS_BROADCAST_PERMISSION = "notifications:broadcast";
    public static final String ANNOUNCEMENTS_WRITE_PERMISSION = "announcements:write";
    public static final String ANNOUNCEMENTS_DELETE_PERMISSION = "announcements:delete";
    public static final String ALERTS_PURGE_PERMISSION = "alerts:purge";
    public static final String ALERTS_SELF_CHECK_PERMISSION = "alerts:self-check";
    public static final String ALERTS_ACKNOWLEDGE_PERMISSION = "alerts:acknowledge";
    public static final String ALERTS_RESOLVE_PERMISSION = "alerts:resolve";
    public static final String IP_BLACKLIST_BLOCK_PERMISSION = "ip-blacklist:block";
    public static final String IP_BLACKLIST_RELEASE_PERMISSION = "ip-blacklist:release";
    public static final String IP_BLACKLIST_RECORD_FAILURE_PERMISSION = "ip-blacklist:record-failure";
    public static final String LOGS_DEBUG_PERMISSION = "logs:debug";
    public static final String LOGS_DOWNLOAD_PERMISSION = "logs:download";
    public static final String AUDIT_LOGS_EXPORT_PERMISSION = "audit-logs:export";
    public static final String AUDIT_LOGS_PURGE_PERMISSION = "audit-logs:purge";
    public static final String TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION = "traffic-control:rate-limit-clear";
    public static final String TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION = "traffic-control:circuit-reset";
    public static final String CONFIG_CENTER_APPLY_PERMISSION = "config-center:apply";
    public static final String CONFIG_CENTER_PUBLISH_PERMISSION = "config-center:publish";
    public static final String PET_GALLERY_DELETE_PERMISSION = "pet-gallery:delete";
    public static final String REVIEWS_MODERATE_PERMISSION = "reviews:moderate";
    public static final String REVIEWS_REPLY_PERMISSION = "reviews:reply";
    public static final String REVIEWS_DELETE_PERMISSION = "reviews:delete";
    public static final String QUESTIONS_ANSWER_PERMISSION = "questions:answer";
    public static final String QUESTIONS_DELETE_PERMISSION = "questions:delete";

    public static final List<String> ADMIN_PAGES = List.of(
            "dashboard", "products", "brands", "categories", "orders", "logistics-carriers",
            "users", "permissions", "reviews", "questions", "coupons", "notifications", "announcements", "audit-logs", "alerts", "ip-blacklist", "logs", "support", "pet-gallery", "registry", "config-center", "traffic-control", "system");
    public static final List<String> ADMIN_ACTION_PERMISSIONS = List.of(
            ORDER_STATUS_PERMISSION,
            ORDER_FULFILLMENT_PERMISSION,
            ORDER_PAYMENT_PERMISSION,
            ORDER_REFUND_PERMISSION,
            ORDER_EXPORT_PERMISSION,
            SUPPORT_REPLY_PERMISSION,
            SUPPORT_ASSIGN_PERMISSION,
            SUPPORT_CLOSE_PERMISSION,
            SUPPORT_REOPEN_PERMISSION,
            SUPPORT_READ_STATE_PERMISSION,
            PRODUCTS_WRITE_PERMISSION,
            PRODUCTS_DELETE_PERMISSION,
            PRODUCTS_STATUS_PERMISSION,
            PRODUCTS_IMPORT_PERMISSION,
            BRANDS_WRITE_PERMISSION,
            BRANDS_DELETE_PERMISSION,
            CATEGORIES_WRITE_PERMISSION,
            CATEGORIES_DELETE_PERMISSION,
            LOGISTICS_CARRIERS_WRITE_PERMISSION,
            LOGISTICS_CARRIERS_DELETE_PERMISSION,
            USERS_WRITE_PERMISSION,
            USERS_STATUS_PERMISSION,
            USERS_DELETE_PERMISSION,
            USERS_EXPORT_PERMISSION,
            COUPONS_WRITE_PERMISSION,
            COUPONS_DELETE_PERMISSION,
            COUPONS_GRANT_PERMISSION,
            COUPONS_BIRTHDAY_RUN_PERMISSION,
            COUPONS_BIRTHDAY_CONFIG_PERMISSION,
            COUPONS_BIRTHDAY_REISSUE_PERMISSION,
            NOTIFICATIONS_BROADCAST_PERMISSION,
            ANNOUNCEMENTS_WRITE_PERMISSION,
            ANNOUNCEMENTS_DELETE_PERMISSION,
            ALERTS_PURGE_PERMISSION,
            ALERTS_SELF_CHECK_PERMISSION,
            ALERTS_ACKNOWLEDGE_PERMISSION,
            ALERTS_RESOLVE_PERMISSION,
            IP_BLACKLIST_BLOCK_PERMISSION,
            IP_BLACKLIST_RELEASE_PERMISSION,
            IP_BLACKLIST_RECORD_FAILURE_PERMISSION,
            LOGS_DEBUG_PERMISSION,
            LOGS_DOWNLOAD_PERMISSION,
            AUDIT_LOGS_EXPORT_PERMISSION,
            AUDIT_LOGS_PURGE_PERMISSION,
            TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION,
            TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION,
            CONFIG_CENTER_APPLY_PERMISSION,
            CONFIG_CENTER_PUBLISH_PERMISSION,
            PET_GALLERY_DELETE_PERMISSION,
            REVIEWS_MODERATE_PERMISSION,
            REVIEWS_REPLY_PERMISSION,
            REVIEWS_DELETE_PERMISSION,
            QUESTIONS_ANSWER_PERMISSION,
            QUESTIONS_DELETE_PERMISSION);
    private static final List<String> ALL_ADMIN_PERMISSIONS = allAdminPermissions();

    private static final Map<String, String> PATH_PERMISSIONS = Map.ofEntries(
            Map.entry("/dashboard", "dashboard"),
            Map.entry("/products", "products"),
            Map.entry("/brands", "brands"),
            Map.entry("/categories", "categories"),
            Map.entry("/orders", "orders"),
            Map.entry("/logistics-carriers", "logistics-carriers"),
            Map.entry("/roles", "permissions"),
            Map.entry("/users", "users"),
            Map.entry("/permissions", "permissions"),
            Map.entry("/reviews", "reviews"),
            Map.entry("/questions", "questions"),
            Map.entry("/coupons", "coupons"),
            Map.entry("/notifications", "notifications"),
            Map.entry("/announcements", "announcements"),
            Map.entry("/audit-logs", "audit-logs"),
            Map.entry("/alerts", "alerts"),
            Map.entry("/ip-blacklist", "ip-blacklist"),
            Map.entry("/logs", "logs"),
            Map.entry("/support", "support"),
            Map.entry("/pet-gallery", "pet-gallery"),
            Map.entry("/registry", "registry"),
            Map.entry("/config-center", "config-center"),
            Map.entry("/traffic-control", "traffic-control"),
            Map.entry("/system", "system"),
            Map.entry("/pet-birthday-coupons", "coupons")
    );
    private static final Map<String, String> WRITE_PATH_PERMISSIONS = Map.ofEntries(
            Map.entry("/products", "products"),
            Map.entry("/brands", "brands"),
            Map.entry("/categories", "categories")
    );

    private final JdbcTemplate jdbcTemplate;
    private final UserMapper userMapper;

    @Transactional
    public void ensureSchema() {
        if (!columnExists("users", "role_code")) {
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN role_code VARCHAR(50) NULL");
        }
        if (!columnExists("users", "status")) {
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        }
        jdbcTemplate.update("UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR TRIM(status) = ''");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS admin_roles ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "code VARCHAR(50) NOT NULL UNIQUE,"
                + "name VARCHAR(100) NOT NULL,"
                + "description VARCHAR(255),"
                + "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',"
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS admin_role_permissions ("
                + "role_code VARCHAR(50) NOT NULL,"
                + "permission_key VARCHAR(80) NOT NULL,"
                + "PRIMARY KEY (role_code, permission_key),"
                + "INDEX idx_admin_role_permissions_role (role_code)"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        alignRoleCollation();
        seedRole(SUPER_ADMIN, "Super admin", "Full backend access", ALL_ADMIN_PERMISSIONS);
        seedRole(ADMIN, "Admin", "Standard operator access", defaultAdminPermissions());
        seedRole(CUSTOMER_SERVICE, "Customer service", "Support and after-sales access",
                List.of("dashboard", "orders", "support", "reviews", "questions",
                        SUPPORT_REPLY_PERMISSION,
                        SUPPORT_ASSIGN_PERMISSION,
                        SUPPORT_CLOSE_PERMISSION,
                        SUPPORT_REOPEN_PERMISSION,
                        SUPPORT_READ_STATE_PERMISSION));
        jdbcTemplate.update("UPDATE users SET role = ? WHERE role_code = ?",
                SUPER_ADMIN,
                SUPER_ADMIN);
        jdbcTemplate.queryForList("SELECT code FROM admin_roles WHERE status = 'ACTIVE'", String.class)
                .stream()
                .map(this::normalize)
                .filter(code -> !code.isEmpty() && !SUPER_ADMIN.equals(code))
                .forEach(code -> jdbcTemplate.update("UPDATE users SET role = ? "
                                + "WHERE role_code IS NOT NULL AND role_code <> '' "
                                + "AND UPPER(role_code) = ? "
                                + "AND (role IS NULL OR role <> ?)",
                        ADMIN,
                        code,
                        SUPER_ADMIN));
    }

    public List<AdminRole> findAll() {
        return jdbcTemplate.query("SELECT * FROM admin_roles ORDER BY id ASC", (rs, rowNum) -> mapRole(rs));
    }

    public List<AdminRole> findAll(int maxRows) {
        return jdbcTemplate.query("SELECT * FROM admin_roles ORDER BY id ASC LIMIT ?",
                (rs, rowNum) -> mapRole(rs),
                Math.max(1, maxRows));
    }

    public List<String> getPermissionsForUser(Long userId) {
        User user = userMapper.findById(userId);
        if (user == null) {
            return List.of();
        }
        return getPermissionsForUser(user);
    }

    public List<String> getPermissionsForUser(User user) {
        String role = normalize(user.getRole());
        String roleCode = normalize(user.getRoleCode());
        if (SUPER_ADMIN.equals(role)) {
            return ALL_ADMIN_PERMISSIONS;
        }
        if (!ADMIN.equals(role)) {
            return List.of();
        }
        if (roleCode.isEmpty()) {
            roleCode = role;
        }
        if (roleCode.isEmpty() || "USER".equals(roleCode)) {
            return List.of();
        }
        List<String> permissions = jdbcTemplate.queryForList(
                "SELECT p.permission_key FROM admin_role_permissions p "
                        + "JOIN admin_roles r ON r.code = p.role_code "
                        + "WHERE p.role_code = ? AND r.status = 'ACTIVE' ORDER BY p.permission_key",
                String.class,
                roleCode);
        if (permissions.isEmpty() && ADMIN.equals(role) && ADMIN.equals(roleCode)) {
            return defaultAdminPermissions();
        }
        return permissions;
    }

    public boolean hasPermission(Long userId, String permission) {
        String normalizedPermission = normalizePermission(permission);
        return !normalizedPermission.isEmpty() && getPermissionsForUser(userId).contains(normalizedPermission);
    }

    public boolean canAccess(Long userId, String servletPath) {
        if (isAuthenticatedAdminBootstrapPath(servletPath)) {
            return true;
        }
        String permission = permissionForPath(servletPath);
        if (permission == null) {
            return servletPath == null || !servletPath.startsWith("/admin");
        }
        return getPermissionsForUser(userId).contains(permission);
    }

    @Transactional
    public AdminRole save(AdminRole role) {
        String code = normalize(role.getCode());
        if (code.isEmpty() || List.of("USER", ADMIN, SUPER_ADMIN).contains(code)) {
            throw new IllegalArgumentException("Role code is reserved or empty");
        }
        String name = role.getName() == null || role.getName().trim().isEmpty() ? code : role.getName().trim();
        List<String> permissions = sanitizePermissions(role.getPermissions());
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_roles WHERE code = ?", Integer.class, code);
        if (count != null && count > 0) {
            jdbcTemplate.update("UPDATE admin_roles SET name = ?, description = ?, status = ?, updated_at = NOW() WHERE code = ?",
                    name, role.getDescription(), normalizeStatus(role.getStatus()), code);
        } else {
            jdbcTemplate.update("INSERT INTO admin_roles (code, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
                    code, name, role.getDescription(), normalizeStatus(role.getStatus()));
        }
        replacePermissions(code, permissions);
        return findByCode(code);
    }

    @Transactional
    public void assignRole(Long userId, String roleCode) {
        String code = normalize(roleCode);
        if (!activeRoleExists(code)) {
            throw new IllegalArgumentException("Role does not exist");
        }
        User user = userMapper.findById(userId);
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }
        userMapper.updateRoleAccess(userId, SUPER_ADMIN.equals(code) ? SUPER_ADMIN : ADMIN, code, LocalDateTime.now());
    }

    public String permissionForPath(String servletPath) {
        if (servletPath == null || !servletPath.startsWith("/admin")) {
            return permissionForWritePath(servletPath);
        }
        String path = servletPath.substring("/admin".length());
        if (path.matches("/users/[^/]+/role-code")) {
            return "permissions";
        }
        return PATH_PERMISSIONS.entrySet().stream()
                .filter(entry -> path.equals(entry.getKey()) || path.startsWith(entry.getKey() + "/"))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    public String permissionForWritePath(String servletPath) {
        if (servletPath == null) {
            return null;
        }
        return WRITE_PATH_PERMISSIONS.entrySet().stream()
                .filter(entry -> servletPath.equals(entry.getKey()) || servletPath.startsWith(entry.getKey() + "/"))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private boolean isAuthenticatedAdminBootstrapPath(String servletPath) {
        return "/admin/me/permissions".equals(servletPath);
    }

    private void seedRole(String code, String name, String description, List<String> permissions) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_roles WHERE code = ?", Integer.class, code);
        if (count == null || count == 0) {
            jdbcTemplate.update("INSERT INTO admin_roles (code, name, description, status, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', NOW(), NOW())",
                    code, name, description);
            replacePermissions(code, permissions);
        } else if (SUPER_ADMIN.equals(code) || ADMIN.equals(code) || CUSTOMER_SERVICE.equals(code)) {
            jdbcTemplate.update("UPDATE admin_roles SET name = ?, description = ?, status = 'ACTIVE', updated_at = NOW() WHERE code = ?",
                    name, description, code);
            addMissingPermissions(code, permissions);
        }
    }

    private AdminRole findByCode(String code) {
        return jdbcTemplate.queryForObject("SELECT * FROM admin_roles WHERE code = ?", (rs, rowNum) -> mapRole(rs), code);
    }

    private AdminRole mapRole(ResultSet rs) throws SQLException {
        AdminRole role = new AdminRole();
        role.setId(rs.getLong("id"));
        role.setCode(rs.getString("code"));
        role.setName(rs.getString("name"));
        role.setDescription(rs.getString("description"));
        role.setStatus(rs.getString("status"));
        role.setCreatedAt(toLocalDateTime(rs, "created_at"));
        role.setUpdatedAt(toLocalDateTime(rs, "updated_at"));
        role.setPermissions(jdbcTemplate.queryForList(
                "SELECT permission_key FROM admin_role_permissions WHERE role_code = ? ORDER BY permission_key",
                String.class,
                role.getCode()));
        return role;
    }

    private LocalDateTime toLocalDateTime(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column) == null ? null : rs.getTimestamp(column).toLocalDateTime();
    }

    private boolean roleExists(String code) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_roles WHERE code = ?", Integer.class, code);
        return count != null && count > 0;
    }

    private boolean activeRoleExists(String code) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_roles WHERE code = ? AND status = 'ACTIVE'", Integer.class, code);
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                Integer.class,
                tableName,
                columnName);
        return count != null && count > 0;
    }

    private void alignRoleCollation() {
        alignColumnCollation("users", "role_code", "VARCHAR(50)");
        alignColumnCollation("admin_roles", "code", "VARCHAR(50)");
        alignColumnCollation("admin_role_permissions", "role_code", "VARCHAR(50)");
    }

    private void alignColumnCollation(String tableName, String columnName, String columnType) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLLATION_NAME "
                        + "FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                tableName,
                columnName);
        if (rows.isEmpty()) {
            return;
        }
        Object collationObj = rows.get(0).get("COLLATION_NAME");
        String currentCollation = collationObj == null ? "" : collationObj.toString();
        if ("utf8mb4_unicode_ci".equalsIgnoreCase(currentCollation)) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE " + tableName
                + " MODIFY COLUMN " + columnName + " " + columnType
                + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }

    private void replacePermissions(String code, List<String> permissions) {
        jdbcTemplate.update("DELETE FROM admin_role_permissions WHERE role_code = ?", code);
        for (String permission : permissions) {
            jdbcTemplate.update("INSERT INTO admin_role_permissions (role_code, permission_key) VALUES (?, ?)", code, permission);
        }
    }

    private void addMissingPermissions(String code, List<String> permissions) {
        for (String permission : sanitizePermissions(permissions)) {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM admin_role_permissions WHERE role_code = ? AND permission_key = ?",
                    Integer.class,
                    code,
                    permission);
            if (count == null || count == 0) {
                jdbcTemplate.update("INSERT INTO admin_role_permissions (role_code, permission_key) VALUES (?, ?)", code, permission);
            }
        }
    }

    private List<String> sanitizePermissions(List<String> permissions) {
        Set<String> allowed = new LinkedHashSet<>(ALL_ADMIN_PERMISSIONS);
        return new ArrayList<>(new LinkedHashSet<>(permissions == null ? List.of() : permissions)).stream()
                .map(this::normalizePermission)
                .filter(allowed::contains)
                .collect(Collectors.toList());
    }

    private static List<String> allAdminPermissions() {
        List<String> permissions = new ArrayList<>(ADMIN_PAGES);
        permissions.addAll(ADMIN_ACTION_PERMISSIONS);
        return List.copyOf(new LinkedHashSet<>(permissions));
    }

    private static List<String> defaultAdminPermissions() {
        List<String> permissions = ADMIN_PAGES.stream()
                .filter(page -> !"permissions".equals(page))
                .collect(Collectors.toCollection(ArrayList::new));
        permissions.addAll(ADMIN_ACTION_PERMISSIONS);
        return List.copyOf(new LinkedHashSet<>(permissions));
    }

    private String normalizePermission(String permission) {
        return permission == null ? "" : permission.trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStatus(String status) {
        return "INACTIVE".equals(normalize(status)) ? "INACTIVE" : "ACTIVE";
    }
}
