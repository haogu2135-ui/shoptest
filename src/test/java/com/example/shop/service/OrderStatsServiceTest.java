package com.example.shop.service;

import com.example.shop.repository.PaymentRepository;
import com.example.shop.repository.OrderRepository;
import com.example.shop.entity.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class OrderStatsServiceTest {
    private OrderRepository orderRepository;
    private RuntimeConfigService runtimeConfig;
    private OrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new OrderService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
    }

    @Test
    void countUsesDedicatedCountQuery() {
        when(orderRepository.countAll()).thenReturn(9L);

        assertEquals(9L, service.count());

        verify(orderRepository).countAll();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void totalRevenueUsesDatabaseAggregate() {
        when(orderRepository.sumTotalAmount()).thenReturn(new BigDecimal("128.50"));

        assertEquals(new BigDecimal("128.50"), service.getTotalRevenue());

        verify(orderRepository).sumTotalAmount();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void statusBreakdownUsesGroupedAggregate() {
        when(orderRepository.countByStatusGroup()).thenReturn(List.of(
                Map.of("status", "PENDING_SHIPMENT", "count", 3L),
                Map.of("status", "COMPLETED", "count", 7)
        ));

        assertEquals(Map.of("PENDING_SHIPMENT", 3L, "COMPLETED", 7L), service.getStatusBreakdown());

        verify(orderRepository).countByStatusGroup();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void dashboardOrderStatsUsesShortLivedCacheForImplicitNow() {
        LocalDateTime databaseNow = LocalDateTime.now()
                .withHour(12)
                .withMinute(0)
                .withSecond(0)
                .withNano(0);
        when(runtimeConfig.getLong("order.dashboard-stats-cache-ms", 5000L)).thenReturn(5000L);
        when(orderRepository.currentDatabaseTime()).thenReturn(databaseNow);
        when(orderRepository.dashboardOrderStats(any(LocalDateTime.class))).thenReturn(Map.of(
                "totalOrders", 2L,
                "paidOrders", 1L,
                "netRevenue", new BigDecimal("20.00"),
                "refundedAmount", BigDecimal.ZERO
        ));
        when(orderRepository.countByStatusGroup()).thenReturn(List.of(Map.of("status", "PENDING_PAYMENT", "count", 2L)));
        when(orderRepository.findRecentAdminOrders(5)).thenReturn(List.of());
        LocalDateTime trendStart = databaseNow.toLocalDate().minusDays(6).atStartOfDay();
        LocalDateTime trendEndExclusive = databaseNow.toLocalDate().plusDays(1).atStartOfDay();
        when(orderRepository.dashboardSalesTrend(trendStart, trendEndExclusive)).thenReturn(List.of());
        when(orderRepository.dashboardPaymentMethodBreakdown()).thenReturn(List.of());

        Map<String, Object> first = service.getDashboardOrderStats(null, 7, 5);
        Map<String, Object> second = service.getDashboardOrderStats(null, 7, 5);

        assertEquals(2L, first.get("totalOrders"));
        assertEquals(2L, second.get("totalOrders"));
        verify(orderRepository).currentDatabaseTime();
        verify(orderRepository).dashboardOrderStats(any(LocalDateTime.class));
        verify(orderRepository).countByStatusGroup();
        verify(orderRepository).findRecentAdminOrders(5);
        verify(orderRepository).dashboardSalesTrend(trendStart, trendEndExclusive);
        verify(orderRepository).dashboardPaymentMethodBreakdown();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void dashboardOrderStatsMapsAggregateRowsIntoOperationalMetrics() {
        LocalDateTime basis = LocalDateTime.of(2026, 6, 15, 10, 0);
        when(runtimeConfig.getLong("order.dashboard-stats-cache-ms", 5000L)).thenReturn(5000L);
        when(orderRepository.dashboardOrderStats(basis)).thenReturn(Map.of(
                "totalOrders", 10L,
                "paidOrders", 4L,
                "netRevenue", new BigDecimal("300.00"),
                "refundedOrders", 2L,
                "refundedAmount", new BigDecimal("100.00"),
                "grossOrderAmount", new BigDecimal("700.00"),
                "cancelledOrders", 1L,
                "pendingPaymentOrders", 3L,
                "pendingShipmentOrders", 4L,
                "shippedOrders", 5L,
                "ordersWithTracking", 3L,
                "ordersWithoutTracking", 2L,
                "completedOrders", 6L,
                "stalePendingPayment", 1L,
                "delayedShipment", 2L,
                "returnAwaitingShipment", 3L,
                "refundDue", 4L
        ));
        when(orderRepository.countByStatusGroup()).thenReturn(List.of(Map.of("status", "COMPLETED", "count", 6L)));
        when(orderRepository.findRecentAdminOrders(3)).thenReturn(List.of());
        LocalDateTime trendStart = LocalDateTime.of(2026, 6, 14, 0, 0);
        LocalDateTime trendEndExclusive = LocalDateTime.of(2026, 6, 16, 0, 0);
        when(orderRepository.dashboardSalesTrend(trendStart, trendEndExclusive)).thenReturn(List.of(Map.of(
                "trendDate", "2026-06-15",
                "orderCount", 2L,
                "revenue", new BigDecimal("33.50")
        )));
        when(orderRepository.dashboardPaymentMethodBreakdown()).thenReturn(List.of(Map.of(
                "paymentMethod", "card",
                "orderCount", 3L
        )));

        Map<String, Object> stats = service.getDashboardOrderStats(basis, 2, 3);

        assertEquals(10L, stats.get("totalOrders"));
        assertEquals(new BigDecimal("400.00"), stats.get("totalRevenue"));
        assertEquals(new BigDecimal("400.00"), stats.get("grossPaidRevenue"));
        assertEquals(new BigDecimal("300.00"), stats.get("netRevenue"));
        assertEquals(new BigDecimal("100.00"), stats.get("refundedAmount"));
        assertEquals(new BigDecimal("75.00"), stats.get("averageOrderValue"));
        assertEquals(new BigDecimal("40.00"), stats.get("conversionRate"));
        assertEquals(new BigDecimal("25.00"), stats.get("refundRate"));
        assertEquals(10L, stats.get("operationsSlaRiskTotal"));
        assertEquals(Map.of(
                "stalePendingPayment", 1L,
                "delayedShipment", 2L,
                "returnAwaitingShipment", 3L,
                "refundDue", 4L
        ), stats.get("operationsSlaRisks"));
        assertEquals(Map.of("COMPLETED", 6L), stats.get("orderStatusBreakdown"));
        assertEquals(Map.of("card", 3L), stats.get("paymentMethodBreakdown"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> salesTrend = (List<Map<String, Object>>) stats.get("salesTrend");
        assertEquals(2, salesTrend.size());
        assertEquals(Map.of("date", "2026-06-14", "orders", 0L, "revenue", BigDecimal.ZERO), salesTrend.get(0));
        assertEquals(Map.of("date", "2026-06-15", "orders", 2L, "revenue", new BigDecimal("33.50")), salesTrend.get(1));

        verify(orderRepository).dashboardOrderStats(basis);
        verify(orderRepository).countByStatusGroup();
        verify(orderRepository).findRecentAdminOrders(3);
        verify(orderRepository).dashboardSalesTrend(trendStart, trendEndExclusive);
        verify(orderRepository).dashboardPaymentMethodBreakdown();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void dashboardOrderStatsKeepsDerivedRatesAtZeroWhenThereAreNoOrders() {
        LocalDateTime basis = LocalDateTime.of(2026, 6, 15, 10, 0);
        when(runtimeConfig.getLong("order.dashboard-stats-cache-ms", 5000L)).thenReturn(5000L);
        when(orderRepository.dashboardOrderStats(basis)).thenReturn(Map.of());
        when(orderRepository.countByStatusGroup()).thenReturn(List.of());
        when(orderRepository.findRecentAdminOrders(1)).thenReturn(List.of());
        when(orderRepository.dashboardSalesTrend(LocalDateTime.of(2026, 6, 15, 0, 0),
                LocalDateTime.of(2026, 6, 16, 0, 0))).thenReturn(List.of());
        when(orderRepository.dashboardPaymentMethodBreakdown()).thenReturn(List.of());

        Map<String, Object> stats = service.getDashboardOrderStats(basis, 1, 1);

        assertEquals(BigDecimal.ZERO, stats.get("averageOrderValue"));
        assertEquals(BigDecimal.ZERO, stats.get("conversionRate"));
        assertEquals(BigDecimal.ZERO, stats.get("refundRate"));
        assertEquals(0L, stats.get("operationsSlaRiskTotal"));

        verify(orderRepository).dashboardOrderStats(basis);
        verify(orderRepository).countByStatusGroup();
        verify(orderRepository).findRecentAdminOrders(1);
        verify(orderRepository).dashboardSalesTrend(LocalDateTime.of(2026, 6, 15, 0, 0),
                LocalDateTime.of(2026, 6, 16, 0, 0));
        verify(orderRepository).dashboardPaymentMethodBreakdown();
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void dashboardSalesTrendMapperUsesBoundedDateWindow() throws Exception {
        String mapper = Files.readString(Path.of("src/main/resources/mapper/OrderMapper.xml"));
        int trendStart = mapper.indexOf("<select id=\"dashboardSalesTrend\"");
        int trendEnd = mapper.indexOf("</select>", trendStart);
        String trendQuery = mapper.substring(trendStart, trendEnd);

        assertTrue(trendQuery.contains("WHERE created_at &gt;= #{start}"));
        assertTrue(trendQuery.contains("AND created_at &lt; #{endExclusive}"));
        assertFalse(trendQuery.contains("WHERE created_at &gt;= #{start}\n        GROUP BY"),
                "dashboard sales trend must keep an upper date bound");
    }

    @Test
    void adminOrderSummaryUsesShortLivedCacheForBlankSearch() {
        when(runtimeConfig.getLong("order.admin-summary-cache-ms", 5000L)).thenReturn(5000L);
        when(orderRepository.countAdminOrderSummary(null)).thenReturn(Map.of(
                "NEEDS_ACTION", 4L,
                "SLA_OVERDUE", 1L
        ));

        Map<String, Long> first = service.countAdminOrderSummary(null);
        first.put("NEEDS_ACTION", 99L);
        Map<String, Long> second = service.countAdminOrderSummary(" ");

        assertEquals(99L, first.get("NEEDS_ACTION"));
        assertEquals(4L, second.get("NEEDS_ACTION"));
        assertEquals(1L, second.get("SLA_OVERDUE"));
        assertEquals(0L, second.get("REFUNDING"));
        verify(orderRepository).countAdminOrderSummary(null);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void adminOrderSummaryDoesNotCacheSearchRequests() {
        String escapedSearch = "return!_queue";
        when(orderRepository.countAdminOrderSummary(escapedSearch)).thenReturn(Map.of(
                "NEEDS_ACTION", 2L
        ));

        assertEquals(2L, service.countAdminOrderSummary("return_queue").get("NEEDS_ACTION"));
        assertEquals(2L, service.countAdminOrderSummary("return_queue").get("NEEDS_ACTION"));

        verify(orderRepository, times(2)).countAdminOrderSummary(escapedSearch);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void legacyOrderListUsesConfiguredPageLimit() {
        Order order = new Order();
        order.setStatus("PENDING_SHIPMENT");
        when(runtimeConfig.getInt("admin.orders.legacy-list-max-rows", 100)).thenReturn(75);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.searchAdminOrders(null, null, null, 0, 75)).thenReturn(List.of(order));

        assertEquals(1, service.getAllOrders().size());

        verify(orderRepository).searchAdminOrders(null, null, null, 0, 75);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void customerOrderPaginationUsesZeroBasedOffsets() {
        Order order = new Order();
        order.setStatus("PENDING_SHIPMENT");
        when(runtimeConfig.getInt("order.customer-page-max-size", 100)).thenReturn(100);
        when(runtimeConfig.getLong("order.return-window-days", 7)).thenReturn(7L);
        when(orderRepository.findByUserIdPage(7L, 40, 20)).thenReturn(List.of(order));

        assertEquals(1, service.getOrdersByUserId(7L, 2, 20).size());

        verify(orderRepository).findByUserIdPage(7L, 40, 20);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void adminOrderSearchEscapesLikeWildcards() {
        String escapedSearch = "100!%!_!!promo!\\code";
        when(orderRepository.searchAdminOrders(null, escapedSearch, null, 0, 20)).thenReturn(List.of());
        when(orderRepository.countAdminOrders(null, escapedSearch, null)).thenReturn(0);
        when(orderRepository.countAdminOrderSummary(escapedSearch)).thenReturn(Map.of());

        assertEquals(List.of(), service.searchAdminOrders(null, " 100%_!promo\\code ", null, 1, 20));
        assertEquals(0, service.countAdminOrders(null, "100%_!promo\\code", null));
        assertEquals(0L, service.countAdminOrderSummary("100%_!promo\\code").get("NEEDS_ACTION"));

        verify(orderRepository).searchAdminOrders(null, escapedSearch, null, 0, 20);
        verify(orderRepository).countAdminOrders(null, escapedSearch, null);
        verify(orderRepository).countAdminOrderSummary(escapedSearch);
        verifyNoMoreInteractions(orderRepository);
    }

    @Test
    void adminOrderSummaryMapperSkipsUserJoinUntilSearchIsPresent() throws Exception {
        String mapper = Files.readString(Path.of("src/main/resources/mapper/OrderMapper.xml"));
        int summaryStart = mapper.indexOf("<select id=\"countAdminOrderSummary\"");
        int filterStart = mapper.indexOf("<where>", summaryStart);
        String summaryFromClause = mapper.substring(summaryStart, filterStart);

        assertTrue(summaryFromClause.contains("<if test=\"search != null and search != ''\">"));
        assertTrue(summaryFromClause.contains("LEFT JOIN users ON users.id = orders.user_id"));
        assertFalse(summaryFromClause.contains("FROM orders\n        LEFT JOIN users"),
                "unfiltered admin order summary should not join every user row");
    }

    @Test
    void orderListPathsUsePagedJoinedCustomerQueriesWithoutPerOrderUserLookup() throws Exception {
        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));
        String orderController = Files.readString(Path.of("src/main/java/com/example/shop/controller/OrderController.java"));
        String adminController = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"));
        String mapper = Files.readString(Path.of("src/main/resources/mapper/OrderMapper.xml"));

        assertTrue(orderService.contains("orderRepository.findByUserIdPage(userId, offset, safeSize)"));
        assertTrue(orderService.contains("orderRepository.searchAdminOrders(blankToNull(status), searchLikeTerm(search), blankToNull(quick), offset, safeSize)"));
        assertTrue(adminController.contains("orderService.searchAdminOrders(safeStatus, safeSearch, safeQuick, safePage, safeSize)"));
        assertTrue(orderController.contains("customerOrderPageResponse(userDetails.getId(), safeCustomerOrderPage(page), safeCustomerOrderPageSize(size))"));
        assertTrue(mapper.contains("<include refid=\"orderCustomerSelectColumns\"/>"));
        assertTrue(mapper.contains("LEFT JOIN users ON users.id = orders.user_id"));
        assertTrue(mapper.contains("LIMIT #{limit} OFFSET #{offset}"));
        assertFalse(mapper.contains("<select id=\"findByUserId\""), "unbounded customer order mapper query should not ship");
        assertFalse(orderService.contains("orderRepository.findByUserId(userId)"), "customer order service should not use unbounded lookups");
        assertFalse(orderService.contains("userMapper"));
        assertFalse(orderController.contains("userMapper.selectById"));
        assertFalse(adminController.contains("userMapper.selectById"));
    }

    @Test
    void expiredOrderScanUsesTransactionTemplateInsteadOfLazySelfInjection() throws Exception {
        String orderService = Files.readString(Path.of("src/main/java/com/example/shop/service/OrderService.java"));

        assertFalse(orderService.contains("org.springframework.context.annotation.Lazy"));
        assertFalse(orderService.contains("private OrderService self"));
        assertFalse(orderService.contains("self.cancelSingleExpiredOrder"));
        assertTrue(orderService.contains("private PlatformTransactionManager transactionManager"));
        assertTrue(orderService.contains("new TransactionTemplate(transactionManager)"));
        assertTrue(orderService.contains("TransactionDefinition.PROPAGATION_REQUIRES_NEW"));
        assertTrue(orderService.contains("cancelSingleExpiredOrderInNewTransaction(order.getId())"));
    }

    @Test
    void expiredOrderScanPagesByLastSeenOrderId() {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        Order firstOrder = pendingPaymentOrder(1L);
        Order secondOrder = pendingPaymentOrder(2L);
        Order thirdOrder = pendingPaymentOrder(3L);

        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        when(runtimeConfig.getLong("order.unpaid-timeout-minutes", 30)).thenReturn(30L);
        when(runtimeConfig.getInt("order.expiry-scan-batch-size", 500)).thenReturn(2);
        when(orderRepository.findPendingPaymentBefore(any(LocalDateTime.class), isNull(), eq(2)))
                .thenReturn(List.of(firstOrder, secondOrder));
        when(orderRepository.findPendingPaymentBefore(any(LocalDateTime.class), eq(2L), eq(2)))
                .thenReturn(List.of(thirdOrder));
        when(orderRepository.findById(1L)).thenReturn(firstOrder);
        when(orderRepository.findById(2L)).thenReturn(secondOrder);
        when(orderRepository.findById(3L)).thenReturn(thirdOrder);
        when(paymentRepository.countActivePendingByOrderId(1L)).thenReturn(1L);
        when(paymentRepository.countActivePendingByOrderId(2L)).thenReturn(1L);
        when(paymentRepository.countActivePendingByOrderId(3L)).thenReturn(1L);

        OrderService.ExpiredOrderCancellationResult result = service.cancelExpiredUnpaidOrders();

        verify(orderRepository).findPendingPaymentBefore(any(LocalDateTime.class), isNull(), eq(2));
        verify(orderRepository).findPendingPaymentBefore(any(LocalDateTime.class), eq(2L), eq(2));
        verify(orderRepository, never()).findPendingPaymentBefore(any(LocalDateTime.class), eq(3L), eq(2));
        verify(paymentRepository).countActivePendingByOrderId(1L);
        verify(paymentRepository).countActivePendingByOrderId(2L);
        verify(paymentRepository).countActivePendingByOrderId(3L);
        assertEquals(3, result.getScannedCount());
        assertEquals(0, result.getCancelledCount());
        assertEquals(3, result.getSkippedCount());
        assertEquals(0, result.getFailedCount());
        assertEquals(List.of(), result.getFailedOrderIds());
    }

    @Test
    void expiredOrderScanLogsRowFailuresAndContinues(CapturedOutput output) {
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        Order failedOrder = pendingPaymentOrder(1L);
        Order nextOrder = pendingPaymentOrder(2L);

        ReflectionTestUtils.setField(service, "paymentRepository", paymentRepository);
        when(runtimeConfig.getLong("order.unpaid-timeout-minutes", 30)).thenReturn(30L);
        when(runtimeConfig.getInt("order.expiry-scan-batch-size", 500)).thenReturn(500);
        when(orderRepository.findPendingPaymentBefore(any(LocalDateTime.class), isNull(), eq(500)))
                .thenReturn(List.of(failedOrder, nextOrder));
        when(orderRepository.findById(1L)).thenReturn(failedOrder);
        when(orderRepository.findById(2L)).thenReturn(nextOrder);
        when(paymentRepository.countActivePendingByOrderId(1L)).thenThrow(new IllegalStateException("database unavailable"));
        when(paymentRepository.countActivePendingByOrderId(2L)).thenReturn(1L);

        OrderService.ExpiredOrderCancellationResult result = service.cancelExpiredUnpaidOrders();

        verify(paymentRepository).countActivePendingByOrderId(2L);
        String logs = output.getOut() + output.getErr();
        assertTrue(logs.contains("Skipping expired-order cancellation during scan for order 1"));
        assertEquals(2, result.getScannedCount());
        assertEquals(0, result.getCancelledCount());
        assertEquals(1, result.getSkippedCount());
        assertEquals(1, result.getFailedCount());
        assertEquals(List.of(1L), result.getFailedOrderIds());
        assertEquals("database unavailable", result.getFailureMessages().get(1L));
    }

    private Order pendingPaymentOrder(Long id) {
        Order order = new Order();
        order.setId(id);
        order.setStatus("PENDING_PAYMENT");
        order.setCreatedAt(LocalDateTime.now().minusHours(2));
        return order;
    }
}
