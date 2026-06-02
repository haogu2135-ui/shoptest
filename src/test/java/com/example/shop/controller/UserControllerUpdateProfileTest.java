package com.example.shop.controller;

import com.example.shop.dto.UpdateProfileRequest;
import com.example.shop.entity.User;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class UserControllerUpdateProfileTest {
    private UserService userService;
    private EmailLoginService emailLoginService;
    private ClientIpResolver clientIpResolver;
    private UserController controller;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        emailLoginService = mock(EmailLoginService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        controller = new UserController(
                userService,
                mock(RuntimeConfigService.class),
                mock(SecurityAuditLogService.class),
                emailLoginService,
                clientIpResolver,
                mock(IpBlacklistService.class));
        objectMapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Test
    void updateProfileOnlyPassesOwnedContactFieldsToService() throws Exception {
        UpdateProfileRequest request = objectMapper.readValue("{"
                + "\"email\":\"new@example.com\","
                + "\"phone\":\"5550101\","
                + "\"username\":\"attacker\","
                + "\"password\":\"new-password\","
                + "\"role\":\"ADMIN\","
                + "\"status\":\"BANNED\","
                + "\"emailCode\":\"123456\""
                + "}", UpdateProfileRequest.class);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("PUT", "/users/profile");
        when(userService.findById(42L)).thenReturn(user(42L, "old@example.com"));
        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.20");

        controller.updateProfile(request, authentication(42L), servletRequest);

        verify(emailLoginService).verifyProfileEmailChangeCode(42L, "new@example.com", "123456", "203.0.113.20");
        verify(userService).updateProfileContact(42L, "new@example.com", "5550101");
    }

    @Test
    void updateProfileDoesNotRequireEmailCodeWhenEmailIsUnchanged() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("CURRENT@example.com");
        request.setPhone("5550101");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("PUT", "/users/profile");
        when(userService.findById(42L)).thenReturn(user(42L, "current@example.com"));

        controller.updateProfile(request, authentication(42L), servletRequest);

        verifyNoInteractions(emailLoginService);
        verify(userService).updateProfileContact(42L, "CURRENT@example.com", "5550101");
    }

    @Test
    void updateProfileRejectsChangedEmailWithoutValidCode() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("new@example.com");
        request.setPhone("5550101");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("PUT", "/users/profile");

        when(userService.findById(42L)).thenReturn(user(42L, "old@example.com"));
        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.21");
        org.mockito.Mockito.doThrow(new EmailLoginException("INVALID_CODE", "Verification code expired or invalid", 0))
                .when(emailLoginService).verifyProfileEmailChangeCode(42L, "new@example.com", null, "203.0.113.21");

        assertThrows(EmailLoginException.class, () -> controller.updateProfile(request, authentication(42L), servletRequest));

        verify(userService, never()).updateProfileContact(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void sendProfileEmailCodeReturnsConflictBeforeSendingForDuplicateEmail() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("taken@example.com");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/users/profile/email-code");

        when(userService.findById(42L)).thenReturn(user(42L, "old@example.com"));
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Email already registered"))
                .when(emailLoginService).sendProfileEmailChangeCode(42L, "taken@example.com", "203.0.113.22");
        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.22");

        ResponseEntity<?> response = controller.sendProfileEmailCode(request, authentication(42L), servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Email already registered", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void updateProfileRejectsMissingAuthenticatedUser() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("new@example.com");
        request.setPhone("5550101");

        assertThrows(ResponseStatusException.class, () -> controller.updateProfile(request, null, new MockHttpServletRequest()));
        verifyNoInteractions(userService);
    }

    private Authentication authentication(Long userId) {
        UserDetailsImpl principal = new UserDetailsImpl(
                userId,
                "mia",
                "mia@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    private User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }
}
