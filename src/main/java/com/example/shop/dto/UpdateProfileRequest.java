package com.example.shop.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Email is invalid")
    @Size(max = 100, message = "Email is too long")
    private String email;

    @Size(max = 20, message = "Phone is too long")
    private String phone;

    @Size(max = 12, message = "Verification code is too long")
    private String emailCode;
}
