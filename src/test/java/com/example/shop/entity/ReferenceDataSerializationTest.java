package com.example.shop.entity;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReferenceDataSerializationTest {
    @Test
    void categorySupportsJdkSerializationForRedisCache() throws Exception {
        Category category = new Category();
        category.setId(1L);
        category.setName("Cats");
        category.setParentId(0L);
        category.setPath("/cats");
        category.setLevel(1);
        category.setImageUrl("/images/categories/cats.jpg");
        category.setDescription("Cat supplies");
        category.setProductCount(12L);

        Category restored = roundTrip(category, Category.class);

        assertEquals(category.getId(), restored.getId());
        assertEquals(category.getName(), restored.getName());
        assertEquals(category.getImageUrl(), restored.getImageUrl());
        assertEquals(category.getProductCount(), restored.getProductCount());
    }

    @Test
    void brandSupportsJdkSerializationForRedisCache() throws Exception {
        Brand brand = new Brand();
        brand.setId(2L);
        brand.setName("Acme Pet");
        brand.setDescription("Pet essentials");
        brand.setLogoUrl("/images/brands/acme-pet.png");
        brand.setWebsiteUrl("https://example.com");
        brand.setStatus("ACTIVE");
        brand.setSortOrder(5);

        Brand restored = roundTrip(brand, Brand.class);

        assertEquals(brand.getId(), restored.getId());
        assertEquals(brand.getName(), restored.getName());
        assertEquals(brand.getLogoUrl(), restored.getLogoUrl());
        assertEquals(brand.getSortOrder(), restored.getSortOrder());
    }

    private <T> T roundTrip(T value, Class<T> type) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream output = new ObjectOutputStream(bytes)) {
            output.writeObject(value);
        }

        try (ObjectInputStream input = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            return type.cast(input.readObject());
        }
    }
}
