package com.example.shop.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.validation.constraints.Size;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

public class AdminUserUpdateRequest {
    @Size(max = 20)
    private String status;

    @Size(max = 260)
    private String address;

    @JsonIgnore
    private final Set<String> unsupportedFields = new LinkedHashSet<>();

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    @JsonAnySetter
    public void captureUnsupportedField(String fieldName, Object ignoredValue) {
        unsupportedFields.add(fieldName);
    }

    @JsonIgnore
    public boolean hasUnsupportedFields() {
        return !unsupportedFields.isEmpty();
    }

    @JsonIgnore
    public Set<String> getUnsupportedFields() {
        return Collections.unmodifiableSet(unsupportedFields);
    }
}
