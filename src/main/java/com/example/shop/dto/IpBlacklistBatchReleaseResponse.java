package com.example.shop.dto;

import java.util.List;

public class IpBlacklistBatchReleaseResponse {
    private int requestedCount;
    private int releasedCount;
    private int ignoredCount;
    private int maxBatchSize;
    private List<Long> ids;

    public int getRequestedCount() {
        return requestedCount;
    }

    public void setRequestedCount(int requestedCount) {
        this.requestedCount = requestedCount;
    }

    public int getReleasedCount() {
        return releasedCount;
    }

    public void setReleasedCount(int releasedCount) {
        this.releasedCount = releasedCount;
    }

    public int getIgnoredCount() {
        return ignoredCount;
    }

    public void setIgnoredCount(int ignoredCount) {
        this.ignoredCount = ignoredCount;
    }

    public int getMaxBatchSize() {
        return maxBatchSize;
    }

    public void setMaxBatchSize(int maxBatchSize) {
        this.maxBatchSize = maxBatchSize;
    }

    public List<Long> getIds() {
        return ids;
    }

    public void setIds(List<Long> ids) {
        this.ids = ids;
    }
}
