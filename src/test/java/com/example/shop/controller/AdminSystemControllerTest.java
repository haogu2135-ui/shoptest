package com.example.shop.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminSystemControllerTest {

    @Test
    void reportsHealthyWhenDatabaseAndRedisAreAvailable() throws Exception {
        Environment environment = environment();
        DataSource dataSource = dataSource(true);
        StringRedisTemplate redisTemplate = redisTemplate("PONG");
        AdminSystemController controller = controller(environment, dataSource, redisTemplate, true);

        Map<String, Object> status = controller.getStatus();

        assertEquals("UP", status.get("status"));
        assertEquals(true, status.get("healthy"));
        assertEquals(true, ((Map<?, ?>) status.get("database")).get("ready"));
        assertEquals(true, ((Map<?, ?>) status.get("redis")).get("ready"));
        assertEquals("PONG", ((Map<?, ?>) status.get("redis")).get("ping"));
        assertEquals("jdbc:mysql://localhost:3306/shop?password=******&useSSL=false",
                ((Map<?, ?>) status.get("database")).get("url"));
    }

    @Test
    void readinessReturnsOkWhenRedisIsDisabledAndDatabaseIsAvailable() throws Exception {
        Environment environment = environment();
        AdminSystemController controller = controller(environment, dataSource(true), null, false);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UP", response.getBody().get("status"));
        assertEquals("DISABLED", ((Map<?, ?>) response.getBody().get("redis")).get("status"));
        assertEquals(true, ((Map<?, ?>) response.getBody().get("redis")).get("ready"));
    }

    @Test
    void readinessReturnsServiceUnavailableWhenDatabaseFails() throws Exception {
        Environment environment = environment();
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("db\nunreachable"));
        AdminSystemController controller = controller(environment, dataSource, redisTemplate("PONG"), true);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("DEGRADED", response.getBody().get("status"));
        Map<?, ?> database = (Map<?, ?>) response.getBody().get("database");
        assertEquals(false, database.get("ready"));
        assertTrue(String.valueOf(database.get("error")).contains("SQLException"));
        assertFalse(String.valueOf(database.get("error")).contains("\n"));
    }

    @Test
    void readinessReturnsServiceUnavailableWhenRedisIsRequiredButUnavailable() throws Exception {
        Environment environment = environment();
        AdminSystemController controller = controller(environment, dataSource(true), null, true);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("DEGRADED", response.getBody().get("status"));
        Map<?, ?> redis = (Map<?, ?>) response.getBody().get("redis");
        assertEquals("UNAVAILABLE", redis.get("status"));
        assertEquals(false, redis.get("ready"));
    }

    private Environment environment() {
        Environment environment = mock(Environment.class);
        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(environment.getProperty("spring.datasource.driver-class-name", "")).thenReturn("com.mysql.cj.jdbc.Driver");
        when(environment.getProperty("spring.cloud.nacos.discovery.namespace", "")).thenReturn("");
        when(environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP")).thenReturn("DEFAULT_GROUP");
        return environment;
    }

    private DataSource dataSource(boolean valid) throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(connection.isValid(2)).thenReturn(valid);
        when(dataSource.getConnection()).thenReturn(connection);
        return dataSource;
    }

    private StringRedisTemplate redisTemplate(String ping) {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection connection = mock(RedisConnection.class);
        when(redisTemplate.getConnectionFactory()).thenReturn(connectionFactory);
        when(connectionFactory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn(ping);
        return redisTemplate;
    }

    @SuppressWarnings("unchecked")
    private AdminSystemController controller(
            Environment environment,
            DataSource dataSource,
            StringRedisTemplate redisTemplate,
            boolean mailRedisEnabled
    ) {
        ObjectProvider<DataSource> dataSources = mock(ObjectProvider.class);
        ObjectProvider<StringRedisTemplate> redisTemplates = mock(ObjectProvider.class);
        when(dataSources.getIfAvailable()).thenReturn(dataSource);
        when(redisTemplates.getIfAvailable()).thenReturn(redisTemplate);

        AdminSystemController controller = new AdminSystemController(environment, dataSources, redisTemplates);
        ReflectionTestUtils.setField(controller, "applicationName", "shop-backend");
        ReflectionTestUtils.setField(controller, "serverPort", "8081");
        ReflectionTestUtils.setField(controller, "runtimeMode", "test");
        ReflectionTestUtils.setField(controller, "datasourceUrl", "jdbc:mysql://localhost:3306/shop?password=secret&useSSL=false");
        ReflectionTestUtils.setField(controller, "nacosServerAddr", "127.0.0.1:8848");
        ReflectionTestUtils.setField(controller, "nacosDiscoveryEnabled", true);
        ReflectionTestUtils.setField(controller, "nacosRegisterEnabled", true);
        ReflectionTestUtils.setField(controller, "mailRedisEnabled", mailRedisEnabled);
        ReflectionTestUtils.setField(controller, "redisHost", "127.0.0.1");
        ReflectionTestUtils.setField(controller, "redisPort", "6379");
        ReflectionTestUtils.setField(controller, "redisDatabase", "0");
        return controller;
    }
}
