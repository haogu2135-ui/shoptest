package com.example.shop.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

import lombok.Data;

@Data
public class EmailLoginCodeRequest {
    @NotBlank
    @Email
    private String email;
}
