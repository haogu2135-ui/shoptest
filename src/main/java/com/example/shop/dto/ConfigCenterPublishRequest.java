package com.example.shop.dto;

public class ConfigCenterPublishRequest {
    private String dataId;
    private String group;
    private String namespace;
    private String content;
    private boolean applyRuntime = true;

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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isApplyRuntime() {
        return applyRuntime;
    }

    public void setApplyRuntime(boolean applyRuntime) {
        this.applyRuntime = applyRuntime;
    }
}
