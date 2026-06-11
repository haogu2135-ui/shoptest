package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class HomeConversionBandResponsiveContractTest {

    @Test
    void guestConversionBandHasTabletReadableGrid() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/Home.css"), StandardCharsets.UTF_8);
        String fixCss = css.substring(css.indexOf("/* F3404:"));

        assertTrue(fixCss.contains("@media (min-width: 601px) and (max-width: 900px)"),
                "Guest conversion cards need an explicit tablet band between phone stacking and desktop three-up layout");
        assertTrue(fixCss.contains(".shopee-conversion-band")
                        && fixCss.contains("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;"),
                "Tablet conversion band should use two bounded tracks instead of three squeezed cards");
        assertTrue(fixCss.contains(".shopee-conversion-band__card")
                        && fixCss.contains("grid-template-columns: 40px minmax(0, 1fr) !important;")
                        && fixCss.contains("\"icon body\"")
                        && fixCss.contains("\"icon action\" !important;"),
                "Tablet conversion cards should place the action below the body instead of reserving a narrow third column");
    }

    @Test
    void guestConversionBandKeepsLabelsReadableAtTabletWidths() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/Home.css"), StandardCharsets.UTF_8);
        String source = Files.readString(Path.of("frontend/src/pages/Home.tsx"), StandardCharsets.UTF_8);
        String fixCss = css.substring(css.indexOf("/* F3404:"));

        assertTrue(source.contains("className=\"shopee-conversion-band\"")
                        && source.contains("className=\"shopee-conversion-band__body\"")
                        && source.contains("className=\"shopee-conversion-band__action\""),
                "Home guest conversion actions should keep separate body and action elements for responsive placement");
        assertTrue(fixCss.contains(".shopee-conversion-band__body strong")
                        && fixCss.contains(".shopee-conversion-band__action")
                        && fixCss.contains("text-overflow: clip !important;")
                        && fixCss.contains("white-space: normal !important;"),
                "Tablet conversion titles and action labels must wrap or show fully instead of ellipsizing Track order/Register");
        assertTrue(fixCss.contains(".shopee-conversion-band__body .ant-typography")
                        && fixCss.contains("-webkit-line-clamp: 2;"),
                "Secondary copy should be intentionally clamped to two lines after the main action labels remain readable");
        assertTrue(fixCss.contains(".shopee-conversion-band__card:nth-child(3)")
                        && fixCss.contains("grid-column: 1 / -1;")
                        && fixCss.contains("grid-template-columns: 40px minmax(0, 1fr) minmax(128px, auto) !important;"),
                "Track-order card should span the tablet row so its title/action do not collapse into a narrow text track");
    }
}
