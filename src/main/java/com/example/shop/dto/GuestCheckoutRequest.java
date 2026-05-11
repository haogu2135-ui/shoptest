package com.example.shop.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class GuestCheckoutRequest {
    @NotEmpty
    @Email
    private String guestEmail;

    @NotEmpty
    private String guestName;

    @NotEmpty
    private String guestPhone;

    @NotEmpty
    private String shippingAddress;

    @NotEmpty
    private String paymentMethod;

    @Valid
    @NotEmpty
    private List<GuestCheckoutItemRequest> items;
}
