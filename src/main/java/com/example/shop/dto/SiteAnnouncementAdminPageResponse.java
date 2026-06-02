package com.example.shop.dto;

import com.example.shop.entity.SiteAnnouncement;

import java.util.List;

public class SiteAnnouncementAdminPageResponse {
    private List<SiteAnnouncement> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;
    private boolean hasNext;
    private boolean hasPrevious;

    public static SiteAnnouncementAdminPageResponse of(List<SiteAnnouncement> items, long total, int page, int size) {
        SiteAnnouncementAdminPageResponse response = new SiteAnnouncementAdminPageResponse();
        int safeSize = Math.max(1, size);
        int safePage = Math.max(1, page);
        int pages = total <= 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        response.setItems(items == null ? List.of() : items);
        response.setTotal(Math.max(0, total));
        response.setPage(safePage);
        response.setSize(safeSize);
        response.setTotalPages(pages);
        response.setHasNext(safePage < pages);
        response.setHasPrevious(safePage > 1 && pages > 0);
        return response;
    }

    public List<SiteAnnouncement> getItems() {
        return items;
    }

    public void setItems(List<SiteAnnouncement> items) {
        this.items = items;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public boolean isHasNext() {
        return hasNext;
    }

    public void setHasNext(boolean hasNext) {
        this.hasNext = hasNext;
    }

    public boolean isHasPrevious() {
        return hasPrevious;
    }

    public void setHasPrevious(boolean hasPrevious) {
        this.hasPrevious = hasPrevious;
    }
}
