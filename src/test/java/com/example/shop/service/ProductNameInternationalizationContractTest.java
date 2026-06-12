package com.example.shop.service;

import com.example.shop.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductNameInternationalizationContractTest {

    private static final String INTERNATIONAL_NAME = "\u5ba0\u7269\u80cc\u5305 \ud83d\udc3e Ni\u00f1o \ud55c\uad6d \u30cf\u30fc\u30cd\u30b9";

    @Test
    void productEntityNameFieldDoesNotUseAsciiOnlyPattern() throws Exception {
        Path productEntity = Path.of("src/main/java/com/example/shop/entity/Product.java");
        String source = Files.readString(productEntity, StandardCharsets.UTF_8);
        int nameField = source.indexOf("private String name;");
        assertTrue(nameField > 0, "Product entity should expose a name field");

        int annotationStart = source.lastIndexOf("@Column", nameField);
        assertTrue(annotationStart > 0, "Product name should keep validation annotations near the field");
        String nameAnnotations = source.substring(annotationStart, nameField);

        assertTrue(nameAnnotations.contains("@NotBlank"), "Product name should remain required");
        assertTrue(nameAnnotations.contains("@Size(max = 200)"), "Product name should remain length bounded");
        assertFalse(nameAnnotations.contains("@Pattern"), "Product name must not use an ASCII-only regex pattern");
        assertFalse(productValidatorExists(), "Current source should not reintroduce a stale ProductValidator class");
    }

    @Test
    void directProductNameNormalizerPreservesInternationalCharacters() throws Exception {
        ProductServiceImpl service = new ProductServiceImpl();
        String input = "  " + INTERNATIONAL_NAME + "\n  ";

        assertEquals(INTERNATIONAL_NAME,
                invokeStringMethod(service, "normalizeDirectText",
                        new Class<?>[] {String.class, String.class, int.class, boolean.class},
                        input, "name", 180, true));
    }

    @Test
    void csvAndUrlProductNameNormalizersPreserveInternationalCharacters() throws Exception {
        ProductServiceImpl productService = new ProductServiceImpl();
        ProductUrlImportService urlImportService = new ProductUrlImportService();
        String input = "  " + INTERNATIONAL_NAME + "\t\n  ";

        assertEquals(INTERNATIONAL_NAME,
                invokeStringMethod(productService, "normalizeImportText",
                        new Class<?>[] {String.class},
                        input));
        assertEquals(INTERNATIONAL_NAME,
                invokeStringMethod(urlImportService, "cleanText",
                        new Class<?>[] {String.class},
                        input));
    }

    private static boolean productValidatorExists() throws Exception {
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            return paths
                    .filter(Files::isRegularFile)
                    .anyMatch(path -> "ProductValidator.java".equals(path.getFileName().toString()));
        }
    }

    private static String invokeStringMethod(Object target, String methodName, Class<?>[] parameterTypes, Object... args)
            throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
        method.setAccessible(true);
        try {
            return (String) method.invoke(target, args);
        } catch (InvocationTargetException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof Exception) {
                throw (Exception) cause;
            }
            if (cause instanceof Error) {
                throw (Error) cause;
            }
            throw ex;
        }
    }
}
