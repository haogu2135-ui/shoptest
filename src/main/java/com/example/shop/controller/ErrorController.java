package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/error")
public class ErrorController {
    private final ApiErrorResponseFactory errorResponses;

    public ErrorController(ApiErrorResponseFactory errorResponses) {
        this.errorResponses = errorResponses;
    }

    @GetMapping("/403")
    public ResponseEntity<Map<String, Object>> accessDenied(HttpServletRequest request) {
        return errorResponses.buildResponse(HttpStatus.FORBIDDEN, "Forbidden", request);
    }

    @GetMapping("/404")
    public ResponseEntity<Map<String, Object>> notFound(HttpServletRequest request) {
        return errorResponses.buildResponse(HttpStatus.NOT_FOUND, "Not Found", request);
    }

    @GetMapping("/500")
    public ResponseEntity<Map<String, Object>> serverError(HttpServletRequest request) {
        return errorResponses.buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", request);
    }
}
