package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.dto.ProductListQuery;
import com.example.shop.service.ProductService;
import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ProductControllerPaginationTest {

    private final ProductService productService = mock(ProductService.class);
    private final ProductController controller = new ProductController();
    private final MockMvc mockMvc;

    ProductControllerPaginationTest() {
        ReflectionTestUtils.setField(controller, "productService", productService);
        this.mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .setControllerAdvice(new GlobalApiExceptionHandler(
                        new ApiErrorResponseFactory(),
                        mock(SystemAlertService.class)))
                .build();
    }

    @Test
    void publicProductListRejectsNegativePage() throws Exception {
        mockMvc.perform(get("/products").param("page", "-1").param("size", "24"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("page must be greater than or equal to 0"));

        verify(productService, never()).findPublicProductPage(any());
    }

    @Test
    void publicProductListRejectsZeroSize() throws Exception {
        mockMvc.perform(get("/products").param("page", "0").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("size must be greater than or equal to 1"));

        verify(productService, never()).findPublicProductPage(any());
    }

    @Test
    void publicProductListRejectsOversizedPage() throws Exception {
        mockMvc.perform(get("/products").param("page", "0").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("size must be less than or equal to 100"));

        verify(productService, never()).findPublicProductPage(any());
    }

    @Test
    void publicProductListUsesDefaultBoundedPageSize() throws Exception {
        when(productService.findPublicProductPage(any())).thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/products"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProductListQuery> captor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(captor.capture());
        assertEquals(0, captor.getValue().getPage());
        assertEquals(24, captor.getValue().getSize());
    }

    @Test
    void publicProductListPassesCategoryChildrenScope() throws Exception {
        when(productService.findPublicProductPage(any())).thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/products")
                        .param("categoryId", "10")
                        .param("includeChildren", "false"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProductListQuery> captor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(captor.capture());
        assertEquals(10L, captor.getValue().getCategoryId());
        assertEquals(Boolean.FALSE, captor.getValue().getIncludeChildren());
    }

    @Test
    void publicProductListUsesLightweightItemsInsteadOfDetailPayload() throws Exception {
        com.example.shop.entity.Product product = new com.example.shop.entity.Product();
        product.setId(9L);
        product.setName("Harness");
        product.setPrice(new java.math.BigDecimal("19.99"));
        product.setStock(8);
        product.setCategoryId(3L);
        product.setDescription("Everyday harness");
        product.setSpecificationsMap(Map.of(
                "options.Size", "Small,Medium",
                "bundle.enabled", "true",
                "bundle.price", "15.99",
                "bundle.items", "[{\"name\":\"Leash\",\"quantity\":1}]",
                "Material", "Nylon"
        ));
        product.setVariantsList(List.of(Map.of(
                "sku", "HARNESS-S",
                "price", "19.99",
                "stock", 4,
                "options", Map.of("Size", "Small")
        )));
        product.setDetailContentList(List.of(Map.of("type", "text", "content", "Long detail block")));
        product.setWarranty("Long warranty text");
        product.setShipping("Ships tomorrow");
        when(productService.findPublicProductPage(any())).thenReturn(new PageImpl<>(List.of(product)));

        mockMvc.perform(get("/products").param("page", "0").param("size", "24"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(9))
                .andExpect(jsonPath("$.items[0].specifications.Material").value("Nylon"))
                .andExpect(jsonPath("$.items[0].optionGroups[0].name").value("Size"))
                .andExpect(jsonPath("$.items[0].optionGroups[0].values[0]").value("Small"))
                .andExpect(jsonPath("$.items[0].variants[0].sku").value("HARNESS-S"))
                .andExpect(jsonPath("$.items[0].bundle.enabled").value(true))
                .andExpect(jsonPath("$.items[0].detailContent").doesNotExist())
                .andExpect(jsonPath("$.items[0].localizedContent").doesNotExist())
                .andExpect(jsonPath("$.items[0].specificationItems").doesNotExist())
                .andExpect(jsonPath("$.items[0].i18n").doesNotExist())
                .andExpect(jsonPath("$.items[0].warranty").doesNotExist())
                .andExpect(jsonPath("$.items[0].shipping").doesNotExist())
                .andExpect(jsonPath("$.items[0].status").doesNotExist());
    }

    @Test
    void productDetailStillReturnsRichPublicPayload() throws Exception {
        com.example.shop.entity.Product product = new com.example.shop.entity.Product();
        product.setId(9L);
        product.setName("Harness");
        product.setPrice(new java.math.BigDecimal("19.99"));
        product.setStock(8);
        product.setCategoryId(3L);
        product.setDetailContentList(List.of(Map.of("type", "text", "content", "Long detail block")));
        product.setWarranty("Long warranty text");
        product.setShipping("Ships tomorrow");
        when(productService.findPublicById(9L)).thenReturn(java.util.Optional.of(product));

        mockMvc.perform(get("/products/9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(9))
                .andExpect(jsonPath("$.detailContent[0].content").value("Long detail block"))
                .andExpect(jsonPath("$.warranty").value("Long warranty text"))
                .andExpect(jsonPath("$.shipping").value("Ships tomorrow"));
    }
}
