package com.example.shop.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class GuestCheckoutRequest {
    @NotBlank
    @Email
    @Size(max = 160)
    private String guestEmail;

    @NotBlank
    @Size(max = 120)
    private String guestName;

    @NotBlank
    @Size(max = 40)
    @Pattern(regexp = "^(?=(?:.*\\d){6,20})\\+?[\\d\\s().-]{6,40}$")
    private String guestPhone;

    @NotBlank
    @Size(max = 2000)
    private String shippingAddress;

    @NotBlank
    @Size(max = 50)
    private String paymentMethod;

    @Valid
    @NotEmpty
    @Size(max = 80)
    private List<GuestCheckoutItemRequest> items;
}
