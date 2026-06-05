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
}
