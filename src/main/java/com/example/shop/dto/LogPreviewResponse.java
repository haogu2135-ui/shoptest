package com.example.shop.dto;

import java.util.List;

public class LogPreviewResponse {
    private String start;
    private String end;
    private String keyword;
    private String level;
    private int limit;
    private int matchedLines;
    private boolean truncated;
    private List<String> lines;

    public String getStart() {
        return start;
    }

    public void setStart(String start) {
        this.start = start;
    }

    public String getEnd() {
        return end;
    }

    public void setEnd(String end) {
        this.end = end;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getMatchedLines() {
        return matchedLines;
    }

    public void setMatchedLines(int matchedLines) {
        this.matchedLines = matchedLines;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }

    public List<String> getLines() {
        return lines;
    }

    public void setLines(List<String> lines) {
        this.lines = lines;
    }
}
