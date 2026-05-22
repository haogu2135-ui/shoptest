package com.example.cdrtool.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CdrRunResult {
    private final Map<String, List<String>> files = new LinkedHashMap<String, List<String>>();
    private int total;
    private int failed;

    public CdrRunResult() {
        files.put("voice", new ArrayList<String>());
        files.put("SMS", new ArrayList<String>());
        files.put("MMS", new ArrayList<String>());
        files.put("GPRS", new ArrayList<String>());
        files.put("withservice", new ArrayList<String>());
        files.put("noservice", new ArrayList<String>());
        files.put("failed", new ArrayList<String>());
    }

    public Map<String, List<String>> getFiles() {
        return files;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }
}
