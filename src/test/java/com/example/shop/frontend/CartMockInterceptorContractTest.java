package com.example.shop.frontend;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CartMockInterceptorContractTest {

    @Test
    void productionFrontendDoesNotShipCartMockInterceptor() throws Exception {
        Path frontendSrc = Path.of("frontend/src");
        Path staleInterceptor = frontendSrc.resolve("api/interceptors/cartMockInterceptor.ts");

        assertFalse(Files.exists(staleInterceptor),
                "Production frontend must not include cartMockInterceptor.ts");

        List<Path> productionSources;
        try (Stream<Path> paths = Files.walk(frontendSrc)) {
            productionSources = paths
                    .filter(Files::isRegularFile)
                    .filter(CartMockInterceptorContractTest::isProductionSource)
                    .collect(Collectors.toList());
        }
        List<Path> offenders = productionSources.stream()
                .filter(CartMockInterceptorContractTest::mentionsCartMockInterceptor)
                .collect(Collectors.toList());

        assertFalse(productionSources.isEmpty(),
                "Sanity check should inspect production frontend source files");
        assertTrue(offenders.isEmpty(),
                "Production frontend source must not reference a cart mock interceptor: " + offenders);
    }

    private static boolean isProductionSource(Path path) {
        String name = path.getFileName().toString();
        if (!(name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".js") || name.endsWith(".jsx"))) {
            return false;
        }
        return !name.contains(".test.") && !name.contains(".spec.");
    }

    private static boolean mentionsCartMockInterceptor(Path path) {
        try {
            String source = Files.readString(path, StandardCharsets.UTF_8).toLowerCase();
            return source.contains("cartmockinterceptor")
                    || source.contains("cart mock interceptor")
                    || source.contains("mock cart interceptor");
        } catch (Exception e) {
            throw new IllegalStateException("Unable to inspect " + path, e);
        }
    }
}
