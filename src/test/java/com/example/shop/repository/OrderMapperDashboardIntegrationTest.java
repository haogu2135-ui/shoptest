package com.example.shop.repository;

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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderMapperDashboardIntegrationTest {
    private SqlSessionFactory sqlSessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:orderDashboardMapper;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUser("sa");

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS payments");
            statement.execute("DROP TABLE IF EXISTS orders");
            statement.execute("CREATE TABLE orders ("
                    + "id BIGINT PRIMARY KEY, status VARCHAR(30) NOT NULL, total_amount DECIMAL(10,2),"
                    + "original_amount DECIMAL(10,2), refunded_at TIMESTAMP, created_at TIMESTAMP,"
                    + "updated_at TIMESTAMP, return_approved_at TIMESTAMP, return_shipped_at TIMESTAMP,"
                    + "tracking_number VARCHAR(100))");
            statement.execute("CREATE TABLE payments ("
                    + "id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id BIGINT NOT NULL,"
                    + "status VARCHAR(30) NOT NULL)");
            statement.execute("INSERT INTO orders "
                    + "(id, status, total_amount, original_amount, created_at, updated_at) VALUES "
                    + "(1, 'RETURN_REFUNDING', 40.00, 40.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),"
                    + "(2, 'COMPLETED', 20.00, 20.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),"
                    + "(3, 'PENDING_PAYMENT', 10.00, 10.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            statement.execute("INSERT INTO payments (order_id, status) VALUES (2, 'REFUNDING')");
        }

        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        String mapperResource = "mapper/OrderMapper.xml";
        try (InputStream input = Resources.getResourceAsStream(mapperResource)) {
            new XMLMapperBuilder(input, configuration, mapperResource, configuration.getSqlFragments()).parse();
        }
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void dashboardAggregateExecutesAndCountsOrderAndPaymentRefundingStates() {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            Map<String, Object> stats = session.selectOne(
                    "com.example.shop.repository.OrderRepository.dashboardOrderStats",
                    Map.of("now", LocalDateTime.now()));

            assertEquals(3L, number(stats, "totalOrders"));
            assertEquals(2L, number(stats, "refundingPayments"));
        }
    }

    private long number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) {
            value = row.get(key.toLowerCase());
        }
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        return ((Number) value).longValue();
    }
}
