package com.example.shop.controller;

import com.example.shop.dto.ForgotPasswordRequest;
import com.example.shop.entity.User;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.EmailLoginService.EmailLoginException;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuthControllerForgotPasswordTest {
    private UserService userService;
    private EmailLoginService emailLoginService;
    private ClientIpResolver clientIpResolver;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        emailLoginService = mock(EmailLoginService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        controller = new AuthController(userService, emailLoginService, clientIpResolver, mock(IpBlacklistService.class));
    }

    @Test
    void forgotPasswordRequiresVerifiedEmailCodeBeforeResettingPassword() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/forgot-password");
        ForgotPasswordRequest request = resetRequest("mia", "MIA@example.com", "123456");
        User verifiedUser = verifiedUser(7L, "mia", "5550100", "mia@example.com");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.10");
        when(emailLoginService.verifyPasswordResetCode("MIA@example.com", "123456", "203.0.113.10"))
                .thenReturn(verifiedUser);

        ResponseEntity<?> response = controller.forgotPassword(request, servletRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Password reset successfully", ((Map<?, ?>) response.getBody()).get("message"));
        verify(userService).resetPassword("mia", "MIA@example.com", "new-secret");
    }

    @Test
    void forgotPasswordDoesNotResetWhenVerificationCodeIsInvalid() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/forgot-password");
        ForgotPasswordRequest request = resetRequest("mia", "mia@example.com", "111111");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.11");
        when(emailLoginService.verifyPasswordResetCode("mia@example.com", "111111", "203.0.113.11"))
                .thenThrow(new EmailLoginException("INVALID_CODE", "Verification code expired or invalid", 0));

        ResponseEntity<?> response = controller.forgotPassword(request, servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("INVALID_CODE", ((Map<?, ?>) response.getBody()).get("code"));
        verifyNoInteractions(userService);
    }

    @Test
    void forgotPasswordDoesNotResetWhenVerifiedEmailBelongsToAnotherLogin() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/forgot-password");
        ForgotPasswordRequest request = resetRequest("mia", "mia@example.com", "123456");
        User verifiedUser = verifiedUser(8L, "other-user", "5550199", "mia@example.com");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.12");
        when(emailLoginService.verifyPasswordResetCode("mia@example.com", "123456", "203.0.113.12"))
                .thenReturn(verifiedUser);

        ResponseEntity<?> response = controller.forgotPassword(request, servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Password reset failed. Please verify the account information and code.", ((Map<?, ?>) response.getBody()).get("error"));
        assertEquals("RESET_FAILED", ((Map<?, ?>) response.getBody()).get("code"));
        verifyNoInteractions(userService);
    }

    private ForgotPasswordRequest resetRequest(String login, String email, String code) {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setLogin(login);
        request.setEmail(email);
        request.setCode(code);
        request.setNewPassword("new-secret");
        return request;
    }

    private User verifiedUser(Long id, String username, String phone, String email) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setPhone(phone);
        user.setEmail(email);
        return user;
    }
}
