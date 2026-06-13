package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserMapperContractTest {

    @Test
    void currentUserContractDoesNotDefineLastLoginFields() throws Exception {
        String entity = Files.readString(
                Paths.get("src/main/java/com/example/shop/entity/User.java"),
                StandardCharsets.UTF_8);
        String mapper = Files.readString(
                Paths.get("src/main/resources/mapper/UserMapper.xml"),
                StandardCharsets.UTF_8);
        String schema = Files.readString(
                Paths.get("src/main/resources/schema.sql"),
                StandardCharsets.UTF_8);
        String initialMigration = Files.readString(
                Paths.get("src/main/resources/db/migration/V1__init.sql"),
                StandardCharsets.UTF_8);

        for (String source : new String[]{entity, mapper, schema, initialMigration}) {
            assertFalse(source.contains("lastLoginAt"));
            assertFalse(source.contains("lastLoginIp"));
            assertFalse(source.contains("last_login_at"));
            assertFalse(source.contains("last_login_ip"));
        }
    }

    @Test
    void userMapperDoesNotExposeUnboundedFullTableQueries() throws Exception {
        assertThrows(NoSuchMethodException.class, () -> UserMapper.class.getMethod("findAll"));
        assertThrows(NoSuchMethodException.class,
                () -> UserMapper.class.getMethod("search", String.class, String.class, String.class));

        String mapper = Files.readString(
                Paths.get("src/main/resources/mapper/UserMapper.xml"),
                StandardCharsets.UTF_8);
        assertFalse(mapper.contains("id=\"findAll\""),
                "UserMapper must not expose a no-arg full-users findAll statement");
        assertFalse(mapper.contains("id=\"search\""),
                "UserMapper must not expose an unbounded admin user search statement");
    }
}
