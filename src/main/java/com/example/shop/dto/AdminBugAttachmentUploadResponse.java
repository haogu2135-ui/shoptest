package com.example.shop.dto;

public class AdminBugAttachmentUploadResponse {
    private String attachmentUrl;

    public AdminBugAttachmentUploadResponse() {
    }

    public AdminBugAttachmentUploadResponse(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }

    public String getAttachmentUrl() {
        return attachmentUrl;
    }

    public void setAttachmentUrl(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }
}
