package com.example.shop.service;

import com.example.shop.dto.UserAdminSummaryResponse;
import com.example.shop.entity.User;
import com.example.shop.repository.UserMapper;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
        when(userMapper.acquireAdminBootstrapLock()).thenReturn(1L);
        when(passwordEncoder.encode("StrongPass123")).thenReturn("encoded-secret");
        when(passwordEncoder.encode("NewPass123456")).thenReturn("encoded-newpass");
        service = new UserService(userMapper, passwordEncoder);
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(userMapper.countAll()).thenReturn(12L);

        assertEquals(12L, service.count());

        verify(userMapper).countAll();
    }

    @Test
    void countSearchNormalizesTextFilters() {
        when(userMapper.countSearch("Jane Doe", "ADMIN", "ACTIVE")).thenReturn(12L);

        assertEquals(12L, service.countSearch("  Jane\u0000   Doe  ", " ADMIN ", " ACTIVE "));

        verify(userMapper).countSearch("Jane Doe", "ADMIN", "ACTIVE");
    }

    @Test
    void countSearchConvertsBlankFiltersToNull() {
        when(userMapper.countSearch(null, null, null)).thenReturn(0L);

        assertEquals(0L, service.countSearch(" \u0000 ", " ", null));

        verify(userMapper).countSearch(null, null, null);
    }

    @Test
    void searchPageNormalizesFiltersAndUsesOffset() {
        when(userMapper.searchPage("Jane Doe", "ADMIN", "ACTIVE", 20, 40)).thenReturn(List.of());

        service.searchPage("  Jane\u0000   Doe  ", " ADMIN ", " ACTIVE ", 3, 20);

        verify(userMapper).searchPage("Jane Doe", "ADMIN", "ACTIVE", 20, 40);
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
    void adminSummaryUsesSingleAggregateMapperQueryContract() throws Exception {
        String userServiceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/UserService.java"));
        String userMapperSource = Files.readString(Path.of("src/main/java/com/example/shop/repository/UserMapper.java"));
        String mapperXml = Files.readString(Path.of("src/main/resources/mapper/UserMapper.xml"));
        int start = mapperXml.indexOf("<select id=\"adminSummary\"");
        int end = mapperXml.indexOf("</select>", start);
        assertTrue(start >= 0);
        assertTrue(end > start);
        String adminSummaryXml = mapperXml.substring(start, end);

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/UserServiceImpl.java")));
        assertFalse(userServiceSource.contains("getReportSummary"));
        assertFalse(userServiceSource.contains("countUsersByDateRange"));
        assertTrue(userServiceSource.contains("userMapper.adminSummary("));
        assertTrue(userMapperSource.contains("Map<String, Object> adminSummary"));
        assertTrue(adminSummaryXml.contains("COUNT(*) AS totalUsers"));
        assertTrue(adminSummaryXml.contains("SUM(CASE WHEN"));
        assertFalse(adminSummaryXml.contains("countUsersByDateRange"));
    }

    @Test
    void registerNormalizesFieldsAndChecksDuplicatesBeforeInsert() {
        User user = new User();
        user.setUsername("  NewUser  ");
        user.setPassword("StrongPass123");
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
        user.setPassword("StrongPass123");
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
        user.setPassword("StrongPass123");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email is required", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsMalformedEmailBeforeDatabaseConstraintFailure() {
        User missingAt = validRegistrationUser();
        missingAt.setEmail("abc");
        User missingPublicSuffix = validRegistrationUser();
        missingPublicSuffix.setEmail("buyer@example");

        IllegalArgumentException missingAtException = assertThrows(IllegalArgumentException.class, () -> service.register(missingAt));
        IllegalArgumentException missingSuffixException = assertThrows(IllegalArgumentException.class, () -> service.register(missingPublicSuffix));

        assertEquals("Email format is invalid", missingAtException.getMessage());
        assertEquals("Email format is invalid", missingSuffixException.getMessage());
        verify(userMapper, never()).insert(missingAt);
        verify(userMapper, never()).insert(missingPublicSuffix);
    }

    @Test
    void registerRejectsPasswordUnderMinimumLength() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("password");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Password must be 12 to 128 characters", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsCommonPassword() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("Password1234");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Password is too common", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsPasswordWithTooFewCharacterClasses() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("lowercase1234");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Password must include at least three of: lowercase letters, uppercase letters, numbers, and symbols",
                exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerAdminRejectsWeakPassword() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("password");
        admin.setEmail("admin@example.com");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.registerAdmin(admin));

        assertEquals("Admin password must be 12 to 128 characters", exception.getMessage());
        verify(userMapper, never()).insert(admin);
    }

    @Test
    void registerAdminRejectsBootstrapAfterAdminExists() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("StrongPass123");
        admin.setEmail("admin@example.com");
        when(userMapper.countAdminUsers()).thenReturn(1L);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.registerAdmin(admin));

        assertEquals("Admin bootstrap is already completed", exception.getMessage());
        verify(userMapper, never()).insert(admin);
        verify(passwordEncoder, never()).encode("StrongPass123");
        verify(userMapper).releaseAdminBootstrapLock();
    }

    @Test
    void registerAdminRejectsWhenBootstrapLockCannotBeAcquired() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword("StrongPass123");
        admin.setEmail("admin@example.com");
        when(userMapper.acquireAdminBootstrapLock()).thenReturn(0L);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> service.registerAdmin(admin));

        assertEquals("Admin bootstrap is currently locked", exception.getMessage());
        verify(userMapper, never()).countAdminUsers();
        verify(userMapper, never()).insert(admin);
        verify(userMapper, never()).releaseAdminBootstrapLock();
    }

    @Test
    void registerRejectsPhoneLongerThanUsersColumn() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("StrongPass123");
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
        user.setPassword("StrongPass123");
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
        user.setPassword("StrongPass123");
        user.setEmail("Taken@Example.COM");
        user.setPhone("15551234567");
        when(userMapper.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email already registered", exception.getMessage());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerRejectsDuplicateEmailBeforeMissingPhoneValidation() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("StrongPass123");
        user.setEmail("Taken@Example.COM");
        user.setPhone("   ");
        when(userMapper.findByUsernameOrPhoneOrEmail("taken@example.com")).thenReturn(new User());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email already registered", exception.getMessage());
        verify(userMapper, never()).findByPhone(any());
        verify(userMapper, never()).insert(user);
    }

    @Test
    void registerUpgradesGuestUserWithMatchingEmailInsteadOfBlockingRegistration() {
        User user = new User();
        user.setUsername("  NewUser  ");
        user.setPassword("StrongPass123");
        user.setEmail("  USER@Example.COM  ");
        user.setPhone("  15551234567  ");

        User guest = new User();
        guest.setId(18L);
        guest.setUsername("guest_user_example_com_12345678");
        guest.setEmail("user@example.com");
        guest.setStatus("GUEST");
        guest.setRole("USER");

        when(userMapper.findByUsernameOrPhoneOrEmail("user@example.com")).thenReturn(guest);

        service.register(user, true);

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
    void registerRejectsGuestEmailClaimWithoutVerification() {
        User user = new User();
        user.setUsername("NewUser");
        user.setPassword("StrongPass123");
        user.setEmail("user@example.com");
        user.setPhone("15551234567");

        User guest = new User();
        guest.setId(18L);
        guest.setUsername("guest_user_example_com_12345678");
        guest.setEmail("user@example.com");
        guest.setStatus("GUEST");
        guest.setRole("USER");

        when(userMapper.findByUsernameOrPhoneOrEmail("user@example.com")).thenReturn(guest);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.register(user));

        assertEquals("Email verification is required to claim guest checkout history", exception.getMessage());
        verify(userMapper, never()).update(any(User.class));
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
                () -> service.updatePassword(5L, "old-secret", "lowercase1234"));

        assertEquals("New password must include at least three of: lowercase letters, uppercase letters, numbers, and symbols",
                exception.getMessage());
        verify(userMapper, never()).findById(5L);
        verify(userMapper, never()).updatePassword(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updatePasswordRejectsOverlongOldPasswordBeforePasswordMatch() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updatePassword(5L, "O".repeat(129), "NewPass123456"));

        assertEquals("Current password is too long", exception.getMessage());
        verify(userMapper, never()).findById(5L);
        verify(passwordEncoder, never()).matches(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
        verify(userMapper, never()).updatePassword(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updatePasswordStoresStrongNewPasswordWhenOldPasswordMatches() {
        User user = new User();
        user.setId(5L);
        user.setPassword("encoded-old");
        when(userMapper.findById(5L)).thenReturn(user);
        when(passwordEncoder.matches("old-secret", "encoded-old")).thenReturn(true);

        service.updatePassword(5L, "old-secret", "NewPass123456");

        verify(userMapper).updatePassword(
                org.mockito.ArgumentMatchers.eq(5L),
                org.mockito.ArgumentMatchers.eq("encoded-newpass"),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updatePasswordRejectsWrongOldPasswordAsBusinessError() {
        User user = new User();
        user.setId(5L);
        user.setPassword("encoded-old");
        when(userMapper.findById(5L)).thenReturn(user);
        when(passwordEncoder.matches("wrong-secret", "encoded-old")).thenReturn(false);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.updatePassword(5L, "wrong-secret", "NewPass123456"));

        assertEquals("Current password is incorrect", exception.getMessage());
        verify(userMapper, never()).updatePassword(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void resetPasswordRejectsWeakNewPasswordBeforeAccountLookup() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> service.resetPassword("mia", "mia@example.com", "Password1234"));

        assertEquals("New password is too common", exception.getMessage());
        verify(userMapper, never()).findByUsernameOrPhoneOrEmail("mia");
        verify(userMapper, never()).updatePassword(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    private User validRegistrationUser() {
        User user = new User();
        user.setUsername("newuser");
        user.setPassword("StrongPass123");
        user.setEmail("new@example.com");
        user.setPhone("15551234567");
        return user;
    }
}
