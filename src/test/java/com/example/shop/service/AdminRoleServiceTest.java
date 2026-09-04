package com.example.shop.service;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AdminRoleServiceTest {
    @Test
    void roleListExposesOnlyBoundedLookup() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/AdminRoleService.java"),
                StandardCharsets.UTF_8);

        org.junit.jupiter.api.Assertions.assertFalse(source.contains("public List<AdminRole> findAll()"));
        org.junit.jupiter.api.Assertions.assertTrue(source.contains("public List<AdminRole> findAll(int maxRows)"));
        org.junit.jupiter.api.Assertions.assertTrue(source.contains("ORDER BY id ASC LIMIT ?"));
    }

    @Test
    void permissionSeedingUsesSetBasedReadsAndBatchWrites() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/AdminRoleService.java"),
                StandardCharsets.UTF_8);

        org.junit.jupiter.api.Assertions.assertTrue(source.contains("jdbcTemplate.batchUpdate"));
        org.junit.jupiter.api.Assertions.assertTrue(source.contains("SELECT permission_key FROM admin_role_permissions WHERE role_code = ?"));
        org.junit.jupiter.api.Assertions.assertTrue(source.contains("SELECT role_code, permission_key FROM admin_role_permissions"));
        org.junit.jupiter.api.Assertions.assertFalse(source.contains("SELECT COUNT(*) FROM admin_role_permissions WHERE role_code = ? AND permission_key = ?"));
        org.junit.jupiter.api.Assertions.assertFalse(source.contains("jdbcTemplate.update(\"INSERT INTO admin_role_permissions"));
        org.junit.jupiter.api.Assertions.assertFalse(source.contains(".forEach(code -> addMissingPermissions(code, ALL_ADMIN_PERMISSIONS)"));
    }

    @Test
    void activeRoleNormalizationUsesOneJoinedUpdate() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/AdminRoleService.java"),
                StandardCharsets.UTF_8);

        org.junit.jupiter.api.Assertions.assertTrue(source.contains("UPDATE users u "));
        org.junit.jupiter.api.Assertions.assertTrue(source.contains("JOIN admin_roles r ON UPPER(u.role_code) = UPPER(r.code)"));
        org.junit.jupiter.api.Assertions.assertFalse(source.contains(".forEach(code -> jdbcTemplate.update"));
    }

    @Test
    void assignRoleAcceptsUserDemotionWithoutAdminRoleRow() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        UserMapper userMapper = mock(UserMapper.class);
        User user = new User();
        user.setId(7L);
        when(userMapper.findById(7L)).thenReturn(user);
        AdminRoleService service = new AdminRoleService(jdbcTemplate, userMapper);

        service.assignRole(7L, " user ");

        verify(userMapper).updateRoleAccess(eq(7L), eq("USER"), isNull(), any(LocalDateTime.class));
        verifyNoInteractions(jdbcTemplate);
    }
}
