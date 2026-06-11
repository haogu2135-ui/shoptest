package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductDetailTabletResponsiveContractTest {

    @Test
    void tabletPortraitUsesTwoColumnCommercialLayout() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/ProductDetail.css"), StandardCharsets.UTF_8);
        String fixCss = css.substring(css.indexOf("/* F3403:"));

        assertTrue(fixCss.contains("@media (min-width: 768px) and (max-width: 900px) and (min-height: 700px)"),
                "Product detail needs an explicit tablet portrait band that includes 768px and 820px while excluding phones and short landscape");
        assertTrue(fixCss.contains(".product-detail-shell > .ant-row")
                        && fixCss.contains("display: grid !important;")
                        && fixCss.contains("grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr) !important;"),
                "Tablet portrait should keep gallery and commercial summary side by side");
        assertTrue(fixCss.contains(".product-detail-shell > .ant-row > .ant-col")
                        && fixCss.contains("flex: none !important;")
                        && fixCss.contains("width: 100% !important;")
                        && fixCss.contains("max-width: 100% !important;"),
                "The mobile 100% AntD column override must not collapse the tablet grid back to one column");
    }

    @Test
    void tabletPortraitCapsGalleryAndKeepsPurchaseActionsInFlow() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/ProductDetail.css"), StandardCharsets.UTF_8);
        String fixCss = css.substring(css.indexOf("/* F3403:"));

        assertTrue(fixCss.contains(".product-detail-main-image")
                        && fixCss.contains("height: clamp(280px, 36dvh, 360px) !important;")
                        && fixCss.contains("aspect-ratio: auto !important;"),
                "Tablet portrait should cap the gallery height instead of leaving a full-width square image before product identity");
        assertTrue(fixCss.contains(".product-summary-card .product-mobile-buybar")
                        && fixCss.contains("position: static !important;")
                        && fixCss.contains("grid-template-areas:")
                        && fixCss.contains("\"meta meta\"")
                        && fixCss.contains("\"cart buy\" !important;"),
                "Tablet portrait should show purchase controls in the summary flow, not as an overlapping fixed mobile bar");
        assertTrue(fixCss.contains(".product-summary-card .product-mobile-buybar__tool--home")
                        && fixCss.contains(".product-summary-card .product-mobile-buybar__tool--favorite")
                        && fixCss.contains(".product-summary-card .product-mobile-buybar__tool--compare")
                        && fixCss.contains("display: none !important;"),
                "Tablet portrait purchase controls should focus on add-to-cart and buy-now actions");
        assertTrue(fixCss.contains(".product-actions")
                        && fixCss.contains("display: none !important;"),
                "Tablet portrait should not render duplicate desktop purchase actions below the compact tablet actions");
    }
}
