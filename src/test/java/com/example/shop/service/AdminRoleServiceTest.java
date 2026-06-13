package com.example.shop.service;

import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AdminRoleServiceTest {
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
