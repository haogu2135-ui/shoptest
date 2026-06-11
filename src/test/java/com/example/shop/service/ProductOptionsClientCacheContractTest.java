package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductOptionsClientCacheContractTest {

    @Test
    void productOptionDerivationDoesNotUseBrowserStorageCache() throws Exception {
        String source = trackedSource("frontend/src/utils/productOptions.ts");

        assertTrue(source.contains("export const getProductOptionGroups"));
        assertTrue(source.contains("export const getProductVariants"));
        assertTrue(source.contains("product.specifications || {}"));
        assertTrue(source.contains("const rawVariants = (product as { variants?: ProductVariant[] | string }).variants"));

        assertFalse(source.contains("localStorage"));
        assertFalse(source.contains("sessionStorage"));
        assertFalse(source.contains("getLocalStorageItem"));
        assertFalse(source.contains("setLocalStorageItem"));
        assertFalse(source.contains("PRODUCT_OPTIONS"));
        assertFalse(source.contains("product-options"));
        assertFalse(source.toLowerCase().contains("expiresat"));
        assertFalse(source.toLowerCase().contains("ttl"));
    }

    @Test
    void catalogSnapshotStorageHasTtlForAnyPersistedOptionsAndVariants() throws Exception {
        String source = trackedSource("frontend/src/utils/productCatalogSnapshot.ts");
        String save = methodBlock(source, "export const saveProductCatalogSnapshot = (products: ProductPublic[], now = Date.now()) =>");
        String load = methodBlock(source, "export const loadProductCatalogSnapshot = (now = Date.now()): ProductCatalogSnapshot | null =>");

        assertTrue(source.contains("export const PRODUCT_CATALOG_SNAPSHOT_KEY = 'shop-product-catalog-snapshot'"));
        assertTrue(source.contains("export const PRODUCT_CATALOG_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000"));
        assertTrue(source.contains("const MAX_SNAPSHOT_OPTIONS = 16"));
        assertTrue(source.contains("const MAX_SNAPSHOT_VARIANTS = 20"));
        assertTrue(source.contains("sizes: boundedStringList(product?.sizes, MAX_SNAPSHOT_OPTIONS)"));
        assertTrue(source.contains("colors: boundedStringList(product?.colors, MAX_SNAPSHOT_OPTIONS)"));
        assertTrue(source.contains("specifications: normalizeSpecifications(product?.specifications)"));
        assertTrue(source.contains("variants: normalizeVariants(product?.variants)"));

        assertTrue(save.contains("savedAt: now"));
        assertTrue(save.contains("setLocalStorageItem(PRODUCT_CATALOG_SNAPSHOT_KEY"));
        assertTrue(load.contains("now - savedAt > PRODUCT_CATALOG_SNAPSHOT_TTL_MS"));
        assertTrue(load.contains("return products.length ? { savedAt, products } : null"));
    }

    private static String trackedSource(String path) throws IOException, InterruptedException {
        return runGit("show", ":" + path);
    }

    private static String runGit(String... args) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException("git command failed: " + String.join(" ", command) + "\n" + output);
        }
        return output;
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing function signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing function body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated function body: " + signature);
    }
}
