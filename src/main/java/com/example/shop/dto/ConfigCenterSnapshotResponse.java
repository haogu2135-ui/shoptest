package com.example.shop.dto;

import java.util.List;
import java.util.Map;

public class ConfigCenterSnapshotResponse {
    private String dataId;
    private String group;
    private String namespace;
    private String nacosServerAddr;
    private String content;
    private Map<String, String> properties;
    private Map<String, String> effectiveProperties;
    private List<String> appliedKeys;
    private List<String> sensitiveKeys;
    private List<String> allowedKeyPrefixes;
    private List<String> warnings;
    private List<String> errors;
    private boolean runtimeApplied;
    private boolean nacosPublished;
    private int propertyCount;
    private int maxContentBytes;
    private int maxProperties;
    private String lastSyncedAt;

    public String getDataId() {
        return dataId;
    }

    public void setDataId(String dataId) {
        this.dataId = dataId;
    }

    public String getGroup() {
        return group;
    }

    public void setGroup(String group) {
        this.group = group;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getNacosServerAddr() {
        return nacosServerAddr;
    }

    public void setNacosServerAddr(String nacosServerAddr) {
        this.nacosServerAddr = nacosServerAddr;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Map<String, String> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, String> properties) {
        this.properties = properties;
    }

    public Map<String, String> getEffectiveProperties() {
        return effectiveProperties;
    }

    public void setEffectiveProperties(Map<String, String> effectiveProperties) {
        this.effectiveProperties = effectiveProperties;
    }

    public List<String> getAppliedKeys() {
        return appliedKeys;
    }

    public void setAppliedKeys(List<String> appliedKeys) {
        this.appliedKeys = appliedKeys;
    }

    public List<String> getSensitiveKeys() {
        return sensitiveKeys;
    }

    public void setSensitiveKeys(List<String> sensitiveKeys) {
        this.sensitiveKeys = sensitiveKeys;
    }

    public List<String> getAllowedKeyPrefixes() {
        return allowedKeyPrefixes;
    }

    public void setAllowedKeyPrefixes(List<String> allowedKeyPrefixes) {
        this.allowedKeyPrefixes = allowedKeyPrefixes;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors;
    }

    public boolean isRuntimeApplied() {
        return runtimeApplied;
    }

    public void setRuntimeApplied(boolean runtimeApplied) {
        this.runtimeApplied = runtimeApplied;
    }

    public boolean isNacosPublished() {
        return nacosPublished;
    }

    public void setNacosPublished(boolean nacosPublished) {
        this.nacosPublished = nacosPublished;
    }

    public int getPropertyCount() {
        return propertyCount;
    }

    public void setPropertyCount(int propertyCount) {
        this.propertyCount = propertyCount;
    }

    public int getMaxContentBytes() {
        return maxContentBytes;
    }

    public void setMaxContentBytes(int maxContentBytes) {
        this.maxContentBytes = maxContentBytes;
    }

    public int getMaxProperties() {
        return maxProperties;
    }

    public void setMaxProperties(int maxProperties) {
        this.maxProperties = maxProperties;
    }

    public String getLastSyncedAt() {
        return lastSyncedAt;
    }

    public void setLastSyncedAt(String lastSyncedAt) {
        this.lastSyncedAt = lastSyncedAt;
    }
}
