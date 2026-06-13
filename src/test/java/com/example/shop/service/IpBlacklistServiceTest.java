package com.example.shop.service;

import com.example.shop.dto.IpBlacklistBatchReleaseResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IpBlacklistServiceTest {
    private JdbcTemplate jdbcTemplate;
    private RuntimeConfigService runtimeConfig;
    private ClientIpResolver clientIpResolver;
    private TokenBlacklistService tokenBlacklistService;
    private IpBlacklistService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        service = new IpBlacklistService(
                jdbcTemplate,
                runtimeConfig,
                mock(SystemAlertService.class),
                clientIpResolver,
                tokenBlacklistService);
        when(runtimeConfig.getBoolean("security.ip-blacklist.enabled", true)).thenReturn(true);
        when(tokenBlacklistService.findLoginIpFailures()).thenReturn(List.of());
    }

    @Test
    void manualBlockRejectsInvalidIpBeforeDatabaseWrite() {
        when(clientIpResolver.normalizeIpAddress("not-an-ip")).thenReturn("");

        assertThrows(IllegalArgumentException.class,
                () -> service.block("not-an-ip", IpBlacklistService.SOURCE_MANUAL, 30, "manual", "admin"));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void recordFailureIgnoresInvalidIpBeforeDatabaseWrite() {
        when(clientIpResolver.normalizeIpAddress("bad\r\nip")).thenReturn("");

        service.recordFailure(IpBlacklistService.SOURCE_LOGIN, "bad\r\nip", "failed login");

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void manualBlockRejectsTrustedIpBeforeDatabaseWrite() {
        when(clientIpResolver.normalizeIpAddress("127.0.0.1")).thenReturn("127.0.0.1");
        when(runtimeConfig.getString("security.ip-blacklist.trusted-ips", "127.0.0.1,::1,0:0:0:0:0:0:0:1"))
                .thenReturn("127.0.0.1,10.0.0.0/8");
        when(clientIpResolver.matchesAny("127.0.0.1", "127.0.0.1,10.0.0.0/8")).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.block("127.0.0.1", IpBlacklistService.SOURCE_MANUAL, 30, "manual", "admin"));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void trustedIpMatchingSupportsConfiguredCidr() {
        when(clientIpResolver.normalizeIpAddress("10.2.3.4")).thenReturn("10.2.3.4");
        when(runtimeConfig.getString("security.ip-blacklist.trusted-ips", "127.0.0.1,::1,0:0:0:0:0:0:0:1"))
                .thenReturn("127.0.0.1,10.0.0.0/8");
        when(clientIpResolver.matchesAny("10.2.3.4", "127.0.0.1,10.0.0.0/8")).thenReturn(true);

        service.recordFailure(IpBlacklistService.SOURCE_LOGIN, "10.2.3.4", "failed login");

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void batchReleaseNormalizesIdsAndMasksActorBeforeWriting() {
        when(runtimeConfig.getInt("security.ip-blacklist.admin.batch-release-max-size", 100)).thenReturn(3);
        when(jdbcTemplate.update(
                startsWith("UPDATE ip_blacklist_entries SET status = ?"),
                any(),
                any(),
                any(),
                any(),
                any(),
                any())).thenReturn(2);

        IpBlacklistBatchReleaseResponse response =
                service.releaseBatch(List.of(3L, 2L, 2L, -1L, 1L), "admin password=secret");

        assertEquals(5, response.getRequestedCount());
        assertEquals(2, response.getReleasedCount());
        assertEquals(2, response.getIgnoredCount());
        assertEquals(3, response.getMaxBatchSize());
        assertEquals(List.of(3L, 2L, 1L), response.getIds());
        verify(jdbcTemplate).update(
                startsWith("UPDATE ip_blacklist_entries SET status = ?"),
                eq(IpBlacklistService.STATUS_RELEASED),
                eq("admin password=******"),
                eq(3L),
                eq(2L),
                eq(1L),
                eq(IpBlacklistService.STATUS_RELEASED));
    }

    @Test
    void batchReleaseRejectsOversizedIdSetsBeforeWriting() {
        when(runtimeConfig.getInt("security.ip-blacklist.admin.batch-release-max-size", 100)).thenReturn(3);

        assertThrows(IllegalArgumentException.class,
                () -> service.releaseBatch(List.of(3L, 2L, 2L, -1L, 1L, 4L), "admin"));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void searchDoesNotReleaseExpiredRowsDuringRead() {
        service.search(null, null, null, 200);

        verify(jdbcTemplate, never()).update(
                startsWith("UPDATE ip_blacklist_entries SET status = ?, released_at"),
                any(),
                any());
    }

    @Test
    void statusDoesNotReleaseExpiredRowsDuringRead() {
        service.status();

        verify(jdbcTemplate, never()).update(
                startsWith("UPDATE ip_blacklist_entries SET status = ?, released_at"),
                any(),
                any());
    }

    @Test
    void blockingEntryLookupUsesDatabaseAndDoesNotDependOnLegacyRedisSnapshots() {
        when(clientIpResolver.normalizeIpAddress("203.0.113.44")).thenReturn("203.0.113.44");
        when(jdbcTemplate.query(
                startsWith("SELECT * FROM ip_blacklist_entries WHERE ip_address = ?"),
                any(org.springframework.jdbc.core.RowMapper.class),
                eq("203.0.113.44"),
                eq(IpBlacklistService.STATUS_BLOCKED))).thenReturn(List.of());
        when(tokenBlacklistService.findLoginIpFailures()).thenThrow(new RuntimeException("redis unavailable"));

        assertTrue(service.findBlockingEntry("203.0.113.44").isEmpty());

        verify(tokenBlacklistService, never()).findLoginIpFailures();
    }

    @Test
    void adminIpBlacklistControllerDoesNotContainLegacyBrokenReportLogic() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/controller/AdminIpBlacklistController.java"),
                StandardCharsets.UTF_8);

        assertEquals(4, countOccurrences(source, "@PostMapping"));
        assertTrue(source.contains("@PostMapping(\"/batch/release\")"));
        assertTrue(source.contains("ipBlacklistService.releaseBatch"));
        assertTrue(source.contains("AdminRoleService.IP_BLACKLIST_RELEASE_PERMISSION"));
        assertTrue(source.contains("SensitiveDataMasker.mask"));
        assertTrue(source.contains("response.getReleasedCount()"));
        assertTrue(source.contains("response.getRequestedCount()"));
        assertTrue(source.contains("body == null || body.getIds() == null ? 0 : body.getIds().size()"));

        List<String> staleTokens = List.of(
                "countEntries",
                "UnsupportedOperationException",
                ".clear()",
                "piiEntries",
                "PII",
                "yesterday",
                "twoMonthsAgo",
                "xor",
                "XOR");
        for (String token : staleTokens) {
            assertTrue(!source.contains(token), () -> "AdminIpBlacklistController still contains stale F3496 token: " + token);
        }
    }

    private int countOccurrences(String source, String token) {
        int count = 0;
        int index = source.indexOf(token);
        while (index >= 0) {
            count++;
            index = source.indexOf(token, index + token.length());
        }
        return count;
    }
}
