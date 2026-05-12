package com.example.shop.service;

import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RefundService {
    @Autowired
    private PaymentRepository paymentRepository;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    public void refundPaidPayment(Order order) {
        Payment payment = paymentRepository.findLatestPaidByOrderId(order.getId());
        if (payment == null) {
            return;
        }
        if ("STRIPE".equals(payment.getChannel())) {
            refundStripePayment(order, payment);
        }
        paymentRepository.markRefunded(payment.getId());
    }

    private void refundStripePayment(Order order, Payment payment) {
        if (isBlank(stripeSecretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        if (isBlank(payment.getTransactionId())) {
            throw new IllegalStateException("Stripe payment intent is missing");
        }
        try {
            Stripe.apiKey = stripeSecretKey;
            Refund.create(RefundCreateParams.builder()
                    .setPaymentIntent(payment.getTransactionId())
                    .build(),
                    RequestOptions.builder()
                            .setIdempotencyKey("return-refund-" + order.getId() + "-" + payment.getId())
                            .build());
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe refund failed: " + e.getMessage());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
