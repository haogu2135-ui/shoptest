package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BugManagementPageUrlValidationContractTest {

    @Test
    void bugManagementPageUrlOnlyAcceptsHttpUrls() throws Exception {
        String source = Files.readString(Path.of("frontend/src/pages/BugManagement.tsx"), StandardCharsets.UTF_8);
        String validator = sliceBetween(source,
                "const validatePageUrl = useCallback",
                "const withPermissionTooltip");

        assertTrue(validator.contains("new URL(normalized)"),
                "Page URL validation should parse URLs with the platform URL parser");
        assertTrue(validator.contains("parsed.protocol === 'http:' || parsed.protocol === 'https:'"),
                "Page URL validation should allow only http and https protocols");
        assertTrue(validator.contains("tx('pageUrlInvalid', 'Enter a valid http or https URL')"),
                "Page URL validation should surface a clear localized error message");
        assertTrue(source.contains("name=\"pageUrl\" label={tx('pageUrl', 'Page URL')} rules={[{ validator: validatePageUrl }]}"),
                "Page URL form field should attach the URL validator");
        assertFalse(source.contains("<Form.Item name=\"pageUrl\" label={tx('pageUrl', 'Page URL')}>\n              <Input maxLength={500} />"),
                "Page URL field must not be left without validation rules");
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
