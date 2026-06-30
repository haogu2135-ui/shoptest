package com.example.shop.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    @NotBlank(message = "Login is required")
    @Size(max = 120, message = "Login identifier is too long")
    private String login;

    @NotBlank(message = "Email is required")
    @Size(max = 100, message = "Email is too long")
    @Email(message = "Email is invalid")
    private String email;

    @NotBlank(message = "Verification code is required")
    @Size(min = 6, max = 6, message = "Verification code must be 6 digits")
    @Pattern(regexp = "\\d{6}", message = "Verification code must be 6 digits")
    private String code;

    @NotBlank(message = "New password is required")
    @Size(min = 12, max = 128, message = "Password must be 12 to 128 characters")
    private String newPassword;
}
