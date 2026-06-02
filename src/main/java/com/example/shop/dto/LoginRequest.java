package com.example.shop.dto;

import javax.validation.constraints.Size;

import lombok.Data;

@Data
public class LoginRequest {
    @Size(max = 120, message = "Login identifier is too long")
    private String username;

    @Size(max = 128, message = "Password is too long")
    private String password;
}
