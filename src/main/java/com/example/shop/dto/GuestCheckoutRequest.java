package com.example.shop.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
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
    @Size(max = 80)
    private List<GuestCheckoutItemRequest> items;
}
