package com.example.shop.dto;

import java.util.List;

public class TrafficControlStatusResponse {
    private RateLimitStatus rateLimit;
    private CircuitBreakerConfig circuitBreakerConfig;
    private List<CircuitStatus> circuits;

    public RateLimitStatus getRateLimit() {
        return rateLimit;
    }

    public void setRateLimit(RateLimitStatus rateLimit) {
        this.rateLimit = rateLimit;
    }

    public CircuitBreakerConfig getCircuitBreakerConfig() {
        return circuitBreakerConfig;
    }

    public void setCircuitBreakerConfig(CircuitBreakerConfig circuitBreakerConfig) {
        this.circuitBreakerConfig = circuitBreakerConfig;
    }

    public List<CircuitStatus> getCircuits() {
        return circuits;
    }

    public void setCircuits(List<CircuitStatus> circuits) {
        this.circuits = circuits;
    }

    public static class RateLimitStatus {
        private boolean enabled;
        private int publicPerMinute;
        private int authenticatedPerMinute;
        private int adminPerMinute;
        private int windowSeconds;
        private long activeBuckets;
        private long acceptedRequests;
        private long rejectedRequests;
        private List<RateLimitBucketStatus> hotBuckets;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public int getPublicPerMinute() {
            return publicPerMinute;
        }

        public void setPublicPerMinute(int publicPerMinute) {
            this.publicPerMinute = publicPerMinute;
        }

        public int getAuthenticatedPerMinute() {
            return authenticatedPerMinute;
        }

        public void setAuthenticatedPerMinute(int authenticatedPerMinute) {
            this.authenticatedPerMinute = authenticatedPerMinute;
        }

        public int getAdminPerMinute() {
            return adminPerMinute;
        }

        public void setAdminPerMinute(int adminPerMinute) {
            this.adminPerMinute = adminPerMinute;
        }

        public int getWindowSeconds() {
            return windowSeconds;
        }

        public void setWindowSeconds(int windowSeconds) {
            this.windowSeconds = windowSeconds;
        }

        public long getActiveBuckets() {
            return activeBuckets;
        }

        public void setActiveBuckets(long activeBuckets) {
            this.activeBuckets = activeBuckets;
        }

        public long getAcceptedRequests() {
            return acceptedRequests;
        }

        public void setAcceptedRequests(long acceptedRequests) {
            this.acceptedRequests = acceptedRequests;
        }

        public long getRejectedRequests() {
            return rejectedRequests;
        }

        public void setRejectedRequests(long rejectedRequests) {
            this.rejectedRequests = rejectedRequests;
        }

        public List<RateLimitBucketStatus> getHotBuckets() {
            return hotBuckets;
        }

        public void setHotBuckets(List<RateLimitBucketStatus> hotBuckets) {
            this.hotBuckets = hotBuckets;
        }
    }

    public static class RateLimitBucketStatus {
        private String scope;
        private String client;
        private String method;
        private String path;
        private long count;
        private long remaining;
        private String resetAt;

        public String getScope() {
            return scope;
        }

        public void setScope(String scope) {
            this.scope = scope;
        }

        public String getClient() {
            return client;
        }

        public void setClient(String client) {
            this.client = client;
        }

        public String getMethod() {
            return method;
        }

        public void setMethod(String method) {
            this.method = method;
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }

        public long getRemaining() {
            return remaining;
        }

        public void setRemaining(long remaining) {
            this.remaining = remaining;
        }

        public String getResetAt() {
            return resetAt;
        }

        public void setResetAt(String resetAt) {
            this.resetAt = resetAt;
        }
    }

    public static class CircuitBreakerConfig {
        private boolean enabled;
        private int failureThreshold;
        private int openSeconds;
        private int halfOpenSuccessThreshold;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public int getFailureThreshold() {
            return failureThreshold;
        }

        public void setFailureThreshold(int failureThreshold) {
            this.failureThreshold = failureThreshold;
        }

        public int getOpenSeconds() {
            return openSeconds;
        }

        public void setOpenSeconds(int openSeconds) {
            this.openSeconds = openSeconds;
        }

        public int getHalfOpenSuccessThreshold() {
            return halfOpenSuccessThreshold;
        }

        public void setHalfOpenSuccessThreshold(int halfOpenSuccessThreshold) {
            this.halfOpenSuccessThreshold = halfOpenSuccessThreshold;
        }
    }

    public static class CircuitStatus {
        private String name;
        private String state;
        private int failureCount;
        private int halfOpenSuccessCount;
        private String openedUntil;
        private String lastFailureMessage;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public int getFailureCount() {
            return failureCount;
        }

        public void setFailureCount(int failureCount) {
            this.failureCount = failureCount;
        }

        public int getHalfOpenSuccessCount() {
            return halfOpenSuccessCount;
        }

        public void setHalfOpenSuccessCount(int halfOpenSuccessCount) {
            this.halfOpenSuccessCount = halfOpenSuccessCount;
        }

        public String getOpenedUntil() {
            return openedUntil;
        }

        public void setOpenedUntil(String openedUntil) {
            this.openedUntil = openedUntil;
        }

        public String getLastFailureMessage() {
            return lastFailureMessage;
        }

        public void setLastFailureMessage(String lastFailureMessage) {
            this.lastFailureMessage = lastFailureMessage;
        }
    }
}
