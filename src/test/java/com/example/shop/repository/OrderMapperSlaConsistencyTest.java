package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderMapperSlaConsistencyTest {
    @Test
    void dashboardSlaThresholdsStayMapperOwnedAndConsistent() throws Exception {
        String orderService = Files.readString(Paths.get("src/main/java/com/example/shop/service/OrderService.java"), StandardCharsets.UTF_8);
        String mapper = Files.readString(Paths.get("src/main/resources/mapper/OrderMapper.xml"), StandardCharsets.UTF_8);

        assertFalse(orderService.contains("countByAgeBucket("),
                "Dashboard SLA buckets should not be duplicated in OrderService");
        assertFalse(orderService.contains("minusDays(14)") || orderService.contains("minusDays(30)"),
                "Dashboard SLA day thresholds should stay in the mapper query contract");

        assertTrue(mapper.contains("stalePendingPayment"));
        assertTrue(mapper.contains("delayedShipment"));
        assertTrue(mapper.contains("returnAwaitingShipment"));
        assertTrue(mapper.contains("refundDue"));
        assertConsistentSlaThreshold(mapper, "PENDING_PAYMENT", "INTERVAL 30 MINUTE", "INTERVAL 20 MINUTE");
        assertConsistentSlaThreshold(mapper, "PENDING_SHIPMENT", "INTERVAL 24 HOUR", "INTERVAL 18 HOUR");
        assertConsistentSlaThreshold(mapper, "RETURN_REQUESTED", "INTERVAL 24 HOUR", "INTERVAL 18 HOUR");
        assertConsistentSlaThreshold(mapper, "RETURN_APPROVED", "INTERVAL 3 DAY", "INTERVAL 2 DAY");
        assertConsistentSlaThreshold(mapper, "RETURN_SHIPPED", "INTERVAL 24 HOUR", "INTERVAL 18 HOUR");
    }

    @Test
    void returnShippedRefundSlaUsesTwentyFourHoursEverywhere() throws Exception {
        String mapper = Files.readString(Paths.get("src/main/resources/mapper/OrderMapper.xml"), StandardCharsets.UTF_8);
        List<String> returnShippedSlaLines = mapper.lines()
                .filter(line -> line.contains("RETURN_SHIPPED") && line.contains("INTERVAL"))
                .collect(Collectors.toList());

        assertTrue(returnShippedSlaLines.size() >= 5);
        assertFalse(returnShippedSlaLines.stream()
                .anyMatch(line -> line.contains("INTERVAL 3 DAY") || line.contains("INTERVAL 66 HOUR")));
        assertTrue(returnShippedSlaLines.stream()
                .anyMatch(line -> line.contains("refundDue") && line.contains("INTERVAL 24 HOUR")));
        assertTrue(returnShippedSlaLines.stream()
                .anyMatch(line -> line.contains("SLA_DUE_SOON") || line.contains("INTERVAL 18 HOUR")));
    }

    @Test
    void refundingQuickFilterIncludesReturnRefundingOrderStatus() throws Exception {
        String mapper = Files.readString(Paths.get("src/main/resources/mapper/OrderMapper.xml"), StandardCharsets.UTF_8);

        assertTrue(mapper.contains("<when test=\"quick == 'REFUNDING'\">"));
        assertTrue(mapper.contains("orders.status = 'RETURN_REFUNDING'"));
        assertTrue(mapper.contains(") AS REFUNDING"));
    }

    @Test
    void guestOrderEmailLookupEscapesLegacyShippingAddressLikeTerm() throws Exception {
        String mapper = Files.readString(Paths.get("src/main/resources/mapper/OrderMapper.xml"), StandardCharsets.UTF_8);

        assertTrue(mapper.contains("LOWER(orders.shipping_address) LIKE CONCAT('% / ', LOWER(#{emailLike}), ' /%') ESCAPE '!'"));
        assertTrue(mapper.contains("AND #{emailLike} IS NOT NULL"));
    }

    private void assertConsistentSlaThreshold(String mapper, String status, String overdueThreshold, String dueSoonThreshold) {
        List<String> statusLines = mapper.lines()
                .filter(line -> line.contains(status) && line.contains("DATE_SUB"))
                .collect(Collectors.toList());

        assertTrue(statusLines.stream().anyMatch(line -> line.contains(overdueThreshold)),
                status + " must use the same overdue threshold in dashboard stats and admin filters");
        assertTrue(statusLines.stream().anyMatch(line -> line.contains(dueSoonThreshold)),
                status + " must keep a matching due-soon threshold");
    }
}
