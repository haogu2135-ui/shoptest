package com.example.shop.service;

import com.example.shop.dto.SupportAdminSummaryResponse;
import com.example.shop.entity.SupportMessage;
import com.example.shop.entity.SupportSession;
import com.example.shop.repository.SupportMessageMapper;
import com.example.shop.repository.SupportSessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupportServiceTest {
    private SupportSessionMapper supportSessionMapper;
    private SupportMessageMapper supportMessageMapper;
    private RuntimeConfigService runtimeConfig;
    private SupportService service;

    @BeforeEach
    void setUp() {
        supportSessionMapper = mock(SupportSessionMapper.class);
        supportMessageMapper = mock(SupportMessageMapper.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("support.websocket.max-message-chars", 1000)).thenReturn(1000);
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(80);
        when(runtimeConfig.getInt("support.admin.stale-minutes", 30)).thenReturn(45);
        when(runtimeConfig.getBoolean("support.message.rate-limit-enabled", true)).thenReturn(false);
        service = new SupportService(supportSessionMapper, supportMessageMapper, runtimeConfig);

        SupportSession session = new SupportSession();
        session.setId(12L);
        session.setUserId(5L);
        session.setStatus("OPEN");
        session.setAssignedAdminId(7L);
        when(supportSessionMapper.findById(12L)).thenReturn(session);
    }

    @Test
    void normalizesSupportMessageBeforeSaving() {
        SupportMessage sent = service.sendMessage(12L, 5L, "USER", "  Need\thelp\nwith\u0000delivery.  ");

        assertEquals("Need help with delivery.", sent.getContent());
        verify(supportMessageMapper).insert(any(SupportMessage.class));
    }

    @Test
    void neutralizesSupportMessageHtmlBeforeSaving() {
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(200);
        SupportMessage sent = service.sendMessage(
                12L,
                5L,
                "USER",
                " <script>alert(1)</script> &lt;img src=x onerror=alert(2)&gt; "
                        + "&amp;lt;svg onload=alert(3)&amp;gt; A & B ");

        assertEquals(
                "\uFF1Cscript\uFF1Ealert(1)\uFF1C/script\uFF1E "
                        + "\uFF1Cimg src=x onerror=alert(2)\uFF1E "
                        + "\uFF1Csvg onload=alert(3)\uFF1E A & B",
                sent.getContent());
        assertFalse(sent.getContent().contains("<"));
        assertFalse(sent.getContent().contains(">"));
        verify(supportMessageMapper).insert(any(SupportMessage.class));
    }

    @Test
    void neutralizesHtmlAcrossCustomerGuestAndAdminMessageEntrypoints() {
        when(runtimeConfig.getInt("support.message.max-chars", 1000)).thenReturn(300);
        SupportSession guestSession = new SupportSession();
        guestSession.setId(99L);
        guestSession.setUserId(5L);
        guestSession.setContextKey("guest-order:so202606080001");
        guestSession.setStatus("OPEN");
        when(supportSessionMapper.findOpenByUserIdAndContextKey(5L, "guest-order:so202606080001"))
                .thenReturn(guestSession);
        when(supportSessionMapper.findById(99L)).thenReturn(guestSession);

        SupportMessage customerMessage = service.sendUserMessage(
                5L,
                12L,
                " <script>alert(1)</script> ");
        SupportMessage guestMessage = service.sendUserMessage(
                5L,
                null,
                " &lt;img src=x onerror=alert(2)&gt; ",
                "guest-order:SO202606080001");
        SupportMessage adminMessage = service.sendAdminMessage(
                7L,
                12L,
                " &amp;lt;svg onload=alert(3)&amp;gt; ",
                "ADMIN");

        assertEquals("\uFF1Cscript\uFF1Ealert(1)\uFF1C/script\uFF1E", customerMessage.getContent());
        assertEquals("\uFF1Cimg src=x onerror=alert(2)\uFF1E", guestMessage.getContent());
        assertEquals("\uFF1Csvg onload=alert(3)\uFF1E", adminMessage.getContent());
        assertNoRawAngles(customerMessage.getContent());
        assertNoRawAngles(guestMessage.getContent());
        assertNoRawAngles(adminMessage.getContent());
        verify(supportMessageMapper, times(3)).insert(any(SupportMessage.class));
    }

    @Test
    void rejectsOverlongSupportMessageBeforeSaving() {
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(12L, 5L, "USER", "x".repeat(81)));
    }

    @Test
    void rejectsBlankSupportMessageAfterNormalization() {
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage(12L, 5L, "USER", "\u0000 \t\n"));
    }

    @Test
    void findOpenSessionDoesNotCreateSession() {
        service.findOpenSession(5L);

        verify(supportSessionMapper).findOpenByUserId(5L);
        verify(supportSessionMapper, never()).insert(any(SupportSession.class));
    }

    @Test
    void guestSupportSessionCreationUsesOrderScopedLockInsteadOfAnonymousSequencing() throws Exception {
        String controllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/SupportController.java"));
        String serviceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/SupportService.java"));

        assertTrue(Files.notExists(Path.of("src/main/java/com/example/shop/service/AnonymousUserService.java")));
        assertTrue(controllerSource.contains("Order order = requireGuestOrder(orderNo, email, request);"));
        assertTrue(controllerSource.contains(
                "supportService.getOrCreateOpenSession(order.getUserId(), guestSupportContextKey(order))"));
        assertTrue(controllerSource.contains(
                "supportService.sendUserMessage(order.getUserId(), sessionId, content, guestSupportContextKey(order))"));
        assertTrue(controllerSource.contains(
                "return \"guest-order:\" + order.getOrderNo().trim().toLowerCase(java.util.Locale.ROOT);"));
        assertTrue(serviceSource.contains(
                "private final ConcurrentMap<String, Object> sessionCreationLocks = new ConcurrentHashMap<>();"));
        assertTrue(serviceSource.contains("String lockKey = sessionCreationLockKey(userId, contextKey);"));
        assertTrue(serviceSource.contains("sessionCreationLocks.computeIfAbsent(lockKey"));
        assertTrue(serviceSource.contains("synchronized (lock)"));

        int lockStart = serviceSource.indexOf("synchronized (lock)");
        int recheck = serviceSource.indexOf("supportSessionMapper.findOpenByUserIdAndContextKey(userId, contextKey);",
                lockStart);
        int insert = serviceSource.indexOf("supportSessionMapper.insert(session);", lockStart);
        assertTrue(lockStart >= 0);
        assertTrue(recheck > lockStart);
        assertTrue(insert > recheck);
        assertFalse(controllerSource.contains("count + 1"));
        assertFalse(controllerSource.contains("putIfAbsent"));
        assertFalse(serviceSource.contains("count + 1"));
        assertFalse(serviceSource.contains("putIfAbsent"));
    }

    @Test
    void userSessionsClampRequestedLimit() {
        service.getUserSessions(5L, 999);

        verify(supportSessionMapper).findByUserId(5L, 30);
    }

    @Test
    void messagesClampRequestedLimit() {
        service.getMessages(12L, 999, null);

        verify(supportMessageMapper).findRecentBySessionId(12L, 120);
    }

    @Test
    void defaultMessagesUseBoundedRecentWindow() {
        service.getMessages(12L);

        verify(supportMessageMapper).findRecentBySessionId(12L, 80);
    }

    @Test
    void cursorMessagesUseBoundedIncrementalWindow() {
        service.getMessages(12L, 50, 123L);

        verify(supportMessageMapper).findBySessionIdAfterId(12L, 123L, 50);
    }

    @Test
    void adminSessionPageEscapesSearchWildcardsBeforeMapper() {
        String escapedSearch = "vip!% pet!_!!";
        when(runtimeConfig.getInt("support.admin.sessions.max-page-size", 50)).thenReturn(50);
        when(supportSessionMapper.countAdminPage("OPEN", Boolean.TRUE, 7L, escapedSearch)).thenReturn(0L);
        when(supportSessionMapper.findAdminPage("OPEN", Boolean.TRUE, 7L, escapedSearch, 20, 0))
                .thenReturn(List.of());

        service.getAdminSessionPage(" open ", true, 7L, " vip%  pet_! ", 1, 20);

        verify(supportSessionMapper).countAdminPage("OPEN", Boolean.TRUE, 7L, escapedSearch);
        verify(supportSessionMapper).findAdminPage("OPEN", Boolean.TRUE, 7L, escapedSearch, 20, 0);
    }

    @Test
    void adminSessionSearchLikeContractEscapesWildcardInput() throws Exception {
        String serviceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/SupportService.java"));
        String mapperXml = Files.readString(Path.of("src/main/resources/mapper/SupportSessionMapper.xml"));
        String adminPageFilters = block(mapperXml, "<sql id=\"supportSessionAdminPageFilters\">", "</sql>");

        assertTrue(serviceSource.contains("String safeSearch = searchLikeTerm(search);"));
        assertTrue(serviceSource.contains("private String searchLikeTerm(String value)"));
        assertTrue(serviceSource.contains("String normalized = normalizeAdminSearch(value);"));
        assertTrue(serviceSource.contains("return value.replace(\"!\", \"!!\")\n"
                + "                .replace(\"%\", \"!%\")\n"
                + "                .replace(\"_\", \"!_\");"));
        assertEquals(4, countOccurrences(adminPageFilters, "LIKE CONCAT('%', LOWER(#{search}), '%') ESCAPE '!'"));
        assertFalse(adminPageFilters.contains("LIKE CONCAT('%', LOWER(#{search}), '%')\n"));
    }

    @Test
    void rateLimitsSupportMessagesBeforeSaving() {
        when(runtimeConfig.getBoolean("support.message.rate-limit-enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("support.message.max-per-minute", 20)).thenReturn(2);

        service.sendMessage(12L, 5L, "USER", "First");
        service.sendMessage(12L, 5L, "USER", "Second");

        assertThrows(IllegalStateException.class, () -> service.sendMessage(12L, 5L, "USER", "Third"));
        verify(supportMessageMapper, never()).insert(org.mockito.ArgumentMatchers.argThat(message ->
                message instanceof SupportMessage && "Third".equals(((SupportMessage) message).getContent())));
    }

    @Test
    void adminSummaryCalculatesResponseScoreAndClampsStaleWindow() {
        when(runtimeConfig.getInt("support.admin.stale-minutes", 30)).thenReturn(2);
        when(supportSessionMapper.adminSummary(eq(7L), any(LocalDateTime.class))).thenReturn(Map.of(
                "total_sessions", 10L,
                "open_sessions", 6L,
                "closed_sessions", 4L,
                "unread_sessions", 3L,
                "unread_messages", 8L,
                "unassigned_open_sessions", 2L,
                "my_open_sessions", 1L,
                "stale_open_sessions", 1L
        ));

        SupportAdminSummaryResponse summary = service.adminSummary(7L);

        assertEquals(10L, summary.getTotalSessions());
        assertEquals(6L, summary.getOpenSessions());
        assertEquals(4L, summary.getClosedSessions());
        assertEquals(3L, summary.getUnreadSessions());
        assertEquals(8L, summary.getUnreadMessages());
        assertEquals(2L, summary.getUnassignedOpenSessions());
        assertEquals(1L, summary.getMyOpenSessions());
        assertEquals(1L, summary.getStaleOpenSessions());
        assertEquals(5, summary.getStaleMinutes());
        assertEquals(36, summary.getResponseScore());
        verify(supportSessionMapper).adminSummary(eq(7L), any(LocalDateTime.class));
    }

    private static void assertNoRawAngles(String content) {
        assertFalse(content.contains("<"));
        assertFalse(content.contains(">"));
    }

    private String block(String source, String startToken, String endToken) {
        int start = source.indexOf(startToken);
        assertTrue(start >= 0, () -> "Missing source block: " + startToken);
        int end = source.indexOf(endToken, start);
        assertTrue(end > start, () -> "Missing source block terminator: " + endToken);
        return source.substring(start, end);
    }

    private int countOccurrences(String source, String needle) {
        int count = 0;
        int index = source.indexOf(needle);
        while (index >= 0) {
            count++;
            index = source.indexOf(needle, index + needle.length());
        }
        return count;
    }
}
