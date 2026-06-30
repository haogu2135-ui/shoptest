package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.dto.ProductListQuery;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SearchControllerTest {

    private final ProductService productService = mock(ProductService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new SearchController(productService))
            .setControllerAdvice(new GlobalApiExceptionHandler(
                    new ApiErrorResponseFactory(),
                    mock(SystemAlertService.class)))
            .build();

    @Test
    void rejectsBlankSearchQueryWithoutFilters() throws Exception {
        mockMvc.perform(get("/search").param("q", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("search query is required"));

        verify(productService, never()).findPublicProducts(any(ProductListQuery.class));
        verify(productService, never()).findPublicProductPage(any(ProductListQuery.class));
    }

    @Test
    void rejectsBlankKeywordWithoutFilters() throws Exception {
        mockMvc.perform(get("/search").param("keyword", "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("search query is required"));

        verify(productService, never()).findPublicProducts(any(ProductListQuery.class));
        verify(productService, never()).findPublicProductPage(any(ProductListQuery.class));
    }

    @Test
    void allowsBlankSearchQueryWhenScopedByCategoryFilter() throws Exception {
        when(productService.findPublicProductPage(any(ProductListQuery.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 24), 0));

        mockMvc.perform(get("/search").param("q", "").param("categoryId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(24));

        ArgumentCaptor<ProductListQuery> queryCaptor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(queryCaptor.capture());
        ProductListQuery query = queryCaptor.getValue();
        assertThat(query.getKeyword()).isNull();
        assertThat(query.getCategoryId()).isEqualTo(7L);
        assertThat(query.getPage()).isEqualTo(0);
        assertThat(query.getSize()).isEqualTo(24);
    }

    @Test
    void passesCategoryChildrenScopeToSearchQuery() throws Exception {
        when(productService.findPublicProductPage(any(ProductListQuery.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 24), 0));

        mockMvc.perform(get("/search")
                        .param("q", "bowl")
                        .param("categoryId", "7")
                        .param("includeChildren", "false"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProductListQuery> queryCaptor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(queryCaptor.capture());
        ProductListQuery query = queryCaptor.getValue();
        assertThat(query.getKeyword()).isEqualTo("bowl");
        assertThat(query.getCategoryId()).isEqualTo(7L);
        assertThat(query.getIncludeChildren()).isFalse();
    }

    @Test
    void acceptsSearchAliasForProductsApiCompatibility() throws Exception {
        when(productService.findPublicProductPage(any(ProductListQuery.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 24), 0));

        mockMvc.perform(get("/search").param("search", "feeder"))
                .andExpect(status().isOk());

        ArgumentCaptor<ProductListQuery> queryCaptor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(queryCaptor.capture());
        assertThat(queryCaptor.getValue().getKeyword()).isEqualTo("feeder");
    }

    @Test
    void returnsPaginatedSearchResponse() throws Exception {
        Product product = new Product();
        product.setId(99L);
        product.setName("Travel bowl");
        product.setPrice(new BigDecimal("12.50"));
        when(productService.findPublicProductPage(any(ProductListQuery.class)))
                .thenReturn(new PageImpl<>(List.of(product), PageRequest.of(2, 12), 42));

        mockMvc.perform(get("/search")
                        .param("q", "bowl")
                        .param("page", "2")
                        .param("size", "12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(99))
                .andExpect(jsonPath("$.items[0].name").value("Travel bowl"))
                .andExpect(jsonPath("$.total").value(42))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(12))
                .andExpect(jsonPath("$.totalPages").value(4))
                .andExpect(jsonPath("$.hasNext").value(true))
                .andExpect(jsonPath("$.hasPrevious").value(true));

        ArgumentCaptor<ProductListQuery> queryCaptor = ArgumentCaptor.forClass(ProductListQuery.class);
        verify(productService).findPublicProductPage(queryCaptor.capture());
        ProductListQuery query = queryCaptor.getValue();
        assertThat(query.getKeyword()).isEqualTo("bowl");
        assertThat(query.getPage()).isEqualTo(2);
        assertThat(query.getSize()).isEqualTo(12);
    }

    @Test
    void searchResultsUseLightweightItemsInsteadOfDetailPayload() throws Exception {
        Product product = new Product();
        product.setId(99L);
        product.setName("Travel bowl");
        product.setPrice(new BigDecimal("75.00"));
        product.setOriginalPrice(new BigDecimal("100.00"));
        product.setDiscount(47);
        product.setStock(6);
        product.setCategoryId(3L);
        product.setSpecificationsMap(Map.of(
                "options.Size", "Small,Medium",
                "Material", "Steel"
        ));
        product.setVariantsList(List.of(Map.of(
                "sku", "BOWL-S",
                "price", "12.50",
                "stock", 6,
                "options", Map.of("Size", "Small")
        )));
        product.setDetailContentList(List.of(Map.of("type", "text", "content", "Long detail block")));
        product.setWarranty("Long warranty text");
        product.setShipping("Ships tomorrow");
        when(productService.findPublicProductPage(any(ProductListQuery.class)))
                .thenReturn(new PageImpl<>(List.of(product), PageRequest.of(0, 12), 1));

        mockMvc.perform(get("/search")
                        .param("q", "bowl")
                        .param("page", "0")
                        .param("size", "12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(99))
                .andExpect(jsonPath("$.items[0].discount").value(25))
                .andExpect(jsonPath("$.items[0].effectiveDiscountPercent").value(25))
                .andExpect(jsonPath("$.items[0].specifications.Material").value("Steel"))
                .andExpect(jsonPath("$.items[0].optionGroups[0].name").value("Size"))
                .andExpect(jsonPath("$.items[0].optionGroups[0].values[0]").value("Small"))
                .andExpect(jsonPath("$.items[0].variants[0].sku").value("BOWL-S"))
                .andExpect(jsonPath("$.items[0].detailContent").doesNotExist())
                .andExpect(jsonPath("$.items[0].localizedContent").doesNotExist())
                .andExpect(jsonPath("$.items[0].specificationItems").doesNotExist())
                .andExpect(jsonPath("$.items[0].i18n").doesNotExist())
                .andExpect(jsonPath("$.items[0].warranty").doesNotExist())
                .andExpect(jsonPath("$.items[0].shipping").doesNotExist())
                .andExpect(jsonPath("$.items[0].status").doesNotExist());
    }

    @Test
    void rejectsNegativePageBeforeCallingService() throws Exception {
        mockMvc.perform(get("/search").param("q", "bowl").param("page", "-1").param("size", "12"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("page must be greater than or equal to 0"));

        verify(productService, never()).findPublicProductPage(any(ProductListQuery.class));
    }

    @Test
    void rejectsOversizedPageSizeBeforeCallingService() throws Exception {
        mockMvc.perform(get("/search").param("q", "bowl").param("page", "0").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("size must be less than or equal to 100"));

        verify(productService, never()).findPublicProductPage(any(ProductListQuery.class));
    }
}
