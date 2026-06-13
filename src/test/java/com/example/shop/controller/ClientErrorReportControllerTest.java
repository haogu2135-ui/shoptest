package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.dto.ClientErrorReportRequest;
import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ClientErrorReportControllerTest {
    private final SystemAlertService systemAlertService = mock(SystemAlertService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new ClientErrorReportController(systemAlertService))
            .setControllerAdvice(new GlobalApiExceptionHandler(
                    new ApiErrorResponseFactory(),
                    mock(SystemAlertService.class)))
            .build();

    @Test
    void acceptsClientErrorReportsAndDelegatesToSystemAlerts() throws Exception {
        mockMvc.perform(post("/errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"context\":\"ErrorBoundary caught\",\"message\":\"Render failed\",\"path\":\"/checkout\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"));

        verify(systemAlertService).recordClientError(any(ClientErrorReportRequest.class), any());
    }

    @Test
    void rejectsBlankClientErrorReportsBeforeAlertWrite() throws Exception {
        mockMvc.perform(post("/errors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"context\":\"\",\"message\":\"\"}"))
                .andExpect(status().isBadRequest());

        verify(systemAlertService, never()).recordClientError(any(), any());
    }
}
