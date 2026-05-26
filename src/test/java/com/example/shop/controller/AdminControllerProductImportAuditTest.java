package com.example.shop.controller;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.dto.ProductImportHistoryEntry;
import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.CouponService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.ProductQuestionService;
import com.example.shop.service.ProductService;
import com.example.shop.service.ProductUrlImportService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.Authentication;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerProductImportAuditTest {

    private final ProductService productService = mock(ProductService.class);
    private final ProductUrlImportService productUrlImportService = mock(ProductUrlImportService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
    private final AdminController controller = new AdminController(
            mock(UserService.class),
            mock(OrderService.class),
            mock(OrderItemService.class),
            productService,
            mock(ProductQuestionService.class),
            productUrlImportService,
            mock(ReviewService.class),
            mock(CouponService.class),
            mock(NotificationService.class),
            mock(PetBirthdayCouponService.class),
            mock(LogisticsCarrierService.class),
            auditLogService,
            mock(AdminRoleService.class),
            mock(PaymentRepository.class),
            mock(RuntimeConfigService.class)
    );

    @Test
    void previewImportWritesSuccessfulAuditLog() {
        MockMultipartFile file = csvFile("products.csv");
        ProductImportResult result = new ProductImportResult();
        result.setPreview(true);
        result.setImportId("import-123");
        result.setFileSha256("abc123");
        result.setReadyToImport(true);
        result.setTotalRows(2);
        result.setCreated(1);
        result.setUpdated(1);
        result.setUpdateFields(List.of("price", "stock"));
        when(productService.previewImportCsv(file)).thenReturn(result);
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<ProductImportResult> response = controller.previewImportProducts(file, authentication, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(result, response.getBody());
        verify(auditLogService).record(
                eq("PRODUCT_IMPORT_PREVIEW"),
                eq("SUCCESS"),
                same(authentication),
                eq("PRODUCT_IMPORT"),
                eq("products.csv"),
                same(request),
                eq("Product import preview passed"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("preview=true"));
        assertTrue(metadata.getValue().contains("importId=import-123"));
        assertTrue(metadata.getValue().contains("fileSha256=abc123"));
        assertTrue(metadata.getValue().contains("status=" + ProductImportResult.STATUS_PREVIEW_READY));
        assertTrue(metadata.getValue().contains("updateFields=price%2Cstock"));
        assertTrue(metadata.getValue().contains("readyToImport=true"));
        assertTrue(metadata.getValue().contains("applied=false"));
        assertTrue(metadata.getValue().contains("totalRows=2"));
        assertTrue(metadata.getValue().contains("created=1"));
        assertTrue(metadata.getValue().contains("updated=1"));
    }

    @Test
    void importAuditMetadataEscapesFilenamesForHistoryParsing() {
        MockMultipartFile file = csvFile("products + summer;v=2.csv");
        ProductImportResult result = new ProductImportResult();
        result.setPreview(true);
        result.setImportId("import-456");
        result.setFileSha256("def456");
        result.setReadyToImport(true);
        result.setTotalRows(1);
        result.setCreated(1);
        result.setUpdateFields(List.of("price", "stock"));
        when(productService.previewImportCsv(file)).thenReturn(result);
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        controller.previewImportProducts(file, authentication, request);

        verify(auditLogService).record(
                eq("PRODUCT_IMPORT_PREVIEW"),
                eq("SUCCESS"),
                same(authentication),
                eq("PRODUCT_IMPORT"),
                eq("products + summer;v=2.csv"),
                same(request),
                eq("Product import preview passed"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("filename=products%20%2B%20summer%3Bv%3D2.csv"));

        SecurityAuditLog log = new SecurityAuditLog();
        log.setId(44L);
        log.setAction("PRODUCT_IMPORT_PREVIEW");
        log.setResult("SUCCESS");
        log.setResourceType("PRODUCT_IMPORT");
        log.setResourceId("products + summer;v=2.csv");
        log.setMessage("Product import preview passed");
        log.setCreatedAt(LocalDateTime.of(2026, 5, 25, 11, 30));
        log.setMetadata(metadata.getValue());
        when(auditLogService.search(isNull(), isNull(), isNull(), eq("PRODUCT_IMPORT"), isNull(), isNull(), eq(3)))
                .thenReturn(List.of(log));

        ResponseEntity<List<ProductImportHistoryEntry>> history = controller.getProductImportHistory(1);

        assertEquals(1, history.getBody().size());
        assertEquals("products + summer;v=2.csv", history.getBody().get(0).getFilename());
        assertEquals("import-456", history.getBody().get(0).getImportId());
        assertEquals("def456", history.getBody().get(0).getFileSha256());
        assertEquals(List.of("price", "stock"), history.getBody().get(0).getUpdateFields());
    }

    @Test
    void importHistoryKeepsLegacyPlusSignsInUnencodedMetadata() {
        SecurityAuditLog applyLog = new SecurityAuditLog();
        applyLog.setId(45L);
        applyLog.setAction("PRODUCT_IMPORT_APPLY");
        applyLog.setResult("SUCCESS");
        applyLog.setResourceType("PRODUCT_IMPORT");
        applyLog.setResourceId("products+legacy.csv");
        applyLog.setMessage("Product import completed");
        applyLog.setCreatedAt(LocalDateTime.of(2026, 5, 25, 12, 30));
        applyLog.setMetadata("importId=import-plus;fileSha256=abc789;filename=products+legacy.csv;sizeBytes=128;preview=false;readyToImport=true;applied=true;totalRows=1;created=1;updated=0;failed=0");
        when(auditLogService.search(isNull(), isNull(), isNull(), eq("PRODUCT_IMPORT"), isNull(), isNull(), eq(3)))
                .thenReturn(List.of(applyLog));

        ResponseEntity<List<ProductImportHistoryEntry>> history = controller.getProductImportHistory(1);

        assertEquals(1, history.getBody().size());
        assertEquals("products+legacy.csv", history.getBody().get(0).getFilename());
        assertEquals("import-plus", history.getBody().get(0).getImportId());
    }

    @Test
    void applyImportWritesFailureAuditLogWhenRowsAreRejected() {
        MockMultipartFile file = csvFile("bad-products.csv");
        ProductImportResult result = new ProductImportResult();
        result.setTotalRows(1);
        result.addError(2, "price", "price must be greater than or equal to zero");
        when(productService.importCsv(file)).thenReturn(result);
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<ProductImportResult> response = controller.importProducts(file, authentication, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(result, response.getBody());
        verify(auditLogService).record(
                eq("PRODUCT_IMPORT_APPLY"),
                eq("FAILURE"),
                same(authentication),
                eq("PRODUCT_IMPORT"),
                eq("bad-products.csv"),
                same(request),
                eq("Product import rejected"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("preview=false"));
        assertTrue(metadata.getValue().contains("status=" + ProductImportResult.STATUS_REJECTED));
        assertTrue(metadata.getValue().contains("readyToImport=false"));
        assertTrue(metadata.getValue().contains("applied=false"));
        assertTrue(metadata.getValue().contains("failed=1"));
    }

    @Test
    void importHistoryReturnsTypedEntriesFromAuditMetadata() {
        SecurityAuditLog applyLog = new SecurityAuditLog();
        applyLog.setId(42L);
        applyLog.setAction("PRODUCT_IMPORT_APPLY");
        applyLog.setResult("SUCCESS");
        applyLog.setResourceType("PRODUCT_IMPORT");
        applyLog.setResourceId("products.csv");
        applyLog.setMessage("Product import completed");
        applyLog.setCreatedAt(LocalDateTime.of(2026, 5, 25, 10, 30));
        applyLog.setMetadata("importId=import-123;fileSha256=abc123;filename=products.csv;sizeBytes=512;preview=false;readyToImport=true;updateFields=price%2Cstock;totalRows=3;created=2;updated=1;failed=0");

        SecurityAuditLog urlLog = new SecurityAuditLog();
        urlLog.setId(43L);
        urlLog.setAction("PRODUCT_URL_IMPORT");
        urlLog.setResult("SUCCESS");
        urlLog.setResourceType("PRODUCT_IMPORT");
        urlLog.setResourceId("supplier.example.com");
        urlLog.setMessage("Product URL import preview generated");
        urlLog.setCreatedAt(LocalDateTime.of(2026, 5, 25, 10, 29));
        urlLog.setMetadata("sourceHost=supplier.example.com;confidenceScore=82;imageCount=4;blockedImageCount=1;warningCount=2");

        when(auditLogService.search(isNull(), isNull(), isNull(), eq("PRODUCT_IMPORT"), isNull(), isNull(), eq(18)))
                .thenReturn(List.of(applyLog, urlLog));

        ResponseEntity<List<ProductImportHistoryEntry>> response = controller.getProductImportHistory(6);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, response.getBody().size());
        ProductImportHistoryEntry entry = response.getBody().get(0);
        assertEquals(42L, entry.getAuditLogId());
        assertEquals("PRODUCT_IMPORT_APPLY", entry.getAction());
        assertEquals("SUCCESS", entry.getResult());
        assertEquals("products.csv", entry.getFilename());
        assertEquals("import-123", entry.getImportId());
        assertEquals("abc123", entry.getFileSha256());
        assertEquals(ProductImportResult.STATUS_APPLIED, entry.getStatus());
        assertEquals(512L, entry.getSizeBytes());
        assertEquals(3, entry.getTotalRows());
        assertEquals(2, entry.getCreated());
        assertEquals(1, entry.getUpdated());
        assertEquals(0, entry.getFailed());
        assertEquals(List.of("price", "stock"), entry.getUpdateFields());
        assertTrue(entry.isReadyToImport());
        assertTrue(entry.isApplied());

        ProductImportHistoryEntry urlEntry = response.getBody().get(1);
        assertEquals(43L, urlEntry.getAuditLogId());
        assertEquals("PRODUCT_URL_IMPORT", urlEntry.getAction());
        assertEquals("supplier.example.com", urlEntry.getFilename());
        assertEquals(ProductImportResult.STATUS_PREVIEW_READY, urlEntry.getStatus());
        assertTrue(urlEntry.isPreview());
        assertTrue(urlEntry.isReadyToImport());
        assertFalse(urlEntry.isApplied());
        assertEquals("supplier.example.com", urlEntry.getSourceHost());
        assertEquals(82, urlEntry.getConfidenceScore());
        assertEquals(4, urlEntry.getImageCount());
        assertEquals(1, urlEntry.getBlockedImageCount());
        assertEquals(2, urlEntry.getWarningCount());
    }

    private MockMultipartFile csvFile(String filename) {
        return new MockMultipartFile(
                "file",
                filename,
                "text/csv",
                "id,name,description,price,stock,categoryId\n".getBytes(StandardCharsets.UTF_8)
        );
    }
}
