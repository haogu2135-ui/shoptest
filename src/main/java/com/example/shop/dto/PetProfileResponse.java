package com.example.shop.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PetProfileResponse {
    private Long id;
    private String name;
    private String petType;
    private String breed;
    private LocalDate birthday;
    private BigDecimal weight;
    private String size;

    public static PetProfileResponse from(com.example.shop.entity.PetProfile pet) {
        PetProfileResponse dto = new PetProfileResponse();
        dto.setId(pet.getId());
        dto.setName(pet.getName());
        dto.setPetType(pet.getPetType());
        dto.setBreed(pet.getBreed());
        dto.setBirthday(pet.getBirthday());
        dto.setWeight(pet.getWeight());
        dto.setSize(pet.getSize());
        return dto;
    }
}
