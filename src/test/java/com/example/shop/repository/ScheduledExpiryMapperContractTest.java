package com.example.shop.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class ScheduledExpiryMapperContractTest {

    @Test
    void scheduledExpiryRepositoryMethodsRequireSeekLimitParameters() throws Exception {
        Method paymentMethod = PaymentRepository.class.getMethod("findExpiredPending", Long.class, int.class);
        Method orderMethod = OrderRepository.class.getMethod(
                "findPendingPaymentBefore",
                LocalDateTime.class,
                Long.class,
                int.class);

        assertEquals(List.class, paymentMethod.getReturnType());
        assertEquals(List.class, orderMethod.getReturnType());
        assertFalse(Arrays.stream(PaymentRepository.class.getMethods())
                        .anyMatch(method -> "findExpiredPending".equals(method.getName())
                                && method.getParameterCount() == 0),
                "payment expiry scan must not expose an unbounded repository method");
        assertFalse(Arrays.stream(OrderRepository.class.getMethods())
                        .anyMatch(method -> "findPendingPaymentBefore".equals(method.getName())
                                && method.getParameterCount() == 1),
                "order expiry scan must not expose a cutoff-only repository method");
    }

    @Test
    void scheduledExpirySqlUsesSeekPaginationAndLimit() throws Exception {
        String paymentMapper = Files.readString(
                Path.of("src/main/resources/mapper/PaymentMapper.xml"),
                StandardCharsets.UTF_8);
        String orderMapper = Files.readString(
                Path.of("src/main/resources/mapper/OrderMapper.xml"),
                StandardCharsets.UTF_8);

        assertSeekLimitedSelect(paymentMapper, "findExpiredPending");
        assertSeekLimitedSelect(orderMapper, "findPendingPaymentBefore");
    }

    private void assertSeekLimitedSelect(String mapper, String selectId) {
        String select = block(mapper, "<select id=\"" + selectId + "\"", "</select>");

        assertTrue(select.contains("<if test=\"afterId != null\">"),
                selectId + " must only apply the seek cursor after the first page");
        assertTrue(select.contains("AND id &gt; #{afterId}"),
                selectId + " must advance with id seek pagination");
        assertTrue(select.contains("ORDER BY id ASC"),
                selectId + " must use stable ascending id order for seek pagination");
        assertTrue(select.contains("LIMIT #{limit}"),
                selectId + " must apply the configured batch limit");
    }

    private String block(String source, String startToken, String endToken) {
        int start = source.indexOf(startToken);
        assertTrue(start >= 0, () -> "Missing mapper block: " + startToken);
        int end = source.indexOf(endToken, start);
        assertTrue(end > start, () -> "Missing mapper block terminator: " + endToken);
        return source.substring(start, end).replaceAll("\\s+", " ").trim();
    }
}
