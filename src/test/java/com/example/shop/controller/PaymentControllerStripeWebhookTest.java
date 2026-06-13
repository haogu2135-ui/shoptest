package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentChannelRecommendationService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PaymentControllerStripeWebhookTest {

    private final PaymentService paymentService = mock(PaymentService.class);
    private final IpBlacklistService ipBlacklistService = mock(IpBlacklistService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new PaymentController(
                    paymentService,
                    mock(OrderService.class),
                    mock(SecurityAuditLogService.class),
                    new PaymentChannelConfig(),
                    mock(PaymentChannelRecommendationService.class),
                    ipBlacklistService,
                    mock(AdminRoleService.class)))
            .setControllerAdvice(new GlobalApiExceptionHandler(
                    new ApiErrorResponseFactory(),
                    mock(SystemAlertService.class)))
            .build();

    @Test
    void invalidStripeWebhookPayloadReturnsBadRequest() throws Exception {
        String invalidPayload = "{\"invalid\":\"data\"}";
        when(paymentService.handleStripeWebhook(eq(invalidPayload), any()))
                .thenThrow(new IllegalArgumentException("Invalid Stripe webhook signature"));

        mockMvc.perform(post("/payments/stripe/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Invalid Stripe webhook signature"));

        verify(ipBlacklistService).recordPaymentFailure(any(), eq("Invalid Stripe webhook signature"));
    }

    @Test
    void stripeWebhookServerMisconfigurationStillReturnsProviderUnavailable() throws Exception {
        String payload = "{\"invalid\":\"data\"}";
        when(paymentService.handleStripeWebhook(eq(payload), any()))
                .thenThrow(new IllegalStateException("Stripe webhook secret is not configured"));

        mockMvc.perform(post("/payments/stripe/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message", containsString("Payment provider is temporarily unavailable")));
    }
}
