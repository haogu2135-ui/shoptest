package com.example.shop.service;

import com.example.shop.dto.IpBlacklistBatchReleaseResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IpBlacklistServiceTest {
    private JdbcTemplate jdbcTemplate;
    private RuntimeConfigService runtimeConfig;
    private ClientIpResolver clientIpResolver;
    private IpBlacklistService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        service = new IpBlacklistService(
                jdbcTemplate,
                runtimeConfig,
                mock(SystemAlertService.class),
                clientIpResolver,
                mock(TokenBlacklistService.class));
        when(runtimeConfig.getBoolean("security.ip-blacklist.enabled", true)).thenReturn(true);
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
}
