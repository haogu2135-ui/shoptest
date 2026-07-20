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

class PaymentControllerMercadoPagoWebhookTest {

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
    void invalidMercadoPagoWebhookSignatureReturnsBadRequest() throws Exception {
        String payload = "{\"type\":\"payment\",\"data\":{\"id\":\"123\"}}";
        when(paymentService.handleMercadoPagoWebhook(eq(payload), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("Invalid Mercado Pago webhook signature"));

        mockMvc.perform(post("/payments/mercado-pago/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("x-signature", "ts=1,v1=bad")
                        .header("x-request-id", "req-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Invalid Mercado Pago webhook signature"));

        verify(ipBlacklistService).recordPaymentFailure(any(), eq("Invalid Mercado Pago webhook signature"));
    }

    @Test
    void mercadoPagoWebhookMisconfigurationReturnsProviderUnavailable() throws Exception {
        String payload = "{\"type\":\"payment\",\"data\":{\"id\":\"123\"}}";
        when(paymentService.handleMercadoPagoWebhook(eq(payload), any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("Mercado Pago webhook secret is not configured"));

        mockMvc.perform(post("/payments/mercado-pago/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message", containsString("Payment provider is temporarily unavailable")));
    }
}
