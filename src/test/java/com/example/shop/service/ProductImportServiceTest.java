package com.example.shop.service;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Category;
import com.example.shop.entity.Product;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.ProductRepository;
import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

class ProductImportServiceTest {
    private ProductServiceImpl service;
    private ProductRepository productRepository;
    private CategoryRepository categoryRepository;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        service = new ProductServiceImpl();
        productRepository = mock(ProductRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        runtimeConfig = mock(RuntimeConfigService.class);
        ReflectionTestUtils.setField(service, "productRepository", productRepository);
        ReflectionTestUtils.setField(service, "categoryRepository", categoryRepository);
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getLong("product.import.max-file-size-bytes", 1048576)).thenReturn(1024L);
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(1);
        Category category = new Category();
        category.setId(1L);
        category.setName("Harnesses");
        when(categoryRepository.findAll()).thenReturn(List.of(category));
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
        assertEquals(1, result.getRowErrors().size());
        assertEquals(1024L, result.getMaxFileSizeBytes());
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        assertFalse(result.isReadyToImport());
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
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void previewIncludesSanitizedImportFileMetadata() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        byte[] content = "name,description,price,stock,categoryId\nHarness,Safe,19.99,8,1\n"
                .getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "C:\\exports\\products.csv",
                "text/csv",
                content
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals("products.csv", result.getFilename());
        assertEquals(content.length, result.getSizeBytes());
        assertEquals(ProductImportResult.STATUS_PREVIEW_READY, result.getStatus());
        assertTrue(result.isReadyToImport());
        verify(productRepository, never()).save(any());
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
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
    }

    @Test
    void rejectsHeaderOnlyCsvWithClearNoRowsError() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                "id,name,description,price,stock,categoryId\n".getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertTrue(result.isPreview());
        assertEquals(0, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("does not contain any product rows"));
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isApplied());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void importsCsvWithReorderedNamedHeadersAndIgnoredExportColumns() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("stock,categoryName,price,name,categoryId,id,description,status\n"
                        + "8,Harnesses,19.99,Harness,1,,Safe,ACTIVE\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(1, result.getCreated());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertTrue(result.isApplied());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Harness", saved.getName());
        assertEquals("Safe", saved.getDescription());
        assertEquals(8, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
    }

    @Test
    void importsSemicolonDelimitedCsvFromSpreadsheetExport() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("stock;categoryName;price;name;categoryId;id;description;status\n"
                        + "8;Harnesses;19.99;Harness;1;;\"Safe; reflective\";ACTIVE\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(1, result.getCreated());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertTrue(result.isApplied());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Harness", saved.getName());
        assertEquals("Safe; reflective", saved.getDescription());
        assertEquals(new BigDecimal("19.99"), saved.getPrice());
        assertEquals(8, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
    }

    @Test
    void importsUtf16LittleEndianCsvWithBomFromSpreadsheetExport() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        byte[] body = ("stock;categoryName;price;name;categoryId;id;description;status\n"
                + "8;Harnesses;19,99;Harness;1;;Safe;ACTIVE\n")
                .getBytes(StandardCharsets.UTF_16LE);
        byte[] csv = new byte[body.length + 2];
        csv[0] = (byte) 0xFF;
        csv[1] = (byte) 0xFE;
        System.arraycopy(body, 0, csv, 2, body.length);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                csv
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(1, result.getCreated());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertTrue(result.isApplied());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Harness", saved.getName());
        assertEquals(new BigDecimal("19.99"), saved.getPrice());
        assertEquals(8, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
    }

    @Test
    void importsDecimalCommaMoneyFromSpreadsheetExport() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name;description;price;stock;categoryName;originalPrice;limitedTimePrice;freeShipping;freeShippingThreshold\n"
                        + "Harness;Safe;19,99;8;Harnesses;29,90;17,50;true;49,99\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals(new BigDecimal("19.99"), saved.getPrice());
        assertEquals(new BigDecimal("29.90"), saved.getOriginalPrice());
        assertEquals(new BigDecimal("17.50"), saved.getLimitedTimePrice());
        assertTrue(saved.getFreeShipping());
        assertEquals(new BigDecimal("49.99"), saved.getFreeShippingThreshold());
    }

    @Test
    void importsCsvWithCommonSpreadsheetHeaderAliases() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("Title,Product Description,Sale Price,Inventory,Category ID,Image URL,Compare At Price,Featured\n"
                        + "Harness,Safe fit,19.99,8,1,https://example.com/harness.jpg,29.99,true\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Harness", saved.getName());
        assertEquals("Safe fit", saved.getDescription());
        assertEquals("19.99", saved.getPrice().toPlainString());
        assertEquals(8, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
        assertEquals("https://example.com/harness.jpg", saved.getImageUrl());
        assertEquals("29.99", saved.getOriginalPrice().toPlainString());
        assertTrue(saved.getIsFeatured());
    }

    @Test
    void importsCsvWithCategoryNameWhenCategoryIdIsMissing() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Category root = new Category();
        root.setId(10L);
        root.setName("Dog");
        Category child = new Category();
        child.setId(11L);
        child.setName("Harnesses");
        child.setParentId(10L);
        when(categoryRepository.findAll()).thenReturn(List.of(root, child));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,categoryName\n"
                        + "Harness,Safe fit,19.99,8,Dog > Harnesses\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        assertEquals(11L, captor.getValue().getCategoryId());
    }

    @Test
    void rejectsConflictingCategoryIdAndCategoryNameBeforeSaving() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Category dog = new Category();
        dog.setId(10L);
        dog.setName("Dog");
        Category cat = new Category();
        cat.setId(20L);
        cat.setName("Cat");
        when(categoryRepository.findAll()).thenReturn(List.of(dog, cat));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,categoryId,categoryName\n"
                        + "Harness,Safe fit,19.99,8,10,Cat\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("categoryName does not match categoryId"));
        assertEquals("categoryName", result.getRowErrors().get(0).getField());
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void acceptsAmbiguousCategoryNameWhenCategoryIdDisambiguatesIt() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Category dogHarnesses = new Category();
        dogHarnesses.setId(10L);
        dogHarnesses.setName("Harnesses");
        Category catHarnesses = new Category();
        catHarnesses.setId(20L);
        catHarnesses.setName("Harnesses");
        when(categoryRepository.findAll()).thenReturn(List.of(dogHarnesses, catHarnesses));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,categoryId,categoryName\n"
                        + "Harness,Safe fit,19.99,8,10,Harnesses\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(0, result.getFailed());
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        assertEquals(10L, captor.getValue().getCategoryId());
    }

    @Test
    void rejectsAmbiguousCategoryNameImports() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Category dogHarnesses = new Category();
        dogHarnesses.setId(10L);
        dogHarnesses.setName("Harnesses");
        Category catHarnesses = new Category();
        catHarnesses.setId(20L);
        catHarnesses.setName("Harnesses");
        when(categoryRepository.findAll()).thenReturn(List.of(dogHarnesses, catHarnesses));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,category\n"
                        + "Harness,Safe fit,19.99,8,Harnesses\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("categoryName matches multiple categories"));
        assertEquals("categoryName", result.getRowErrors().get(0).getField());
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsNamedHeaderCsvWhenRequiredColumnsAreMissing() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,price,stock\n"
                        + "Harness,19.99,8\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(0, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("CSV header missing required columns: categoryId"));
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsNamedHeaderImportWithOnlyIdColumn() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id\n"
                        + "3\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(0, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("at least one editable column besides id"));
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsDuplicateImportHeadersAfterAliasNormalization() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,price,sale price,stock,categoryId\n"
                        + "Harness,19.99,29.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(0, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("duplicate import columns: price"));
        assertEquals("price", result.getRowErrors().get(0).getField());
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsDuplicateNewProductNamesWithinSameCategory() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,categoryId\n"
                        + "Travel Harness,Safe,19.99,8,1\n"
                        + " travel   harness ,Reflective,24.99,4,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(2, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals("name", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("more than once for this category"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsUnsupportedImportHeadersBeforeReadingRows() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,price,stock,categoryId,prcie\n"
                        + "Harness,19.99,8,1,29.99\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertEquals(0, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("unsupported import columns: prcie"));
        assertEquals(ProductImportResult.STATUS_PREVIEW_BLOCKED, result.getStatus());
        assertFalse(result.isReadyToImport());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsNamedHeaderRowsWithNonBlankCellsBeyondHeaderColumns() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("name,description,price,stock,categoryId\n"
                        + "Harness,Safe,19.99,8,1,Unexpected value\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("beyond the header columns"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
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
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertTrue(result.isApplied());
        assertEquals("Dog Harness", captor.getValue().getName());
        assertEquals("Safe fit", captor.getValue().getDescription());
        assertEquals("PENDING_REVIEW", captor.getValue().getStatus());
    }

    @Test
    void returnsRejectedResultWhenDatabaseWriteFails() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        when(productRepository.save(any())).thenThrow(new IllegalStateException("database unavailable"));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,19.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getCreated());
        assertEquals(1, result.getFailed());
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        assertFalse(result.isReadyToImport());
        assertTrue(result.getErrors().get(0).contains("Failed to write product import"));
    }

    @Test
    void previewImportValidatesAndCountsRowsWithoutSaving() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/harness.jpg\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertTrue(result.isPreview());
        assertTrue(result.isReadyToImport());
        assertEquals(ProductImportResult.STATUS_PREVIEW_READY, result.getStatus());
        assertFalse(result.isApplied());
        assertImportTrace(result);
        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getCreated());
        verify(productRepository, never()).save(any());
    }

    @Test
    void previewCountsExistingRowsAsUpdatesWithoutSaving() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + "3,Harness,Safe,19.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.previewImportCsv(file);

        assertTrue(result.isPreview());
        assertEquals(ProductImportResult.STATUS_PREVIEW_READY, result.getStatus());
        assertFalse(result.isApplied());
        assertEquals(1, result.getUpdated());
        assertEquals(0, result.getCreated());
        verify(productRepository, times(1)).findById(3L);
        verify(productRepository, never()).save(any());
    }

    @Test
    void namedHeaderUpdatePreservesOmittedExistingProductFields() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        existing.setName("Old Harness");
        existing.setDescription("Existing detailed copy");
        existing.setPrice(new BigDecimal("18.00"));
        existing.setStock(4);
        existing.setCategoryId(99L);
        existing.setImageUrl("https://example.com/existing.jpg");
        existing.setIsFeatured(true);
        existing.setBrand("Existing Brand");
        existing.setStatus("PENDING_REVIEW");
        existing.setImages("[\"https://example.com/existing-extra.jpg\"]");
        existing.setSpecifications("{\"material\":\"nylon\"}");
        existing.setDetailContent("[{\"type\":\"text\",\"content\":\"Existing detail\"}]");
        existing.setWarranty("Existing warranty");
        existing.setShipping("Existing shipping");
        existing.setFreeShipping(true);
        existing.setFreeShippingThreshold(new BigDecimal("49.00"));
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,price,stock,categoryName\n"
                        + "3,Updated Harness,21.99,12,Harnesses\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertEquals(1, result.getUpdated());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Updated Harness", saved.getName());
        assertEquals(0, saved.getPrice().compareTo(new BigDecimal("21.99")));
        assertEquals(12, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
        assertEquals("Existing detailed copy", saved.getDescription());
        assertEquals("https://example.com/existing.jpg", saved.getImageUrl());
        assertTrue(saved.getIsFeatured());
        assertEquals("Existing Brand", saved.getBrand());
        assertEquals("PENDING_REVIEW", saved.getStatus());
        assertEquals("[\"https://example.com/existing-extra.jpg\"]", saved.getImages());
        assertEquals("{\"material\":\"nylon\"}", saved.getSpecifications());
        assertEquals("[{\"type\":\"text\",\"content\":\"Existing detail\"}]", saved.getDetailContent());
        assertEquals("Existing warranty", saved.getWarranty());
        assertEquals("Existing shipping", saved.getShipping());
        assertTrue(saved.getFreeShipping());
        assertEquals(0, saved.getFreeShippingThreshold().compareTo(new BigDecimal("49.00")));
    }

    @Test
    void importsStockOnlyUpdateForExistingProductId() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        existing.setName("Existing Harness");
        existing.setPrice(new BigDecimal("18.00"));
        existing.setStock(4);
        existing.setCategoryId(1L);
        existing.setBrand("Existing Brand");
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,stock\n"
                        + "3,12\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertEquals(1, result.getUpdated());
        assertEquals(0, result.getCreated());
        assertEquals(List.of("stock"), result.getUpdateFields());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Existing Harness", saved.getName());
        assertEquals(0, saved.getPrice().compareTo(new BigDecimal("18.00")));
        assertEquals(12, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
        assertEquals("Existing Brand", saved.getBrand());
    }

    @Test
    void importsPriceAndStockOnlyUpdateForExistingProductId() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        existing.setName("Existing Harness");
        existing.setPrice(new BigDecimal("18.00"));
        existing.setStock(4);
        existing.setCategoryId(1L);
        existing.setDescription("Keep this copy");
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,price,stock\n"
                        + "3,22.50,9\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertEquals(1, result.getUpdated());
        assertEquals(0, result.getCreated());
        assertEquals(List.of("price", "stock"), result.getUpdateFields());
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        Product saved = captor.getValue();
        assertEquals("Existing Harness", saved.getName());
        assertEquals(0, saved.getPrice().compareTo(new BigDecimal("22.50")));
        assertEquals(9, saved.getStock());
        assertEquals(1L, saved.getCategoryId());
        assertEquals("Keep this copy", saved.getDescription());
    }

    @Test
    void rejectsPriceOnlyUpdateThatWouldExceedExistingOriginalPrice() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        existing.setName("Existing Harness");
        existing.setPrice(new BigDecimal("18.00"));
        existing.setOriginalPrice(new BigDecimal("20.00"));
        existing.setStock(4);
        existing.setCategoryId(1L);
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,price\n"
                        + "3,22.50\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals(0, result.getCreated());
        assertEquals(0, result.getUpdated());
        assertEquals("originalPrice", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("originalPrice must be greater than or equal to price"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsLimitedTimePriceAbovePriceBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,limitedTimePrice\n"
                        + ",Harness,Safe,19.99,8,1,29.99\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals("limitedTimePrice", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("limitedTimePrice must be less than or equal to price"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsLimitedTimePriceOnlyUpdateThatWouldExceedExistingPrice() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        Product existing = new Product();
        existing.setId(3L);
        existing.setName("Existing Harness");
        existing.setPrice(new BigDecimal("20.00"));
        existing.setStock(4);
        existing.setCategoryId(1L);
        when(productRepository.findById(3L)).thenReturn(java.util.Optional.of(existing));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,limitedTimePrice\n"
                        + "3,29.99\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals("limitedTimePrice", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("limitedTimePrice must be less than or equal to price"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsLightweightUpdateRowsThatWouldCreateIncompleteProducts() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        when(productRepository.findById(404L)).thenReturn(java.util.Optional.empty());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,stock\n"
                        + "404,12\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals(0, result.getCreated());
        assertEquals(0, result.getUpdated());
        assertEquals("name", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("name is required"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
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
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsWholeFileWithoutPartialSaveWhenAnyRowFails() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,19.99,8,1\n"
                        + ",Broken,Invalid,-4.00,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(2, result.getTotalRows());
        assertEquals(1, result.getFailed());
        assertEquals(1, result.getCreated());
        assertTrue(result.getErrors().get(0).contains("price"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsUnknownImportedCategoryBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,19.99,8,999\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("categoryId", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("categoryId does not exist"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsImportedCategoryIdWhenNoCategoriesExist() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        when(categoryRepository.findAll()).thenReturn(List.of());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,19.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("categoryId", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("categoryId does not exist: 1"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsNegativePriceBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,-1.00,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("price", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsMoneyValuesWithMoreThanTwoDecimalsBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,19.999,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("price", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("price must use at most 2 decimal places"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsMoneyValuesAboveDatabasePrecisionBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,Safe,100000000.00,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("price", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("price must be 99999999.99 or less"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsAmbiguousCommaThousandsMoneyBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id;name;description;price;stock;categoryId\n"
                        + ";Harness;Safe;1,234;8;1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("price", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("price must be a decimal number"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsPrivateImportedImageUrlBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl\n"
                        + ",Harness,Safe,19.99,8,1,http://127.0.0.1/private.jpg\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("imageUrl", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void reportsTextMerchandisingFieldWhenImportedTextExceedsLimit() {
        String[][] cases = new String[][] {
                {"brand", "x".repeat(121)},
                {"tag", "x".repeat(81)},
                {"warranty", "x".repeat(501)},
                {"shipping", "x".repeat(501)}
        };

        for (String[] testCase : cases) {
            MockMultipartFile file = new MockMultipartFile(
                    "file",
                    "products.csv",
                    "text/csv",
                    ("id,name,description,price,stock,categoryId," + testCase[0] + "\n"
                            + ",Harness,Safe,19.99,8,1," + testCase[1] + "\n")
                            .getBytes(StandardCharsets.UTF_8)
            );

            ProductImportResult result = service.importCsv(file);

            assertEquals(1, result.getFailed());
            assertEquals(testCase[0], result.getRowErrors().get(0).getField());
        }
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidImportedImageJsonBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,not-json\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("images", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidImportedSpecificationsJsonBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],not-json\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("specifications", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsNestedImportedSpecificationsBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],\"{\"\"material\"\":{\"\"name\"\":\"\"cotton\"\"}}\"\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("specifications", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("values must be text"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidImportedDetailContentJsonBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],{},not-json\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("detailContent", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidImportedVariantsJsonBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent,warranty,shipping,status,freeShipping,freeShippingThreshold,variants\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],{},[],Warranty,Shipping,ACTIVE,false,,not-json\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("variants", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsImportedVariantsWithoutRequiredStructureBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent,warranty,shipping,status,freeShipping,freeShippingThreshold,variants\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],{},[],Warranty,Shipping,ACTIVE,false,,\"[{\"\"sku\"\":\"\"DUP\"\",\"\"options\"\":{\"\"Size\"\":\"\"S\"\"},\"\"price\"\":19.99,\"\"stock\"\":2},{\"\"sku\"\":\"\"DUP\"\",\"\"options\"\":{\"\"Size\"\":\"\"M\"\"},\"\"price\"\":21.99,\"\"stock\"\":1}]\"\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("variants", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("sku must be unique"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsImportedVariantPricesWithMoreThanTwoDecimalsBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent,warranty,shipping,status,freeShipping,freeShippingThreshold,variants\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],{},[],Warranty,Shipping,ACTIVE,false,,\"[{\"\"sku\"\":\"\"S\"\",\"\"options\"\":{\"\"Size\"\":\"\"S\"\"},\"\"price\"\":19.999,\"\"stock\"\":2}]\"\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("variants", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("variants price must use at most 2 decimal places"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsImportedDetailContentWithoutRequiredStructureBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent,warranty,shipping,status,freeShipping,freeShippingThreshold,variants\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,false,,,,,,,,[],{},\"[{\"\"type\"\":\"\"image\"\",\"\"caption\"\":\"\"Missing URL\"\"}]\",Warranty,Shipping,ACTIVE,false,,[]\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("detailContent", result.getRowErrors().get(0).getField());
        assertTrue(result.getErrors().get(0).contains("media URL is required"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidBooleanValuesBeforeSavingRow() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId,imageUrl,isFeatured,brand,originalPrice,discount,limitedTimePrice,limitedTimeStartAt,limitedTimeEndAt,tag,images,specifications,detailContent,warranty,shipping,status,freeShipping,freeShippingThreshold,variants\n"
                        + ",Harness,Safe,19.99,8,1,https://example.com/main.jpg,maybe,,,,,,,,[],{},[],Warranty,Shipping,ACTIVE,false,,[]\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertEquals("isFeatured", result.getRowErrors().get(0).getField());
        verify(productRepository, never()).save(any());
    }

    @Test
    void importsQuotedCsvRecordWithMultilineDescription() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,\"Line one\nLine two\",19.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        assertImportTrace(result);
        assertEquals(ProductImportResult.STATUS_APPLIED, result.getStatus());
        assertTrue(result.isApplied());
        assertEquals(1, result.getTotalRows());
        assertEquals(1, result.getCreated());
        assertEquals("Line one Line two", captor.getValue().getDescription());
    }

    @Test
    void rejectsMalformedMultilineCsvBeforeSaving() {
        when(runtimeConfig.getInt("product.import.max-rows", 1000)).thenReturn(5);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "products.csv",
                "text/csv",
                ("id,name,description,price,stock,categoryId\n"
                        + ",Harness,\"Line one\nLine two,19.99,8,1\n")
                        .getBytes(StandardCharsets.UTF_8)
        );

        ProductImportResult result = service.importCsv(file);

        assertEquals(1, result.getFailed());
        assertTrue(result.getErrors().get(0).contains("unterminated quoted field"));
        assertEquals(ProductImportResult.STATUS_REJECTED, result.getStatus());
        assertFalse(result.isApplied());
        verify(productRepository, never()).save(any());
    }

    private void assertImportTrace(ProductImportResult result) {
        assertNotNull(result.getImportId());
        assertTrue(result.getImportId().matches("[0-9a-fA-F-]{36}"));
        assertNotNull(result.getFileSha256());
        assertTrue(result.getFileSha256().matches("[0-9a-f]{64}"));
    }
}
