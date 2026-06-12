package com.example.shop.frontend;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class JwtRefreshBeforeExpiryContractTest {

    @Test
    void apiClientRefreshesJwtBeforeAttachingAuthorizationHeader() throws Exception {
        assertFalse(Files.exists(Path.of("frontend/src/api/interceptors/authInterceptor.ts")),
                "Stale authInterceptor.ts must not shadow the active API auth flow");

        String source = read(Path.of("frontend/src/api/index.ts"));

        String expiryParser = blockStartingAt(source, "const getJwtExpiryMs = (token: string)");
        assertTrue(expiryParser.contains("token.split('.')[1]"),
                "JWT expiry parser must read the token payload segment");
        assertTrue(expiryParser.contains("JSON.parse(atob(paddedPayload))"),
                "JWT expiry parser must decode the payload JSON");
        assertTrue(expiryParser.contains("expiresAtSeconds * 1000"),
                "JWT exp seconds must be converted to milliseconds");

        String expiringCheck = blockStartingAt(source, "const isJwtExpiring = (token: string, skewMs = 30_000)");
        assertTrue(expiringCheck.contains("getJwtExpiryMs(token)"),
                "Pre-expiry check must use the decoded JWT exp claim");
        assertTrue(expiringCheck.contains("Date.now() + skewMs"),
                "JWT must be considered expiring before the exact expiry instant");

        String refresh = blockStartingAt(source, "const refreshAuthToken = () =>");
        assertTrue(refresh.contains("api.post<AuthSessionResponse>('/auth/refresh'"),
                "Refresh flow must call the refresh endpoint");
        assertTrue(refresh.contains("skipAuthRefresh: true"),
                "Refresh request must not recursively refresh itself");
        assertTrue(refresh.contains("skipAuthHeader: true"),
                "Refresh request must not attach a stale access token");
        assertTrue(refresh.contains("persistAuthSession(response.data)"),
                "Successful refresh must persist the new auth session");
        assertTrue(refresh.contains(".catch(() => null)"),
                "Failed refresh must produce a null token for the caller");

        String requestInterceptor = section(source, "api.interceptors.request.use(", "api.interceptors.response.use(");
        assertTrue(requestInterceptor.contains("!authConfig.skipAuthHeader"),
                "Pre-expiry refresh must respect requests that intentionally skip auth headers");
        assertTrue(requestInterceptor.contains("!authConfig.skipAuthRefresh"),
                "Pre-expiry refresh must respect requests that intentionally skip refresh");
        assertTrue(requestInterceptor.contains("isJwtExpiring(token)"),
                "Request interceptor must check whether the access token is expiring");
        assertTrue(requestInterceptor.contains("token = await refreshAuthToken();"),
                "Request interceptor must refresh expiring tokens before sending");

        int expiryCheckIndex = requestInterceptor.indexOf("isJwtExpiring(token)");
        int refreshIndex = requestInterceptor.indexOf("token = await refreshAuthToken();");
        int attachIndex = requestInterceptor.indexOf("applyAuthorizationHeader");
        assertTrue(expiryCheckIndex >= 0 && expiryCheckIndex < refreshIndex,
                "The expiring-token check must happen before refresh");
        assertTrue(refreshIndex >= 0 && refreshIndex < attachIndex,
                "The refreshed token must be obtained before Authorization is attached");
    }

    private static String read(Path path) throws Exception {
        return Files.readString(path, StandardCharsets.UTF_8);
    }

    private static String section(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        int end = source.indexOf(endMarker, Math.max(start, 0));
        assertTrue(start >= 0, "Missing source marker: " + startMarker);
        assertTrue(end > start, "Missing source marker: " + endMarker);
        return source.substring(start, end);
    }

    private static String blockStartingAt(String source, String marker) {
        int markerIndex = source.indexOf(marker);
        assertTrue(markerIndex >= 0, "Missing source marker: " + marker);

        int braceStart = source.indexOf('{', markerIndex);
        assertTrue(braceStart >= 0, "Missing opening brace after marker: " + marker);

        int depth = 0;
        for (int index = braceStart; index < source.length(); index += 1) {
            char current = source.charAt(index);
            if (current == '{') {
                depth += 1;
            } else if (current == '}') {
                depth -= 1;
                if (depth == 0) {
                    return source.substring(markerIndex, index + 1);
                }
            }
        }

        return fail("Missing closing brace after marker: " + marker);
    }
}
