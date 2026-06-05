package com.example.shop.service;

import com.example.shop.entity.Brand;
import com.example.shop.repository.BrandRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BrandServiceTest {
    private BrandRepository brandRepository;
    private BrandService brandService;

    @BeforeEach
    void setUp() {
        brandRepository = mock(BrandRepository.class);
        brandService = new BrandService(brandRepository);
        when(brandRepository.findByNameIgnoreCase(any())).thenReturn(Optional.empty());
        when(brandRepository.save(any(Brand.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void saveNormalizesSafeLogoUrlBeforePersisting() {
        Brand brand = validBrand();
        brand.setLogoUrl("  /uploads/brands/pawco.png  ");

        brandService.save(brand);

        ArgumentCaptor<Brand> captor = ArgumentCaptor.forClass(Brand.class);
        verify(brandRepository).save(captor.capture());
        assertEquals("/uploads/brands/pawco.png", captor.getValue().getLogoUrl());
    }

    @Test
    void saveAllowsPublicHttpLogoUrl() {
        Brand brand = validBrand();
        brand.setLogoUrl("https://cdn.example.com/brands/pawco.png");

        Brand saved = brandService.save(brand);

        assertEquals("https://cdn.example.com/brands/pawco.png", saved.getLogoUrl());
    }

    @Test
    void saveNormalizesLegacyUploadedLogoUrlBeforePersisting() {
        Brand brand = validBrand();
        brand.setLogoUrl("uploads/brands/pawco.png");

        Brand saved = brandService.save(brand);

        assertEquals("/uploads/brands/pawco.png", saved.getLogoUrl());
    }

    @Test
    void saveDropsBlankLogoUrl() {
        Brand brand = validBrand();
        brand.setLogoUrl("   ");

        Brand saved = brandService.save(brand);

        assertNull(saved.getLogoUrl());
    }

    @Test
    void saveRejectsUnsafeLogoUrlBeforePersisting() {
        for (String logoUrl : new String[] {
                "data:image/svg+xml,<svg></svg>",
                "blob:https://app.example.com/id",
                "assets/brand.png",
                "http://localhost/brand.png",
                "https://192.168.1.10/brand.png",
                "http://[::ffff:127.0.0.1]/brand.png",
                "http://2130706433/brand.png",
                "http://0177.0.0.1/brand.png",
                "https://cdn.example.com:8443/brand.png",
                "https://user:pass@example.com/brand.png"
        }) {
            Brand brand = validBrand();
            brand.setLogoUrl(logoUrl);

            assertThrows(IllegalArgumentException.class, () -> brandService.save(brand), logoUrl);
        }
        verify(brandRepository, never()).save(any());
    }

    private Brand validBrand() {
        Brand brand = new Brand();
        brand.setName("PawCo");
        brand.setStatus("ACTIVE");
        brand.setSortOrder(0);
        return brand;
    }
}
