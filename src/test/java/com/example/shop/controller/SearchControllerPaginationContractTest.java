package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SearchControllerPaginationContractTest {

    @Test
    void searchEndpointReturnsPagedResponseInsteadOfUnboundedList() throws Exception {
        ProductService productService = mock(ProductService.class);
        SearchController controller = new SearchController(productService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
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
        verify(productService, never()).findPublicProducts(any(ProductListQuery.class));
        ProductListQuery query = queryCaptor.getValue();
        assertThat(query.getKeyword()).isEqualTo("bowl");
        assertThat(query.getPage()).isEqualTo(2);
        assertThat(query.getSize()).isEqualTo(12);
    }
}
