package com.example.shop.repository;

import com.example.shop.entity.SupportSession;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class SupportSessionMapperIntegrationTest {
    private SqlSessionFactory sqlSessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:supportSessionMapper;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUser("sa");

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS support_messages");
            statement.execute("DROP TABLE IF EXISTS support_sessions");
            statement.execute("DROP TABLE IF EXISTS users");
            statement.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, username VARCHAR(120))");
            statement.execute("CREATE TABLE support_sessions ("
                    + "id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, assigned_admin_id BIGINT,"
                    + "context_key VARCHAR(160), status VARCHAR(20), last_message VARCHAR(500),"
                    + "last_message_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)");
            statement.execute("CREATE TABLE support_messages ("
                    + "id BIGINT PRIMARY KEY, session_id BIGINT NOT NULL, sender_id BIGINT NOT NULL,"
                    + "sender_role VARCHAR(20), content VARCHAR(500), is_read_by_user BOOLEAN,"
                    + "is_read_by_admin BOOLEAN, created_at TIMESTAMP)");
            statement.execute("INSERT INTO users (id, username) VALUES (1, 'customer'), (2, 'admin')");
            statement.execute("INSERT INTO support_sessions (id, user_id, status, updated_at) VALUES "
                    + "(10, 1, 'OPEN', CURRENT_TIMESTAMP), (11, 1, 'CLOSED', CURRENT_TIMESTAMP)");
            statement.execute("INSERT INTO support_messages "
                    + "(id, session_id, sender_id, sender_role, content, is_read_by_user, is_read_by_admin) VALUES "
                    + "(100, 10, 2, 'ADMIN', 'reply', FALSE, TRUE),"
                    + "(101, 10, 1, 'USER', 'question', TRUE, FALSE),"
                    + "(102, 11, 2, 'ADMIN', 'other session', FALSE, FALSE)");
        }

        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        String mapperResource = "mapper/SupportSessionMapper.xml";
        try (InputStream input = Resources.getResourceAsStream(mapperResource)) {
            new XMLMapperBuilder(input, configuration, mapperResource, configuration.getSqlFragments()).parse();
        }
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void pointLookupCountsOnlyMessagesInTheRequestedSession() {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            SupportSession supportSession = session.getMapper(SupportSessionMapper.class).findById(10L);

            assertNotNull(supportSession);
            assertEquals(1, supportSession.getUnreadByUser());
            assertEquals(1, supportSession.getUnreadByAdmin());
        }
    }

    @Test
    void userSessionListUsesTheSameSessionScopedCounts() {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            List<SupportSession> sessions = session.getMapper(SupportSessionMapper.class).findByUserId(1L, 10);

            assertEquals(2, sessions.size());
            SupportSession latest = sessions.stream()
                    .filter(item -> Long.valueOf(10L).equals(item.getId()))
                    .findFirst()
                    .orElseThrow();
            assertEquals(1, latest.getUnreadByUser());
            assertEquals(1, latest.getUnreadByAdmin());
        }
    }
}
