package com.example.shop.controller;

import com.example.shop.dto.ClientErrorReportRequest;
import com.example.shop.service.SystemAlertService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.Map;

@RestController
public class ClientErrorReportController {
    private final SystemAlertService systemAlertService;

    public ClientErrorReportController(SystemAlertService systemAlertService) {
        this.systemAlertService = systemAlertService;
    }

    @PostMapping("/errors")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> report(@Valid @RequestBody(required = false) ClientErrorReportRequest body,
                                      HttpServletRequest request) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Error report is required");
        }
        systemAlertService.recordClientError(body, request);
        return Map.of("status", "accepted");
    }
}
