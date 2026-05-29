package com.example.shop.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    @NotBlank(message = "Login is required")
    private String login;

    @NotBlank(message = "Email is required")
    @Email(message = "Email is invalid")
    private String email;

    @NotBlank(message = "Verification code is required")
    @Pattern(regexp = "\\d{6}", message = "Verification code must be 6 digits")
    private String code;

    @NotBlank(message = "New password is required")
    @Size(min = 8, max = 128, message = "Password must be 8 to 128 characters")
    private String newPassword;
}
