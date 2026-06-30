package com.example.shop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

public class LogManagementStatusResponse {
    private String loggerName;
    private String configuredLevel;
    private String effectiveLevel;
    private boolean debugEnabled;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String logDirectory;
    private String logFileName;
    private List<String> availableFiles;
    private long totalLogBytes;
    private List<String> allowedLoggerPrefixes;
    private int maxRangeHours;
    private int maxPreviewLines;
    private int maxDownloadBytes;

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

    public List<String> getAllowedLoggerPrefixes() {
        return allowedLoggerPrefixes;
    }

    public void setAllowedLoggerPrefixes(List<String> allowedLoggerPrefixes) {
        this.allowedLoggerPrefixes = allowedLoggerPrefixes;
    }

    public int getMaxRangeHours() {
        return maxRangeHours;
    }

    public void setMaxRangeHours(int maxRangeHours) {
        this.maxRangeHours = maxRangeHours;
    }

    public int getMaxPreviewLines() {
        return maxPreviewLines;
    }

    public void setMaxPreviewLines(int maxPreviewLines) {
        this.maxPreviewLines = maxPreviewLines;
    }

    public int getMaxDownloadBytes() {
        return maxDownloadBytes;
    }

    public void setMaxDownloadBytes(int maxDownloadBytes) {
        this.maxDownloadBytes = maxDownloadBytes;
    }
}
