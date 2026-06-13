package com.example.shop.entity;

import javax.persistence.*;
import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "user_addresses")
public class UserAddress implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    @NotNull
    private Long userId;

    @Column(name = "recipient_name")
    @NotBlank
    @Size(max = 50)
    private String recipientName;

    @Column(name = "phone")
    @NotBlank
    @Size(max = 20)
    private String phone;

    @Column(name = "region")
    @Size(max = 1000)
    private String region;

    @Column(name = "postal_code")
    @Size(max = 20)
    private String postalCode;

    @Column(name = "detail_address")
    @Size(max = 260)
    private String detailAddress;

    @Column(name = "address")
    @NotBlank
    @Size(max = 500)
    private String address;

    @Column(name = "is_default")
    private Boolean isDefault;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
