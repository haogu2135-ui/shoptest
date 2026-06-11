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

class CouponEligibilityQueryContractTest {

    @Test
    void productionCodeDoesNotUseStaleUnboundedEligibleCouponPath() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectStaleEligibleCouponCalls(path, offenders));
        }

        assertTrue(offenders.isEmpty(), () -> "Use bounded user-coupon eligibility queries instead of stale full scans:\n"
                + String.join("\n", offenders));
    }

    @Test
    void couponQuoteAndAvailableCouponsUseBoundedUserCouponQuery() throws IOException {
        String service = read("src/main/java/com/example/shop/service/CouponService.java");

        String findAvailable = methodBlock(service, "public List<UserCoupon> findAvailableUserCoupons(Long userId)");
        assertTrue(findAvailable.contains("resolveLimit(\"coupon.available-max-rows\", 100, HARD_MAX_PUBLIC_COUPON_ROWS)"));
        assertTrue(findAvailable.contains("userCouponMapper.findUnusedByUserIdLimited(userId, limit)"));
        assertFalse(findAvailable.contains("findUnusedByUserId(userId)"));
        assertFalse(findAvailable.contains("couponRepository.findByStatusOrderByIdDesc"));
        assertFalse(findAvailable.contains("couponRepository.findAll("));

        String quote = methodBlock(service,
                "public CouponQuoteResponse quote(Long userId, List<CartItem> cartItems, Long userCouponId)");
        assertTrue(quote.contains("List<UserCoupon> available = findAvailableUserCoupons(userId).stream()"));
        assertFalse(quote.contains("couponRepository.findAll("));
        assertFalse(quote.contains("findByStatusOrderByIdDesc"));
        assertFalse(quote.contains("findUnusedByUserId(userId)"));
    }

    @Test
    void availableCouponMapperPushesStatusTimeAndLimitToSql() throws IOException {
        String mapper = read("src/main/resources/mapper/UserCouponMapper.xml");
        String limitedQuery = xmlBlock(mapper, "<select id=\"findUnusedByUserIdLimited\"", "</select>");

        assertTrue(limitedQuery.contains("WHERE uc.user_id = #{userId}"));
        assertTrue(limitedQuery.contains("AND uc.status = 'UNUSED'"));
        assertTrue(limitedQuery.contains("AND c.status = 'ACTIVE'"));
        assertTrue(limitedQuery.contains("AND (c.start_at IS NULL OR c.start_at &lt;= NOW())"));
        assertTrue(limitedQuery.contains("AND (c.end_at IS NULL OR c.end_at &gt;= NOW())"));
        assertTrue(limitedQuery.contains("ORDER BY c.end_at ASC, uc.id DESC"));
        assertTrue(limitedQuery.contains("LIMIT #{limit}"));
    }

    private static void collectStaleEligibleCouponCalls(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }

        collectNeedle(path, source, "getEligibleCoupons", offenders);
        collectNeedle(path, source, "getAvailableCoupons", offenders);
        collectNeedle(path, source, "couponRepository.findByStatusOrderByIdDesc(", offenders);
        collectNeedle(path, source, "couponRepository.findAll()", offenders);
        collectNeedle(path, source, "userCouponMapper.findUnusedByUserId(userId)", offenders);
    }

    private static void collectNeedle(Path path, String source, String needle, List<String> offenders) {
        int index = source.indexOf(needle);
        while (index >= 0) {
            offenders.add(path + ":" + lineNumber(source, index) + ": " + needle);
            index = source.indexOf(needle, index + needle.length());
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
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

    private static String xmlBlock(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing XML block start: " + startMarker);
        int end = source.indexOf(endMarker, start);
        assertTrue(end >= 0, "Missing XML block end: " + endMarker);
        return source.substring(start, end + endMarker.length());
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
