package com.example.shop.dto;

import com.example.shop.entity.Payment;
import lombok.Data;

@Data
public class PaymentResponse extends PaymentCustomerResponse {
    private String refundReference;

    public static PaymentResponse from(Payment payment) {
        PaymentResponse response = new PaymentResponse();
        populateCustomerFields(payment, response);
        response.setRefundReference(isRefunded(payment) ? payment.getRefundReference() : null);
        return response;
    }

    private static boolean isRefunded(Payment payment) {
        return payment != null && "REFUNDED".equalsIgnoreCase(String.valueOf(payment.getStatus()));
    }
}
