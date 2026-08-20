package com.example.shop.repository;

import com.example.shop.entity.SecurityAuditLog;
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
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class SecurityAuditLogMapperIntegrationTest {
    private SqlSessionFactory sqlSessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:webhookEvidence;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUser("sa");

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS security_audit_logs");
            statement.execute("CREATE TABLE security_audit_logs ("
                    + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                    + "action VARCHAR(50) NOT NULL,"
                    + "result VARCHAR(20) NOT NULL,"
                    + "actor_user_id BIGINT,"
                    + "actor_username VARCHAR(120),"
                    + "actor_role VARCHAR(40),"
                    + "resource_type VARCHAR(80),"
                    + "resource_id VARCHAR(120),"
                    + "ip_address VARCHAR(64),"
                    + "user_agent VARCHAR(500),"
                    + "message VARCHAR(1000),"
                    + "metadata TEXT,"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    + ")");
        }

        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        String mapperResource = "mapper/SecurityAuditLogMapper.xml";
        try (InputStream input = Resources.getResourceAsStream(mapperResource)) {
            new XMLMapperBuilder(input, configuration, mapperResource, configuration.getSqlFragments()).parse();
        }
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void executesPersistentWebhookEvidenceQueriesAgainstTheAuditTable() {
        LocalDateTime base = LocalDateTime.of(2026, 8, 20, 7, 0);

        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            SecurityAuditLogMapper mapper = session.getMapper(SecurityAuditLogMapper.class);
            mapper.insert(log("STRIPE_WEBHOOK", "SUCCESS", "sourceClass=SIGNED_LOCAL,userAgentClass=STRIPE", base));
            mapper.insert(log("STRIPE_WEBHOOK", "SUCCESS", null, base.plusMinutes(1)));
            mapper.insert(log("STRIPE_WEBHOOK", "FAILURE", "sourceClass=PROVIDER_LIKE,userAgentClass=STRIPE", base.plusMinutes(2)));
            mapper.insert(log("STRIPE_WEBHOOK", "SUCCESS", "sourceClass=PROVIDER_LIKE,userAgentClass=STRIPE", base.plusMinutes(3)));
            mapper.insert(log("MERCADO_PAGO_WEBHOOK", "SUCCESS", "sourceClass=SIGNED_LOCAL,userAgentClass=MERCADO_PAGO", base.plusMinutes(4)));
            mapper.insert(log("MERCADO_PAGO_WEBHOOK", "SUCCESS", "sourceClass=PROVIDER_LIKE,userAgentClass=MERCADO_PAGO", base.plusMinutes(5)));
            mapper.insert(log("OTHER_ACTION", "SUCCESS", "sourceClass=PROVIDER_LIKE,userAgentClass=OTHER", base.plusMinutes(6)));

            assertEquals(3L, mapper.countWebhookSuccess("STRIPE_WEBHOOK"));
            assertEquals(2L, mapper.countWebhookSuccess("MERCADO_PAGO_WEBHOOK"));
            assertEquals(2L, mapper.countProviderLikeWebhookSuccess());

            SecurityAuditLog latestStripe = mapper.findLatestWebhookSuccess("STRIPE_WEBHOOK");
            assertNotNull(latestStripe);
            assertEquals(base.plusMinutes(3), latestStripe.getCreatedAt());
            assertEquals("sourceClass=PROVIDER_LIKE,userAgentClass=STRIPE", latestStripe.getMetadata());
        }
    }

    private SecurityAuditLog log(String action, String result, String metadata, LocalDateTime createdAt) {
        SecurityAuditLog log = new SecurityAuditLog();
        log.setAction(action);
        log.setResult(result);
        log.setMetadata(metadata);
        log.setCreatedAt(createdAt);
        return log;
    }
}
