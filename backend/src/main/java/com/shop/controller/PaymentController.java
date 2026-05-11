package com.shop.controller;

import com.shop.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@CrossOrigin(origins = "http://localhost:3000")
public class PaymentController {
    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createPayment(
            @RequestParam Long orderId,
            @RequestParam String method) {
        try {
            String paymentUrl = paymentService.createPayment(orderId, method);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("paymentUrl", paymentUrl);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/notify")
    public String handlePaymentNotify(@RequestParam Map<String, String> params) {
        String transactionId = params.get("out_trade_no");
        String status = "SUCCESS".equals(params.get("trade_status")) ? "SUCCESS" : "FAILED";
        paymentService.handlePaymentCallback(transactionId, status);
        return "success";
    }

    @GetMapping("/query/{orderId}")
    public ResponseEntity<?> queryPaymentStatus(@PathVariable Long orderId) {
        // 实现支付状态查询逻辑
        return ResponseEntity.ok().build();
    }
} 