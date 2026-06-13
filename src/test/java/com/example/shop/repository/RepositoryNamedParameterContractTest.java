package com.example.shop.repository;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RepositoryNamedParameterContractTest {
    private static final Pattern POSITIONAL_QUERY_PARAMETER = Pattern.compile("\\?[0-9]+");
    private static final List<Path> REPOSITORIES = List.of(
            Path.of("src/main/java/com/example/shop/repository/ProductRepository.java"),
            Path.of("src/main/java/com/example/shop/repository/CouponRepository.java"),
            Path.of("src/main/java/com/example/shop/repository/PetGalleryPhotoRepository.java")
    );

    @Test
    void repositoryQueriesUseNamedParametersInsteadOfPositionalMarkers() throws IOException {
        for (Path repository : REPOSITORIES) {
            String source = Files.readString(repository, StandardCharsets.UTF_8);
            assertFalse(POSITIONAL_QUERY_PARAMETER.matcher(source).find(),
                    () -> "Use named query parameters in " + repository);
        }
    }

    @Test
    void criticalAtomicUpdateQueriesKeepNamedParameterBindings() throws IOException {
        String productRepository = read("ProductRepository.java");
        String couponRepository = read("CouponRepository.java");
        String petGalleryPhotoRepository = read("PetGalleryPhotoRepository.java");

        assertTrue(productRepository.contains("stock = stock - :quantity"));
        assertTrue(productRepository.contains("where id = :productId and stock >= :quantity"));
        assertTrue(productRepository.contains("@Param(\"productId\") Long productId"));
        assertTrue(productRepository.contains("@Param(\"quantity\") Integer quantity"));

        assertTrue(couponRepository.contains("where c.id = :couponId and c.status = 'ACTIVE'"));
        assertTrue(couponRepository.contains("where id = :couponId"));
        assertTrue(couponRepository.contains("@Param(\"couponId\") Long couponId"));

        assertTrue(petGalleryPhotoRepository.contains("where (:status is null or p.status = :status)"));
        assertTrue(petGalleryPhotoRepository.contains("SELECT GET_LOCK(:lockName, 10)"));
        assertTrue(petGalleryPhotoRepository.contains("@Param(\"lockName\") String lockName"));
    }

    private String read(String fileName) throws IOException {
        return Files.readString(Path.of("src/main/java/com/example/shop/repository", fileName), StandardCharsets.UTF_8);
    }
}
