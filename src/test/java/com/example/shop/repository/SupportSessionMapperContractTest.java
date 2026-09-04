package com.example.shop.repository;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class SupportSessionMapperContractTest {

    @Test
    void adminPageUnreadCountsUseJoinAggregateInsteadOfPerRowSubqueries() throws Exception {
        String mapper = Files.readString(
                Path.of("src/main/resources/mapper/SupportSessionMapper.xml"),
                StandardCharsets.UTF_8);
        String adminColumns = sqlFragment(mapper, "supportSessionAdminPageColumns");
        String adminPage = selectStatement(mapper, "findAdminPage");

        assertTrue(adminColumns.contains("COALESCE(unread.unread_by_user, 0) AS unread_by_user"));
        assertTrue(adminColumns.contains("COALESCE(unread.unread_by_admin, 0) AS unread_by_admin"));
        assertFalse(adminColumns.contains("SELECT COUNT(*) FROM support_messages"),
                "admin support session columns must not run unread count subqueries per row");
        assertTrue(adminPage.contains("<include refid=\"supportUnreadJoin\"/>"),
                "admin support session page must join the shared unread aggregate");
        assertTrue(adminPage.contains("ORDER BY unread_by_admin DESC"),
                "admin support session page should keep unread sessions prioritized");
    }

    @Test
    void regularSessionQueriesUseSessionScopedUnreadCounts() throws Exception {
        String mapper = Files.readString(
                Path.of("src/main/resources/mapper/SupportSessionMapper.xml"),
                StandardCharsets.UTF_8);
        String sessionColumns = sqlFragment(mapper, "supportSessionColumns");

        assertTrue(sessionColumns.contains("FROM support_messages unread_user"));
        assertTrue(sessionColumns.contains("unread_user.session_id = ss.id"));
        assertTrue(sessionColumns.contains("FROM support_messages unread_admin"));
        assertTrue(sessionColumns.contains("unread_admin.session_id = ss.id"));
        assertFalse(sessionColumns.contains("unread.unread_by_user"));
        assertFalse(selectStatement(mapper, "findById").contains("supportUnreadJoin"));
        assertFalse(selectStatement(mapper, "findByUserId").contains("supportUnreadJoin"));
    }

    @Test
    void supportMessageSchemaIncludesSessionScopedUnreadIndex() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"), StandardCharsets.UTF_8);
        String migration = Files.readString(
                Path.of("src/main/resources/db/migration/V1__init.sql"),
                StandardCharsets.UTF_8);
        String config = Files.readString(
                Path.of("src/main/java/com/example/shop/config/CommerceSchemaConfig.java"),
                StandardCharsets.UTF_8);

        assertTrue(schema.contains("idx_support_messages_session_read (session_id, is_read_by_user, is_read_by_admin)"));
        assertTrue(migration.contains("idx_support_messages_session_read (session_id, is_read_by_user, is_read_by_admin)"));
        assertTrue(config.contains("idx_support_messages_session_read"));
    }

    private String sqlFragment(String mapper, String id) {
        return block(mapper, "<sql id=\"" + id + "\">", "</sql>");
    }

    private String selectStatement(String mapper, String id) {
        return block(mapper, "<select id=\"" + id + "\"", "</select>");
    }

    private String block(String source, String startToken, String endToken) {
        int start = source.indexOf(startToken);
        assertTrue(start >= 0, () -> "Missing mapper block: " + startToken);
        int end = source.indexOf(endToken, start);
        assertTrue(end > start, () -> "Missing mapper block terminator: " + endToken);
        return source.substring(start, end).replaceAll("\\s+", " ").trim();
    }
}
