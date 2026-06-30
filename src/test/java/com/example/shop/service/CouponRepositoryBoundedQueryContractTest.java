package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class CouponRepositoryBoundedQueryContractTest {
    @Test
    void productionCodeDoesNotCallNoArgCouponRepositoryFindAll() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectNoArgCouponFindAll(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Use a bounded Pageable query instead of couponRepository.findAll():\n"
                + String.join("\n", offenders));
    }

    @Test
    void couponServiceListPathsUseBoundedRepositoryAndMapperCalls() throws IOException {
        String service = read("src/main/java/com/example/shop/service/CouponService.java");
        String repository = read("src/main/java/com/example/shop/repository/CouponRepository.java");

        String legacyFindAll = methodBlock(service, "public List<Coupon> findAll()");
        assertTrue(legacyFindAll.contains("resolveLimit(\"admin.coupons.search-max-rows\", 500, HARD_MAX_COUPON_ROWS)"));
        assertTrue(legacyFindAll.contains("couponRepository.findAll(PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, \"id\")))"));
        assertFalse(legacyFindAll.contains("couponRepository.findAll()"));

        String adminSearch = methodBlock(service,
                "public Page<Coupon> searchAdminCoupons(String keyword, String status, String scope, int page, int size)");
        assertTrue(adminSearch.contains("couponRepository.searchAdminCoupons("));
        assertTrue(adminSearch.contains("PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, \"id\"))"));

        String publicList = methodBlock(service, "public List<Coupon> findPublicActive()");
        assertTrue(publicList.contains("resolveLimit(\"coupon.public-list-max-rows\", 100, HARD_MAX_PUBLIC_COUPON_ROWS)"));
        assertTrue(publicList.contains("findClaimableByScopeAndStatus(PUBLIC, \"ACTIVE\", LocalDateTime.now(), PageRequest.of(0, limit))"));

        assertTrue(service.contains("userCouponMapper.findByUserIdLimited(userId, limit)"));
        assertTrue(service.contains("userCouponMapper.findUnusedByUserIdLimited(userId, limit)"));
        assertTrue(repository.contains("Page<Coupon> searchAdminCoupons("));
        assertTrue(repository.contains("List<Coupon> findClaimableByScopeAndStatus(@Param(\"scope\") String scope"));
        assertTrue(repository.contains("@Param(\"status\") String status"));
        assertTrue(repository.contains("@Param(\"now\") LocalDateTime now"));
    }

    @Test
    void unusedUnboundedCouponFinderMethodsHaveNoProductionCallSites() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .filter(path -> !path.endsWith("CouponRepository.java"))
                    .forEach(path -> collectUnboundedCouponFinderCalls(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Unbounded coupon repository finder call sites found:\n"
                + String.join("\n", offenders));
    }

    @Test
    void staleCouponAdminExpirationBatchPathIsAbsent() throws IOException {
        String service = read("src/main/java/com/example/shop/service/CouponService.java");
        String repository = read("src/main/java/com/example/shop/repository/CouponRepository.java");

        assertTrue(Files.notExists(Path.of("src/main/java/com/example/shop/service/CouponAdminService.java")));
        assertFalse(service.contains("expireCoupons("));
        assertFalse(service.contains("couponRepository.findExpiring"));
        assertFalse(service.contains("couponRepository.saveAll"));
        assertFalse(repository.contains("findExpiring("));
        assertTrue(service.contains("searchAdminCoupons("));
        assertTrue(service.contains("PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, \"id\"))"));
        assertTrue(service.contains("countAdminActiveExpiringBetween("));
        assertTrue(repository.contains("long countAdminActiveExpiringBetween("));
    }

    private static void collectNoArgCouponFindAll(Path path, List<String> offenders) {
        collectMatches(path, "couponRepository.findAll()", offenders);
    }

    private static void collectUnboundedCouponFinderCalls(Path path, List<String> offenders) {
        collectMatches(path, "findByStatusOrderByIdDesc(", offenders);
        collectMatches(path, "findByScopeAndStatusOrderByIdDesc(", offenders);
        String source = readUnchecked(path);
        int index = source.indexOf("findClaimableByScopeAndStatus(");
        while (index >= 0) {
            int lineEnd = source.indexOf('\n', index);
            String line = source.substring(index, lineEnd < 0 ? source.length() : lineEnd);
            if (!line.contains("PageRequest.of") && !line.contains("Pageable")) {
                offenders.add(path + ":" + lineNumber(source, index));
            }
            index = source.indexOf("findClaimableByScopeAndStatus(", index + 1);
        }
    }

    private static void collectMatches(Path path, String needle, List<String> offenders) {
        String source = readUnchecked(path);
        int index = source.indexOf(needle);
        while (index >= 0) {
            offenders.add(path + ":" + lineNumber(source, index));
            index = source.indexOf(needle, index + 1);
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String readUnchecked(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read source " + path, ex);
        }
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
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
        throw new AssertionError("Unterminated method body: " + signature);
    }

    private static int lineNumber(String source, int offset) {
        int line = 1;
        for (int index = 0; index < offset && index < source.length(); index++) {
            if (source.charAt(index) == '\n') {
                line++;
            }
        }
        return line;
    }
}
