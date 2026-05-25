package com.example.shop.dto;

import java.util.List;

public class SecurityAuditSummaryResponse {
    private String startAt;
    private String endAt;
    private long totalCount;
    private long successCount;
    private long failureCount;
    private int defaultRangeHours;
    private int maxRangeHours;
    private int maxSearchRows;
    private int maxExportRows;
    private List<GroupCount> byResult;
    private List<GroupCount> topActions;
    private List<GroupCount> topActors;
    private List<GroupCount> topIpAddresses;
    private String checkedAt;

    public String getStartAt() {
        return startAt;
    }

    public void setStartAt(String startAt) {
        this.startAt = startAt;
    }

    public String getEndAt() {
        return endAt;
    }

    public void setEndAt(String endAt) {
        this.endAt = endAt;
    }

    public long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(long totalCount) {
        this.totalCount = totalCount;
    }

    public long getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(long successCount) {
        this.successCount = successCount;
    }

    public long getFailureCount() {
        return failureCount;
    }

    public void setFailureCount(long failureCount) {
        this.failureCount = failureCount;
    }

    public int getDefaultRangeHours() {
        return defaultRangeHours;
    }

    public void setDefaultRangeHours(int defaultRangeHours) {
        this.defaultRangeHours = defaultRangeHours;
    }

    public int getMaxRangeHours() {
        return maxRangeHours;
    }

    public void setMaxRangeHours(int maxRangeHours) {
        this.maxRangeHours = maxRangeHours;
    }

    public int getMaxSearchRows() {
        return maxSearchRows;
    }

    public void setMaxSearchRows(int maxSearchRows) {
        this.maxSearchRows = maxSearchRows;
    }

    public int getMaxExportRows() {
        return maxExportRows;
    }

    public void setMaxExportRows(int maxExportRows) {
        this.maxExportRows = maxExportRows;
    }

    public List<GroupCount> getByResult() {
        return byResult;
    }

    public void setByResult(List<GroupCount> byResult) {
        this.byResult = byResult;
    }

    public List<GroupCount> getTopActions() {
        return topActions;
    }

    public void setTopActions(List<GroupCount> topActions) {
        this.topActions = topActions;
    }

    public List<GroupCount> getTopActors() {
        return topActors;
    }

    public void setTopActors(List<GroupCount> topActors) {
        this.topActors = topActors;
    }

    public List<GroupCount> getTopIpAddresses() {
        return topIpAddresses;
    }

    public void setTopIpAddresses(List<GroupCount> topIpAddresses) {
        this.topIpAddresses = topIpAddresses;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }

    public static class GroupCount {
        private String name;
        private long count;

        public GroupCount() {
        }

        public GroupCount(String name, long count) {
            this.name = name;
            this.count = count;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }
    }
}
