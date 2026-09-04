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
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PetBirthdayCouponGrantMapperIntegrationTest {
    private SqlSessionFactory sqlSessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:petBirthdayGrantMapper;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUser("sa");

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS pet_birthday_coupon_grants");
            statement.execute("CREATE TABLE pet_birthday_coupon_grants ("
                    + "id BIGINT AUTO_INCREMENT PRIMARY KEY, pet_id BIGINT NOT NULL, user_id BIGINT NOT NULL,"
                    + "coupon_id BIGINT NOT NULL, birthday_year INT NOT NULL, granted_at TIMESTAMP)");
            statement.execute("INSERT INTO pet_birthday_coupon_grants "
                    + "(pet_id, user_id, coupon_id, birthday_year) VALUES "
                    + "(101, 7, 201, 2026), (102, 7, 202, 2026), (103, 8, 203, 2026),"
                    + "(104, 7, 204, 2025)");
        }

        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        String mapperResource = "mapper/PetBirthdayCouponGrantMapper.xml";
        try (InputStream input = Resources.getResourceAsStream(mapperResource)) {
            new XMLMapperBuilder(input, configuration, mapperResource, configuration.getSqlFragments()).parse();
        }
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void batchCountReturnsOnlyRequestedYearAndUsers() {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            List<Map<String, Object>> rows = session.getMapper(PetBirthdayCouponGrantMapper.class)
                    .countByUserIdsAndBirthdayYear(List.of(7L, 8L, 9L), 2026);

            assertEquals(2, rows.size());
            assertEquals(2L, countForUser(rows, 7L));
            assertEquals(1L, countForUser(rows, 8L));
        }
    }

    private long countForUser(List<Map<String, Object>> rows, long userId) {
        return rows.stream()
                .filter(row -> number(row, "userId", "user_id") == userId)
                .mapToLong(row -> number(row, "grantCount", "grant_count"))
                .findFirst()
                .orElse(0L);
    }

    private long number(Map<String, Object> row, String camelCaseKey, String snakeCaseKey) {
        Object value = row.get(camelCaseKey);
        if (value == null) {
            value = row.get(snakeCaseKey);
        }
        if (value == null) {
            value = row.entrySet().stream()
                    .filter(entry -> entry.getKey() != null
                            && (entry.getKey().equalsIgnoreCase(camelCaseKey)
                            || entry.getKey().equalsIgnoreCase(snakeCaseKey)))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse(null);
        }
        return ((Number) value).longValue();
    }
}
