package com.example.shop.dto;

import java.util.ArrayList;
import java.util.List;

public class AdminOrderBatchShipResponse {
    private int requestedCount;
    private int success;
    private int failed;
    private int maxBatchSize;
    private String trackingPrefix;
    private String trackingCarrierCode;
    private List<Failure> failures = new ArrayList<>();

    public int getRequestedCount() {
        return requestedCount;
    }

    public void setRequestedCount(int requestedCount) {
        this.requestedCount = requestedCount;
    }

    public int getSuccess() {
        return success;
    }

    public void setSuccess(int success) {
        this.success = success;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }

    public int getMaxBatchSize() {
        return maxBatchSize;
    }

    public void setMaxBatchSize(int maxBatchSize) {
        this.maxBatchSize = maxBatchSize;
    }

    public String getTrackingPrefix() {
        return trackingPrefix;
    }

    public void setTrackingPrefix(String trackingPrefix) {
        this.trackingPrefix = trackingPrefix;
    }

    public String getTrackingCarrierCode() {
        return trackingCarrierCode;
    }

    public void setTrackingCarrierCode(String trackingCarrierCode) {
        this.trackingCarrierCode = trackingCarrierCode;
    }

    public List<Failure> getFailures() {
        return failures;
    }

    public void setFailures(List<Failure> failures) {
        this.failures = failures == null ? new ArrayList<>() : failures;
        this.failed = this.failures.size();
    }

    public void addFailure(Long orderId, String input, String reason) {
        this.failures.add(new Failure(orderId, input, reason));
        this.failed = this.failures.size();
    }

    public static class Failure {
        private Long orderId;
        private String input;
        private String reason;

        public Failure() {
        }

        public Failure(Long orderId, String input, String reason) {
            this.orderId = orderId;
            this.input = input;
            this.reason = reason;
        }

        public Long getOrderId() {
            return orderId;
        }

        public void setOrderId(Long orderId) {
            this.orderId = orderId;
        }

        public String getInput() {
            return input;
        }

        public void setInput(String input) {
            this.input = input;
        }

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }
    }
}
