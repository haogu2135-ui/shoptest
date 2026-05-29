package com.example.shop.service;

import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {
    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private UserService service;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");
        when(passwordEncoder.encode("Newpass123")).thenReturn("encoded-newpass");
        service = new UserService(userMapper, passwordEncoder);
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(userMapper.countAll()).thenReturn(12L);

        assertEquals(12L, service.count());

        verify(userMapper).countAll();
        verify(userMapper, never()).findAll();
    }

    @Test
    void searchNormalizesTextFilters() {
        when(userMapper.search("Jane Doe", "ADMIN", "ACTIVE")).thenReturn(List.of());

        service.search("  Jane\u0000   Doe  ", " ADMIN ", " ACTIVE ");

        verify(userMapper).search("Jane Doe", "ADMIN", "ACTIVE");
    }

    @Test
    void searchConvertsBlankFiltersToNull() {
        when(userMapper.search(null, null, null)).thenReturn(List.of());

        service.search(" \u0000 ", " ", null);

        verify(userMapper).search(null, null, null);
    }

    @Test
    void adminSummaryNormalizesFiltersAndCalculatesHealthScore() {
        when(userMapper.adminSummary("Jane Doe", "ADMIN", "ACTIVE")).thenReturn(Map.of(
                "total_users", 8L,
                "active_users", 6L,
                "banned_users", 1L,
                "admin_users", 3L,
                "customer_users", 5L,
                "missing_email_users", 2L,
                "missing_phone_users", 1L,
                "ready_users", 4L
        ));

        UserAdminSummaryResponse summary = service.adminSummary("  Jane\u0000   Doe  ", " ADMIN ", " ACTIVE ");

        assertEquals(8L, summary.getTotalUsers());
        assertEquals(6L, summary.getActiveUsers());
        assertEquals(1L, summary.getBannedUsers());
        assertEquals(3L, summary.getAdminUsers());
        assertEquals(5L, summary.getCustomerUsers());
        assertEquals(2L, summary.getMissingEmailUsers());
        assertEquals(1L, summary.getMissingPhoneUsers());
        assertEquals(4L, summary.getReadyUsers());
        assertEquals(38, summary.getAdminRatioPercent());
        assertEquals(50, summary.getHealthScore());
        verify(userMapper).adminSummary("Jane Doe", "ADMIN", "ACTIVE");
    }

    @Test
    void registerNormalizesFieldsAndChecksDuplicatesBeforeInsert() {
        User user = new User();
        user.setUsername("  NewUser  ");
        user.setPassword("secret123");
        user.setEmail("  USER@Example.COM  ");
        user.setPhone("  15551234567  ");
        doAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(99L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(userMapper.findById(99L)).thenReturn(user);

        service.register(user);

        assertEquals("NewUser", user.getUsername());
        assertEquals("user@example.com", user.getEmail());
        assertEquals("15551234567", user.getPhone());
        assertEquals("encoded-secret", user.getPassword());
        assertEquals("USER", user.getRole());
        assertEquals("ACTIVE", user.getStatus());
        verify(userMapper).findByPhone("15551234567");
        verify(userMapper).findByUsername("NewUser");
        verify(userMapper).findByUsernameOrPhoneOrEmail("user@example.com");
        verify(userMapper).insert(user);
    }

    @Test
    void registeredAccountCanBeFoundByNormalizedUsernameEmailOrPhone() {
        User saved = new User();
        saved.setId(9L);
        saved.setUsername("NewUser");
        saved.setEmail("user@example.com");
        saved.setPhone("15551234567");

        when(userMapper.findByUsernameOrPhoneOrEmail("newuser")).thenReturn(saved);
        when(userMapper.findByUsernameOrPhoneOrEmail("user@example.com")).thenReturn(saved);
        when(userMapper.findByUsernameOrPhoneOrEmail("+15551234567")).thenReturn(saved);
        when(userMapper.findByUsernameOrPhoneOrEmail("15551234567")).thenReturn(saved);

        assertEquals(saved, service.findByUsernameOrPhoneOrEmail("  newuser  "));
        assertEquals(saved, service.findByUsernameOrPhoneOrEmail(" USER@Example.COM "));
        assertEquals(saved, service.findByUsernameOrPhoneOrEmail(" +1 (555) 123-4567 "));
        assertEquals(saved, service.findByUsernameOrPhoneOrEmail(" 1-555-123-4567 "));
    }

    @Test
    void registerRejectsDuplicateUsernameBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("duplicate");
        user.setPassword("secret123");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");
        when(userMapper.findByUsername("duplicate")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Username already registered", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsMissingEmailBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email is required", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsPasswordWithoutLettersAndNumbers() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("password");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Password must include letters and numbers", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerAdminRejectsWeakPassword() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("password");
        admin.setEmail("admin@example.com");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.registerAdmin(admin));

        assertEquals("Admin password must include letters and numbers", exception.getMessage());
        verify(userMapper, never()).insert(admin);
    }

    @Test
    void registerAdminRejectsBootstrapAfterAdminExists() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("secret123");
        admin.setEmail("admin@example.com");
        when(userMapper.countAdminUsers()).thenReturn(1L);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.registerAdmin(admin));

        assertEquals("Admin bootstrap is already completed", exception.getMessage());
        verify(userMapper, never()).insert(admin);
        verify(passwordEncoder, never()).encode("secret123");
    }

    @Test
    void registerRejectsPhoneLongerThanUsersColumn() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setEmail("new@example.com");
        user.setPhone("123456789012345678901");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Phone number is too long", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerStripsPhoneExtensionTextBeforeDuplicateLookup() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setEmail("new@example.com");
        user.setPhone(" +1 (555) 123-4567 ext 99 ");

        service.register(user);

        assertEquals("+1555123456799", user.getPhone());
        verify(userMapper).findByPhone("+1555123456799");
        verify(userMapper).insert(user);
    }

    @Test
    void registerRejectsDuplicateEmailBeforeDatabaseConstraintFailure() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("secret123");
        user.setEmail("Taken@Example.COM");
        user.setPhone("15551234567");
        when(userMapper.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email already registered", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerUpgradesGuestUserWithMatchingEmailInsteadOfBlockingRegistration() {
        User user = new User();
        user.setUsername("  NewUser  ");
        user.setPassword("secret123");
        user.setEmail("  USER@Example.COM  ");
        user.setPhone("  15551234567  ");

        User guest = new User();
        guest.setId(18L);
        guest.setUsername("guest_user_example_com_12345678");
        guest.setEmail("user@example.com");
        guest.setStatus("GUEST");
        guest.setRole("USER");

        when(userMapper.findByUsernameOrPhoneOrEmail("user@example.com")).thenReturn(guest);

        service.register(user);

        ArgumentCaptor<User> updatedUser = ArgumentCaptor.forClass(User.class);
        verify(userMapper).update(updatedUser.capture());
        assertEquals(18L, updatedUser.getValue().getId());
        assertEquals("NewUser", updatedUser.getValue().getUsername());
        assertEquals("user@example.com", updatedUser.getValue().getEmail());
        assertEquals("15551234567", updatedUser.getValue().getPhone());
        assertEquals("encoded-secret", updatedUser.getValue().getPassword());
        assertEquals("USER", updatedUser.getValue().getRole());
        assertEquals("ACTIVE", updatedUser.getValue().getStatus());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    void updateProfileContactNormalizesFieldsAndRejectsDuplicateEmail() {
        User current = new User();
        current.setId(5L);
        current.setEmail("old@example.com");
        current.setPhone("5550100");
        User existingEmail = new User();
        existingEmail.setId(8L);

        when(userMapper.findById(5L)).thenReturn(current);
        when(userMapper.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(existingEmail);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updateProfileContact(5L, " Taken@Example.COM ", " 5550101 "));

        assertEquals("Email already registered", exception.getMessage());
        verify(userMapper, never()).updateProfileContact(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updateProfileContactUpdatesOnlyOwnedContactFields() {
        User current = new User();
        current.setId(5L);
        current.setEmail("old@example.com");
        current.setPhone("5550100");

        when(userMapper.findById(5L)).thenReturn(current);

        service.updateProfileContact(5L, " USER@Example.COM ", " 555\t0101 ");

        verify(userMapper).findById(5L);
        verify(userMapper).findByUsernameOrPhoneOrEmail("user@example.com");
        verify(userMapper).findByPhone("5550101");
        verify(userMapper).updateProfileContact(
                org.mockito.ArgumentMatchers.eq(5L),
                org.mockito.ArgumentMatchers.eq("user@example.com"),
                org.mockito.ArgumentMatchers.eq("5550101"),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updateProfileContactRejectsPhoneLongerThanUsersColumn() {
        User current = new User();
        current.setId(5L);
        current.setEmail("old@example.com");
        current.setPhone("5550100");
        when(userMapper.findById(5L)).thenReturn(current);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updateProfileContact(5L, "user@example.com", "123456789012345678901"));

        assertEquals("Phone number is too long", exception.getMessage());
        verify(userMapper, never()).updateProfileContact(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updatePasswordRejectsWeakNewPasswordBeforeCheckingOldPassword() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updatePassword(5L, "old-secret", "password"));

        assertEquals("New password must include letters and numbers", exception.getMessage());
        verify(userMapper, never()).findById(5L);
        verify(userMapper, never()).updatePassword(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void updatePasswordStoresStrongNewPasswordWhenOldPasswordMatches() {
        User user = new User();
        user.setId(5L);
        user.setPassword("encoded-old");
        when(userMapper.findById(5L)).thenReturn(user);
        when(passwordEncoder.matches("old-secret", "encoded-old")).thenReturn(true);

        service.updatePassword(5L, "old-secret", "Newpass123");

        verify(userMapper).updatePassword(5L, "encoded-newpass");
    }

    @Test
    void updatePasswordRejectsWrongOldPasswordAsBusinessError() {
        User user = new User();
        user.setId(5L);
        user.setPassword("encoded-old");
        when(userMapper.findById(5L)).thenReturn(user);
        when(passwordEncoder.matches("wrong-secret", "encoded-old")).thenReturn(false);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updatePassword(5L, "wrong-secret", "Newpass123"));

        assertEquals("Current password is incorrect", exception.getMessage());
        verify(userMapper, never()).updatePassword(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void resetPasswordRejectsWeakNewPasswordBeforeAccountLookup() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.resetPassword("mia", "mia@example.com", "password"));

        assertEquals("New password must include letters and numbers", exception.getMessage());
        verify(userMapper, never()).findByUsernameOrPhoneOrEmail("mia");
        verify(userMapper, never()).updatePassword(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString());
    }
}
