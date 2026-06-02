package com.example.shop.service;

import com.example.shop.dto.SiteAnnouncementAdminSummaryResponse;
import com.example.shop.dto.SiteAnnouncementPublicResponse;
import com.example.shop.entity.SiteAnnouncement;
import com.example.shop.repository.SiteAnnouncementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SiteAnnouncementServiceTest {
    private SiteAnnouncementRepository repository;
    private RuntimeConfigService runtimeConfig;
    private SiteAnnouncementService service;

    @BeforeEach
    void setUp() {
        repository = mock(SiteAnnouncementRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt(anyString(), anyInt())).thenAnswer(invocation -> invocation.getArgument(1));
        service = new SiteAnnouncementService(repository, runtimeConfig);
    }

    @Test
    void adminSummaryUsesRepositoryAggregatesAndRuntimeLimits() {
        when(runtimeConfig.getInt("announcement.active-max-rows", 10)).thenReturn(8);
        when(runtimeConfig.getInt("admin.announcements.title-max-chars", 120)).thenReturn(80);
        when(runtimeConfig.getInt("admin.announcements.content-max-chars", 500)).thenReturn(420);
        when(runtimeConfig.getInt("admin.announcements.link-url-max-chars", 500)).thenReturn(260);
        when(repository.countAdmin(isNull(), isNull())).thenReturn(9L);
        when(repository.countAdminCurrentlyActive(isNull(), isNull(), any(LocalDateTime.class))).thenReturn(3L);
        when(repository.countAdminScheduled(isNull(), isNull(), any(LocalDateTime.class))).thenReturn(2L);
        when(repository.countAdminExpired(isNull(), isNull(), any(LocalDateTime.class))).thenReturn(1L);
        when(repository.countAdmin(eq("INACTIVE"), isNull())).thenReturn(4L);
        when(repository.countAdminLinked(isNull(), isNull())).thenReturn(5L);

        SiteAnnouncementAdminSummaryResponse summary = service.adminSummary();

        assertEquals(9L, summary.getTotalAnnouncements());
        assertEquals(3L, summary.getActiveAnnouncements());
        assertEquals(2L, summary.getScheduledAnnouncements());
        assertEquals(1L, summary.getExpiredAnnouncements());
        assertEquals(4L, summary.getInactiveAnnouncements());
        assertEquals(5L, summary.getLinkedAnnouncements());
        assertEquals(8, summary.getMaxActiveRows());
        assertEquals(80, summary.getTitleMaxChars());
        assertEquals(420, summary.getContentMaxChars());
        assertEquals(260, summary.getLinkUrlMaxChars());
        assertNotNull(summary.getCheckedAt());
    }

    @Test
    void findActiveClampsLimitToConfiguredMaximum() {
        when(runtimeConfig.getInt("announcement.active-max-rows", 10)).thenReturn(3);
        when(repository.findActive(any(LocalDateTime.class), any(Pageable.class))).thenReturn(Collections.emptyList());

        service.findActive(50);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findActive(any(LocalDateTime.class), pageableCaptor.capture());
        assertEquals(3, pageableCaptor.getValue().getPageSize());
    }

    @Test
    void findActiveReturnsPublicCopiesAndDropsUnsafeLinks() {
        SiteAnnouncement safe = new SiteAnnouncement();
        safe.setId(1L);
        safe.setTitle("Coupons");
        safe.setContent("Save today");
        safe.setLinkUrl(" /coupons ");
        SiteAnnouncement unsafe = new SiteAnnouncement();
        unsafe.setId(2L);
        unsafe.setTitle("Bad");
        unsafe.setContent("Unsafe history row");
        unsafe.setLinkUrl("javascript:alert(1)");
        when(repository.findActive(any(LocalDateTime.class), any(Pageable.class))).thenReturn(List.of(safe, unsafe));

        List<SiteAnnouncementPublicResponse> active = service.findActive(4);

        assertEquals(2, active.size());
        assertNotSame(safe, active.get(0));
        assertNotSame(unsafe, active.get(1));
        assertEquals("/coupons", active.get(0).getLinkUrl());
        assertNull(active.get(1).getLinkUrl());
        assertEquals("javascript:alert(1)", unsafe.getLinkUrl());
    }

    @Test
    void saveNormalizesTextStatusAndBlankLink() {
        SiteAnnouncement announcement = new SiteAnnouncement();
        announcement.setTitle("  Holiday   Deal  ");
        announcement.setContent("  Save on pet essentials  ");
        announcement.setLinkUrl("   ");
        announcement.setStatus(" active ");
        when(repository.save(any(SiteAnnouncement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SiteAnnouncement saved = service.save(announcement);

        assertEquals("Holiday   Deal", saved.getTitle());
        assertEquals("Save on pet essentials", saved.getContent());
        assertNull(saved.getLinkUrl());
        assertEquals("ACTIVE", saved.getStatus());
        assertEquals(0, saved.getSortOrder());
    }

    @Test
    void saveRejectsUnsafeAnnouncementLinkBeforePersisting() {
        SiteAnnouncement announcement = new SiteAnnouncement();
        announcement.setTitle("Risky");
        announcement.setContent("Unsafe link");
        announcement.setLinkUrl("javascript:alert(1)");

        assertThrows(IllegalArgumentException.class, () -> service.save(announcement));

        verify(repository, never()).save(any(SiteAnnouncement.class));
    }

    @Test
    void saveRejectsCredentialAnnouncementLinkBeforePersisting() {
        SiteAnnouncement announcement = new SiteAnnouncement();
        announcement.setTitle("Risky");
        announcement.setContent("Credential link");
        announcement.setLinkUrl("https://user:pass@example.com/deal");

        assertThrows(IllegalArgumentException.class, () -> service.save(announcement));

        verify(repository, never()).save(any(SiteAnnouncement.class));
    }

    @Test
    void saveRejectsUnsupportedStatusAndOversizedContent() {
        when(runtimeConfig.getInt("admin.announcements.content-max-chars", 500)).thenReturn(12);
        SiteAnnouncement announcement = new SiteAnnouncement();
        announcement.setTitle("Campaign");
        announcement.setContent("This content is too long");
        announcement.setStatus("LIVE");

        assertThrows(IllegalArgumentException.class, () -> service.save(announcement));

        verify(repository, never()).save(any(SiteAnnouncement.class));
    }
}
