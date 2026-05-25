package com.example.shop.service;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Product;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductImportServiceTest {
    private ProductServiceImpl service;
    private ProductRepository productRepository;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        service = new ProductServiceImpl();
        productRepository = mock(ProductRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getLong("product.import.max-file-size-bytes", 1048576)).thenReturn(1024L);
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(1);
    }

    @Test
    void rejectsNonCsvImportBeforeDatabaseWrite() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.txt",
                "text/plain",
                "id,name,description,price,stock,categoryId\n".getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("Only .csv"));
        verify(productRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsOversizedImportBeforeDatabaseWrite() {
        String oversizedCsv = "id,name,description,price,stock,categoryId\n,Harness,"
                + "x".repeat(1100)
                + ",19.99,8,1\n";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                oversizedCsv.getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("too large"));
        verify(productRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void stopsWhenImportRowLimitIsExceeded() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                "id,name,description,price,stock,categoryId\n1,Harness,Safe,19.99,8,1\n2,Leash,Strong,9.99,5,1\n"
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("row limit exceeded"));
    }

    @Test
    void normalizesImportedTextAndStatusBeforeSaving() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,warranty,shipping,status\n"
                        + ",  Dog\tHarness  ,Safe\tfit,19.99,8,1,,,,,,,,,,,,,, pending_review \n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        assertEquals(1, result.getCreated());
        assertEquals("Dog Harness", captor.getValue().getName());
        assertEquals("Safe fit", captor.getValue().getDescription());
        assertEquals("PENDING_REVIEW", captor.getValue().getStatus());
    }

    @Test
    void rejectsInvalidImportedStatusBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,warranty,shipping,status\n"
                        + ",Harness,Safe,19.99,8,1,,,,,,,,,,,,,,archived\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("status must be one of"));
        verify(productRepository, never()).save(any());
    }
}
