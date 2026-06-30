package com.example.shop.dto;

import com.example.shop.entity.AdminBugReport;
import lombok.Data;

import java.util.List;
import java.util.stream.Collectors;

@Data
public class AdminBugReportPageResponse {
    private List<AdminBugReportResponse> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;
    private boolean hasNext;
    private boolean hasPrevious;

    public static AdminBugReportPageResponse of(List<AdminBugReport> items, long total, int page, int size) {
        AdminBugReportPageResponse response = new AdminBugReportPageResponse();
        int safeSize = Math.max(1, size);
        int safePage = Math.max(0, page);
        int pages = total <= 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        response.setItems(items == null ? List.of() : items.stream()
                .map(AdminBugReportResponse::from)
                .collect(Collectors.toList()));
        response.setTotal(Math.max(0, total));
        response.setPage(safePage);
        response.setSize(safeSize);
        response.setTotalPages(pages);
        response.setHasNext(safePage + 1 < pages);
        response.setHasPrevious(safePage > 0 && pages > 0);
        return response;
    }
}
