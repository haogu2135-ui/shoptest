package com.example.shop.controller;

import com.example.shop.config.ApiErrorResponseFactory;
import com.example.shop.config.GlobalApiExceptionHandler;
import com.example.shop.dto.AdminBugReportRequest;
import com.example.shop.dto.AdminBugReportStatusRequest;
import com.example.shop.dto.AdminUserResponse;
import com.example.shop.dto.AdminUserUpdateRequest;
import com.example.shop.dto.CouponUpsertRequest;
import com.example.shop.dto.UserAddressRequest;
import com.example.shop.entity.AdminRole;
import com.example.shop.entity.AdminBugReport;
import com.example.shop.entity.Brand;
import com.example.shop.entity.Category;
import com.example.shop.entity.LogisticsCarrier;
import com.example.shop.entity.Product;
import com.example.shop.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ProductService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SystemAlertService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.servlet.http.HttpServletRequest;
import javax.validation.ConstraintViolation;
import javax.validation.Valid;
import javax.validation.Validation;
import javax.validation.Validator;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminRequestValidationContractTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void adminBugWriteEndpointsValidateRequestBodies() throws Exception {
        assertFirstParameterValid(AdminBugReportController.class, "create",
                AdminBugReportRequest.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminBugReportController.class, "update", 1,
                Long.class, AdminBugReportRequest.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminBugReportController.class, "updateStatus", 1,
                Long.class, AdminBugReportStatusRequest.class, Authentication.class, HttpServletRequest.class);
    }

    @Test
    void staleAdminFeedbackEntityEndpointIsAbsent() throws Exception {
        String adminControllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"));

        assertFalse(adminControllerSource.contains("createFeedback("));
        assertFalse(adminControllerSource.contains("@RequestBody Feedback"));
        assertFalse(adminControllerSource.contains("@RequestBody(required = false) Feedback"));
    }

    @Test
    void adminBugReportRequestRejectsBlankTitleAndOversizedFields() {
        AdminBugReportRequest request = new AdminBugReportRequest();
        request.setTitle(" ");
        request.setDescription(" ");
        request.setModule("x".repeat(41));
        request.setReproductionSteps("x".repeat(4001));

        Set<ConstraintViolation<AdminBugReportRequest>> violations = validator.validate(request);

        assertHasViolation(violations, "title");
        assertHasViolation(violations, "description");
        assertHasViolation(violations, "module");
        assertHasViolation(violations, "reproductionSteps");
    }

    @Test
    void adminBugReportEntityCarriesStorageAlignedValidation() {
        AdminBugReport report = new AdminBugReport();
        report.setTitle(" ");
        report.setDescription(" ");
        report.setModule("x".repeat(41));
        report.setScanNote("x".repeat(2001));

        Set<ConstraintViolation<AdminBugReport>> violations = validator.validate(report);

        assertHasViolation(violations, "title");
        assertHasViolation(violations, "description");
        assertHasViolation(violations, "module");
        assertHasViolation(violations, "scanNote");
    }

    @Test
    void adminBugReportStatusRequestRejectsOversizedStatusNotesAndAssignee() {
        AdminBugReportStatusRequest request = new AdminBugReportStatusRequest();
        request.setStatus("x".repeat(41));
        request.setNote("x".repeat(2001));
        request.setAssignedTo("x".repeat(121));

        Set<ConstraintViolation<AdminBugReportStatusRequest>> violations = validator.validate(request);

        assertHasViolation(violations, "status");
        assertHasViolation(violations, "note");
        assertHasViolation(violations, "assignedTo");
    }

    @Test
    void productWriteEndpointsValidateRequestBodies() throws Exception {
        assertFirstParameterValid(AdminController.class, "createProduct",
                Product.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminController.class, "updateProduct", 1,
                Long.class, Product.class, Authentication.class, HttpServletRequest.class);
        assertFirstParameterValid(ProductController.class, "createProduct",
                Product.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(ProductController.class, "updateProduct", 1,
                Long.class, Product.class, Authentication.class, HttpServletRequest.class);
    }

    @Test
    void adminCatalogAndCouponWriteEndpointsValidateRequestBodies() throws Exception {
        assertFirstParameterValid(AdminController.class, "createBrand",
                Brand.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminController.class, "updateBrand", 1,
                Long.class, Brand.class, Authentication.class, HttpServletRequest.class);
        assertFirstParameterValid(AdminController.class, "createCategory",
                Category.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminController.class, "updateCategory", 1,
                Long.class, Category.class, Authentication.class, HttpServletRequest.class);
        assertFirstParameterValid(AdminController.class, "createCoupon",
                CouponUpsertRequest.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminController.class, "updateCoupon", 1,
                Long.class, CouponUpsertRequest.class, Authentication.class, HttpServletRequest.class);
    }

    @Test
    void adminRoleLogisticsAndAddressWriteEndpointsValidateRequestBodies() throws Exception {
        assertFirstParameterValid(AdminController.class, "saveRole",
                AdminRole.class, Authentication.class, HttpServletRequest.class);
        assertFirstParameterValid(AdminController.class, "createLogisticsCarrier",
                LogisticsCarrier.class, Authentication.class, HttpServletRequest.class);
        assertParameterValid(AdminController.class, "updateLogisticsCarrier", 1,
                Long.class, LogisticsCarrier.class, Authentication.class, HttpServletRequest.class);
        assertFirstParameterValid(UserAddressController.class, "addAddress",
                UserAddressRequest.class, Authentication.class);
        assertParameterValid(UserAddressController.class, "updateAddress", 1,
                Long.class, UserAddressRequest.class, Authentication.class);
    }

    @Test
    void adminUserUpdateEndpointUsesDedicatedValidatedDto() throws Exception {
        assertParameterValid(AdminController.class, "updateUser", 1,
                Long.class, AdminUserUpdateRequest.class, Authentication.class, HttpServletRequest.class);

        List.of("id", "username", "password", "passwordHash", "email", "phone", "role", "roleCode", "createdAt", "updatedAt")
                .forEach(fieldName -> assertFalse(hasDeclaredField(AdminUserUpdateRequest.class, fieldName),
                        () -> "Admin user updates must not expose field: " + fieldName));
    }

    @Test
    void adminUserResponsesAndExportsNeverExposePassword() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setUsername("operator");
        user.setPassword("encoded-password-value");
        user.setEmail("operator@example.com");
        user.setPhone("15551234567");
        user.setRole("ADMIN");
        user.setRoleCode("SUPER_ADMIN");
        user.setStatus("ACTIVE");

        AdminUserResponse response = AdminUserResponse.from(user);
        String responseJson = new ObjectMapper().writeValueAsString(response);
        String adminUserResponseSource = Files.readString(Path.of("src/main/java/com/example/shop/dto/AdminUserResponse.java"));
        String adminControllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/AdminController.java"));
        int csvHeaderStart = adminControllerSource.indexOf("CsvUtils.row(Arrays.asList(\"id\", \"username\", \"email\", \"phone\", \"role\", \"roleCode\", \"status\", \"createdAt\"))");
        int csvHeaderEnd = adminControllerSource.indexOf("for (User user : users)", csvHeaderStart);

        assertFalse(hasDeclaredField(AdminUserResponse.class, "password"));
        assertFalse(responseJson.contains("password"));
        assertFalse(responseJson.contains("encoded-password-value"));
        assertFalse(adminUserResponseSource.contains("getPassword()"));
        assertTrue(adminControllerSource.contains(".map(AdminUserResponse::from)"));
        assertTrue(adminControllerSource.contains("ResponseEntity.ok(AdminUserResponse.from(updated))"));
        assertTrue(csvHeaderStart >= 0);
        assertTrue(csvHeaderEnd > csvHeaderStart);
        String exportCsvSection = adminControllerSource.substring(csvHeaderStart, csvHeaderEnd);
        assertFalse(exportCsvSection.toLowerCase().contains("password"));
    }

    @Test
    void adminUserUpdateRequestBoundsAllowedFieldsAndCapturesForbiddenFields() throws Exception {
        AdminUserUpdateRequest oversized = new AdminUserUpdateRequest();
        oversized.setStatus("x".repeat(21));
        oversized.setAddress("x".repeat(261));

        Set<ConstraintViolation<AdminUserUpdateRequest>> violations = validator.validate(oversized);

        assertHasViolation(violations, "status");
        assertHasViolation(violations, "address");

        AdminUserUpdateRequest request = new ObjectMapper().readValue(
                "{\"status\":\"ACTIVE\",\"address\":\"front desk\",\"email\":\"owner@example.com\","
                        + "\"phone\":\"5550100\",\"role\":\"SUPER_ADMIN\",\"roleCode\":\"OPS\",\"id\":42}",
                AdminUserUpdateRequest.class);

        assertEquals("ACTIVE", request.getStatus());
        assertEquals("front desk", request.getAddress());
        assertTrue(request.hasUnsupportedFields());
        assertTrue(request.getUnsupportedFields().containsAll(Set.of("email", "phone", "role", "roleCode", "id")));
    }

    @Test
    void adminCatalogAndCouponRequestsRejectInvalidFields() {
        Brand brand = new Brand();
        brand.setName(" ");
        brand.setDescription("x".repeat(2001));
        brand.setStatus(" ");
        Category category = new Category();
        category.setName(" ");
        category.setLevel(0);
        category.setImageUrl("x".repeat(2001));
        CouponUpsertRequest coupon = new CouponUpsertRequest();
        coupon.setName(" ");
        coupon.setCouponType(" ");

        Set<ConstraintViolation<Brand>> brandViolations = validator.validate(brand);
        Set<ConstraintViolation<Category>> categoryViolations = validator.validate(category);
        Set<ConstraintViolation<CouponUpsertRequest>> couponViolations = validator.validate(coupon);

        assertHasViolation(brandViolations, "name");
        assertHasViolation(brandViolations, "description");
        assertHasViolation(brandViolations, "status");
        assertHasViolation(categoryViolations, "name");
        assertHasViolation(categoryViolations, "level");
        assertHasViolation(categoryViolations, "imageUrl");
        assertHasViolation(couponViolations, "name");
        assertHasViolation(couponViolations, "couponType");
    }

    @Test
    void adminRoleLogisticsAndAddressRequestsRejectInvalidFields() {
        AdminRole role = new AdminRole();
        role.setCode(" ");
        role.setName(" ");
        role.setStatus(" ");
        LogisticsCarrier carrier = new LogisticsCarrier();
        carrier.setName(" ");
        carrier.setTrackingCode(" ");
        carrier.setStatus(" ");
        UserAddressRequest address = new UserAddressRequest();
        address.setRecipientName(" ");
        address.setPhone(" ");
        address.setPostalCode(" ");
        address.setDetailAddress(" ");
        address.setAddress(" ");

        Set<ConstraintViolation<AdminRole>> roleViolations = validator.validate(role);
        Set<ConstraintViolation<LogisticsCarrier>> carrierViolations = validator.validate(carrier);
        Set<ConstraintViolation<UserAddressRequest>> addressViolations = validator.validate(address);

        assertHasViolation(roleViolations, "code");
        assertHasViolation(roleViolations, "name");
        assertHasViolation(roleViolations, "status");
        assertHasViolation(carrierViolations, "name");
        assertHasViolation(carrierViolations, "trackingCode");
        assertHasViolation(carrierViolations, "status");
        assertHasViolation(addressViolations, "recipientName");
        assertHasViolation(addressViolations, "phone");
        assertHasViolation(addressViolations, "region");
        assertHasViolation(addressViolations, "postalCode");
        assertHasViolation(addressViolations, "detailAddress");
        assertHasViolation(addressViolations, "address");
    }

    @Test
    void productRequestRejectsOversizedNameBeforeServiceSave() throws Exception {
        ProductService productService = mock(ProductService.class);
        ProductController controller = new ProductController();
        ReflectionTestUtils.setField(controller, "productService", productService);
        ReflectionTestUtils.setField(controller, "auditLogService", mock(SecurityAuditLogService.class));
        ReflectionTestUtils.setField(controller, "adminRoleService", mock(AdminRoleService.class));
        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .setControllerAdvice(new GlobalApiExceptionHandler(
                        new ApiErrorResponseFactory(),
                        mock(SystemAlertService.class)))
                .build();

        mockMvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + "x".repeat(201)
                                + "\",\"price\":12.34,\"categoryId\":1,\"status\":\"ACTIVE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("name")));

        verify(productService, never()).save(any(Product.class));
    }

    @Test
    void productEntityRejectsRequiredAndBoundedFields() {
        Product product = new Product();
        product.setName("x".repeat(201));
        product.setPrice(BigDecimal.ONE);
        product.setCategoryId(1L);
        product.setStatus("x".repeat(21));
        product.setDescription("x".repeat(1001));
        product.setImageUrl("x".repeat(2001));

        Set<ConstraintViolation<Product>> violations = validator.validate(product);

        assertHasViolation(violations, "name");
        assertHasViolation(violations, "status");
        assertHasViolation(violations, "description");
        assertHasViolation(violations, "imageUrl");
    }

    private static void assertFirstParameterValid(Class<?> controllerClass,
                                                  String methodName,
                                                  Class<?>... parameterTypes) throws Exception {
        assertParameterValid(controllerClass, methodName, 0, parameterTypes);
    }

    private static void assertParameterValid(Class<?> controllerClass,
                                             String methodName,
                                             int parameterIndex,
                                             Class<?>... parameterTypes) throws Exception {
        Method method = controllerClass.getMethod(methodName, parameterTypes);
        assertTrue(method.getParameters()[parameterIndex].isAnnotationPresent(Valid.class),
                () -> controllerClass.getSimpleName() + "." + methodName + " body parameter must keep @Valid");
    }

    private static void assertHasViolation(Set<? extends ConstraintViolation<?>> violations, String property) {
        assertFalse(violations.isEmpty(), "Expected validation violations");
        assertTrue(violations.stream()
                        .anyMatch(violation -> property.contentEquals(violation.getPropertyPath().toString())),
                () -> "Expected violation for property: " + property);
    }

    private static boolean hasDeclaredField(Class<?> target, String fieldName) {
        try {
            target.getDeclaredField(fieldName);
            return true;
        } catch (NoSuchFieldException ignored) {
            return false;
        }
    }
}
