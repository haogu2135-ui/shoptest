package com.example.shop.dto;

import java.util.List;

public class LogManagementStatusResponse {
    private String loggerName;
    private String configuredLevel;
    private String effectiveLevel;
    private boolean debugEnabled;
    private String logDirectory;
    private String logFileName;
    private List<String> availableFiles;
    private long totalLogBytes;

    public String getLoggerName() {
        return loggerName;
    }

    public void setLoggerName(String loggerName) {
        this.loggerName = loggerName;
    }

    public String getConfiguredLevel() {
        return configuredLevel;
    }

    public void setConfiguredLevel(String configuredLevel) {
        this.configuredLevel = configuredLevel;
    }

    public String getEffectiveLevel() {
        return effectiveLevel;
    }

    public void setEffectiveLevel(String effectiveLevel) {
        this.effectiveLevel = effectiveLevel;
    }

    public boolean isDebugEnabled() {
        return debugEnabled;
    }

    public void setDebugEnabled(boolean debugEnabled) {
        this.debugEnabled = debugEnabled;
    }

    public String getLogDirectory() {
        return logDirectory;
    }

    public void setLogDirectory(String logDirectory) {
        this.logDirectory = logDirectory;
    }

    public String getLogFileName() {
        return logFileName;
    }

    public void setLogFileName(String logFileName) {
        this.logFileName = logFileName;
    }

    public List<String> getAvailableFiles() {
        return availableFiles;
    }

    public void setAvailableFiles(List<String> availableFiles) {
        this.availableFiles = availableFiles;
    }

    public long getTotalLogBytes() {
        return totalLogBytes;
    }

    public void setTotalLogBytes(long totalLogBytes) {
        this.totalLogBytes = totalLogBytes;
    }
}
