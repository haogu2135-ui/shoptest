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
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UserCouponMapperIntegrationTest {
    private SqlSessionFactory sqlSessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:userCouponMapper;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUser("sa");

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS user_coupons");
            statement.execute("CREATE TABLE user_coupons ("
                    + "id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, coupon_id BIGINT NOT NULL,"
                    + "status VARCHAR(20) NOT NULL, order_id BIGINT, claimed_at TIMESTAMP, used_at TIMESTAMP)");
            statement.execute("INSERT INTO user_coupons (user_id, coupon_id, status) VALUES "
                    + "(7, 5, 'UNUSED'), (8, 5, 'USED'), (7, 6, 'UNUSED')");
        }

        Environment environment = new Environment("test", new JdbcTransactionFactory(), dataSource);
        Configuration configuration = new Configuration(environment);
        String mapperResource = "mapper/UserCouponMapper.xml";
        try (InputStream input = Resources.getResourceAsStream(mapperResource)) {
            new XMLMapperBuilder(input, configuration, mapperResource, configuration.getSqlFragments()).parse();
        }
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void batchLookupReturnsUsersAlreadyAssignedToCoupon() {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            Set<Long> existingUserIds = new HashSet<>(session.getMapper(UserCouponMapper.class)
                    .findUserIdsByCouponIdAndUserIdIn(5L, List.of(7L, 8L, 9L)));

            assertEquals(Set.of(7L, 8L), existingUserIds);
        }
    }
}
