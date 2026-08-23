package com.example.shop.dto;

import org.junit.jupiter.api.Test;

import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentCallbackRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsCallbackValuesWithinPaymentStorageAndHmacContracts() {
        PaymentCallbackRequest request = validRequest();

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsOversizedIdentifiersAndReferencesBeforeServiceLogic() {
        PaymentCallbackRequest request = validRequest();
        request.setOrderNo("O".repeat(33));
        request.setChannel("C".repeat(31));
        request.setTransactionId("T".repeat(65));
        request.setStatus("S".repeat(21));
        request.setProviderReference("R".repeat(129));

        Set<ConstraintViolation<PaymentCallbackRequest>> violations = validator.validate(request);

        assertTrue(hasViolation(violations, "orderNo"));
        assertTrue(hasViolation(violations, "channel"));
        assertTrue(hasViolation(violations, "transactionId"));
        assertTrue(hasViolation(violations, "status"));
        assertTrue(hasViolation(violations, "providerReference"));
    }

    @Test
    void rejectsAmountsAndTimestampsOutsideAcceptedCallbackRange() {
        PaymentCallbackRequest request = validRequest();
        request.setAmount(new BigDecimal("100000000.00"));
        request.setCallbackTimestamp(4102444801L);
        request.setSignature("not-a-hex-signature");

        Set<ConstraintViolation<PaymentCallbackRequest>> violations = validator.validate(request);

        assertTrue(hasViolation(violations, "amount"));
        assertTrue(hasViolation(violations, "callbackTimestamp"));
        assertTrue(hasViolation(violations, "signature"));

        request.setAmount(new BigDecimal("10.001"));
        request.setCallbackTimestamp(-1L);
        assertTrue(hasViolation(validator.validate(request), "amount"));
        assertTrue(hasViolation(validator.validate(request), "callbackTimestamp"));
    }

    private PaymentCallbackRequest validRequest() {
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setOrderNo("SO202608230001");
        request.setChannel("STRIPE");
        request.setTransactionId("txn_123");
        request.setStatus("SUCCESS");
        request.setAmount(new BigDecimal("100.00"));
        request.setProviderReference("pi_123");
        request.setCallbackTimestamp(Instant.now().getEpochSecond());
        request.setSignature("a".repeat(64));
        return request;
    }

    private boolean hasViolation(Set<ConstraintViolation<PaymentCallbackRequest>> violations, String field) {
        return violations.stream().anyMatch(violation -> field.contentEquals(violation.getPropertyPath().toString()));
    }
}
