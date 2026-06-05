package com.example.shop.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderServiceDashboardStatusesTest {
    @Test
    void dashboardRevenueStatusesIncludeReturnRefunding() {
        assertTrue(new OrderService().dashboardRevenueStatuses().contains("RETURN_REFUNDING"));
    }
}
