package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.entity.User;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.SystemAlertService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerRegisterTest {

    private final UserService userService = mock(UserService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new AuthController(
                    userService,
                    mock(EmailLoginService.class),
                    mock(ClientIpResolver.class),
                    mock(IpBlacklistService.class)))
            .setControllerAdvice(new GlobalApiExceptionHandler(
                    new ApiErrorResponseFactory(),
                    mock(SystemAlertService.class)))
            .build();

    @Test
    void registerRejectsPasswordShorterThanStrongPolicyBeforeService() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newuser\",\"password\":\"Password1\",\"email\":\"new@example.com\",\"phone\":\"15551234567\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Password must be 12 to 128 characters")));

        verify(userService, never()).register(any(User.class), anyBoolean());
    }

    @Test
    void registerReportsDuplicateEmailBeforeBlankPhoneValidation() throws Exception {
        when(userService.register(any(User.class), eq(false)))
                .thenThrow(new IllegalArgumentException("Email already registered"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newuser\",\"password\":\"StrongPass123\",\"email\":\"taken@example.com\",\"phone\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Registration could not be completed with the supplied account details"))
                .andExpect(jsonPath("$.code").value("ACCOUNT_DETAILS_UNAVAILABLE"));

        verify(userService).register(any(User.class), eq(false));
    }

    @Test
    void registerMasksDuplicateUsernameAsUnavailableAccountDetails() throws Exception {
        when(userService.register(any(User.class), eq(false)))
                .thenThrow(new IllegalArgumentException("Username already registered"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"taken\",\"password\":\"StrongPass123\",\"email\":\"new@example.com\",\"phone\":\"15551234567\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Registration could not be completed with the supplied account details"))
                .andExpect(jsonPath("$.code").value("ACCOUNT_DETAILS_UNAVAILABLE"));
    }

    @Test
    void registerMasksDuplicatePhoneAsUnavailableAccountDetails() throws Exception {
        when(userService.register(any(User.class), eq(false)))
                .thenThrow(new IllegalArgumentException("Phone number already registered"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newuser\",\"password\":\"StrongPass123\",\"email\":\"new@example.com\",\"phone\":\"15551234567\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Registration could not be completed with the supplied account details"))
                .andExpect(jsonPath("$.code").value("ACCOUNT_DETAILS_UNAVAILABLE"));
    }

    @Test
    void registerStillRejectsBlankPhoneWhenAccountIsAvailable() throws Exception {
        when(userService.register(any(User.class), eq(false)))
                .thenThrow(new IllegalArgumentException("Phone number is required"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newuser\",\"password\":\"StrongPass123\",\"email\":\"new@example.com\",\"phone\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Phone number is required"));
    }
}
