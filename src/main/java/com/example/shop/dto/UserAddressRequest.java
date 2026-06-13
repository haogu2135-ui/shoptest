package com.example.shop.dto;

import com.example.shop.entity.UserAddress;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.stream.Collectors;

public class UserAddressRequest {
    private static final String REGION_DELIMITER = " | ";

    @NotBlank
    @Size(max = 50)
    private String recipientName;

    @NotBlank
    @Size(max = 20)
    private String phone;

    @NotNull
    @Size(min = 1, max = 8)
    private List<@NotBlank @Size(max = 120) String> region;

    @NotBlank
    @Size(max = 20)
    private String postalCode;

    @NotBlank
    @Size(max = 260)
    private String detailAddress;

    @NotBlank
    @Size(max = 500)
    private String address;

    private Boolean isDefault;

    public UserAddress toEntity(Long userId) {
        UserAddress addressEntity = new UserAddress();
        addressEntity.setUserId(userId);
        addressEntity.setRecipientName(recipientName);
        addressEntity.setPhone(phone);
        addressEntity.setRegion(encodeRegion(region));
        addressEntity.setPostalCode(postalCode);
        addressEntity.setDetailAddress(detailAddress);
        addressEntity.setAddress(address);
        addressEntity.setIsDefault(isDefault);
        return addressEntity;
    }

    private static String encodeRegion(List<String> values) {
        if (values == null) {
            return "";
        }
        return values.stream()
                .map(value -> value == null ? "" : value.trim().replaceAll("\\s+", " "))
                .filter(value -> !value.isEmpty())
                .collect(Collectors.joining(REGION_DELIMITER));
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public List<String> getRegion() {
        return region;
    }

    public void setRegion(List<String> region) {
        this.region = region;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getDetailAddress() {
        return detailAddress;
    }

    public void setDetailAddress(String detailAddress) {
        this.detailAddress = detailAddress;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Boolean getIsDefault() {
        return isDefault;
    }

    public void setIsDefault(Boolean isDefault) {
        this.isDefault = isDefault;
    }
}
