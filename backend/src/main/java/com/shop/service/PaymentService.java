package com.shop.service;

import com.alipay.api.AlipayClient;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.shop.entity.Order;
import com.shop.entity.Payment;
import com.shop.repository.OrderRepository;
import com.shop.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentService {
    private final AlipayClient alipayClient;
    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final String backendBaseUrl;
    private final String storefrontBaseUrl;

    public PaymentService(
            AlipayClient alipayClient,
            PaymentRepository paymentRepository,
            OrderRepository orderRepository,
            @Value("${app.backend-base-url:http://158.101.11.223:8081}") String backendBaseUrl,
            @Value("${app.storefront-base-url:https://pet.686888666.xyz}") String storefrontBaseUrl) {
        this.alipayClient = alipayClient;
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.backendBaseUrl = normalizeBaseUrl(backendBaseUrl, "http://158.101.11.223:8081");
        this.storefrontBaseUrl = normalizeBaseUrl(storefrontBaseUrl, "https://pet.686888666.xyz");
    }

    @Transactional
    public String createPayment(Long orderId, String method) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("订单不存在"));

        Payment payment = new Payment();
        payment.setOrderId(orderId);
        payment.setAmount(order.getTotalAmount());
        payment.setMethod(method);
        payment.setStatus("PENDING");
        payment.setTransactionId(UUID.randomUUID().toString());
        paymentRepository.save(payment);

        if ("alipay".equals(method)) {
            return createAlipayPayment(order, payment);
        } else if ("wechat".equals(method)) {
            // 实现微信支付逻辑
            throw new RuntimeException("微信支付暂未实现");
        } else {
            throw new RuntimeException("不支持的支付方式");
        }
    }

    private String createAlipayPayment(Order order, Payment payment) throws Exception {
        AlipayTradePagePayRequest request = new AlipayTradePagePayRequest();
        request.setNotifyUrl(backendBaseUrl + "/api/payment/notify");
        request.setReturnUrl(storefrontBaseUrl + "/payment/result");

        String bizContent = String.format(
            "{\"out_trade_no\":\"%s\"," +
            "\"total_amount\":\"%.2f\"," +
            "\"subject\":\"订单 %d\"," +
            "\"product_code\":\"FAST_INSTANT_TRADE_PAY\"}",
            payment.getTransactionId(),
            order.getTotalAmount().doubleValue(),
            order.getId()
        );
        request.setBizContent(bizContent);

        return alipayClient.pageExecute(request).getBody();
    }

    private String normalizeBaseUrl(String value, String fallback) {
        String normalized = value == null ? "" : value.trim().replaceAll("/+$", "");
        return normalized.isEmpty() ? fallback : normalized;
    }

    @Transactional
    public void handlePaymentCallback(String transactionId, String status) {
        Payment payment = paymentRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new RuntimeException("支付记录不存在"));

        payment.setStatus(status);
        paymentRepository.save(payment);

        if ("SUCCESS".equals(status)) {
            Order order = orderRepository.findById(payment.getOrderId())
                    .orElseThrow(() -> new RuntimeException("订单不存在"));
            order.setStatus("PAID");
            orderRepository.save(order);
        }
    }

    public Map<String, Object> getPaymentStatus(Long orderId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new RuntimeException("Payment record not found"));
        Map<String, Object> result = new HashMap<>();
        result.put("orderId", payment.getOrderId());
        result.put("amount", payment.getAmount());
        result.put("method", payment.getMethod());
        result.put("status", payment.getStatus());
        result.put("transactionId", payment.getTransactionId());
        result.put("createdAt", payment.getCreatedAt());
        return result;
    }
} 
