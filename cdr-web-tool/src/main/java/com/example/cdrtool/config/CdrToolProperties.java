package com.example.cdrtool.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "cdr")
public class CdrToolProperties {
    private String soapUrl = "";
    private String loginSystemCode = "102";
    private String password = "";
    private String operatorId = "101";
    private String businessCode = "111";
    private String version = "5.5";
    private String startTime = "20260501000000";
    private int totalCdrNum = 100;
    private int beginRowNum = 0;
    private int fetchRowNum = 100;
    private int maxWorkers = 200;
    private int batchSize = 200;
    private int timeoutSeconds = 10;
    private long minBatchMillis = 1000L;
    private int maxNumbers = 100000;

    public String getSoapUrl() {
        return soapUrl;
    }

    public void setSoapUrl(String soapUrl) {
        this.soapUrl = soapUrl;
    }

    public String getLoginSystemCode() {
        return loginSystemCode;
    }

    public void setLoginSystemCode(String loginSystemCode) {
        this.loginSystemCode = loginSystemCode;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public String getBusinessCode() {
        return businessCode;
    }

    public void setBusinessCode(String businessCode) {
        this.businessCode = businessCode;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public int getTotalCdrNum() {
        return totalCdrNum;
    }

    public void setTotalCdrNum(int totalCdrNum) {
        this.totalCdrNum = totalCdrNum;
    }

    public int getBeginRowNum() {
        return beginRowNum;
    }

    public void setBeginRowNum(int beginRowNum) {
        this.beginRowNum = beginRowNum;
    }

    public int getFetchRowNum() {
        return fetchRowNum;
    }

    public void setFetchRowNum(int fetchRowNum) {
        this.fetchRowNum = fetchRowNum;
    }

    public int getMaxWorkers() {
        return maxWorkers;
    }

    public void setMaxWorkers(int maxWorkers) {
        this.maxWorkers = maxWorkers;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public long getMinBatchMillis() {
        return minBatchMillis;
    }

    public void setMinBatchMillis(long minBatchMillis) {
        this.minBatchMillis = minBatchMillis;
    }

    public int getMaxNumbers() {
        return maxNumbers;
    }

    public void setMaxNumbers(int maxNumbers) {
        this.maxNumbers = maxNumbers;
    }
}
