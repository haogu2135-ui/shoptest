package com.example.shop.dto;

import java.util.List;

public class SystemAlertBatchActionRequest {
    private List<Long> ids;
    private String note;

    public List<Long> getIds() {
        return ids;
    }

    public void setIds(List<Long> ids) {
        this.ids = ids;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
