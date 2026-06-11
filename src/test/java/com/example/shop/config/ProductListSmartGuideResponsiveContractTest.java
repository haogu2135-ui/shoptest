package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductListSmartGuideResponsiveContractTest {

    @Test
    void smartGuideUsesTabletSafeActionGridBeforeBottomNavBreakpoint() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/ProductList.css"), StandardCharsets.UTF_8);

        assertTrue(css.contains("@media (max-width: 780px)"),
                "Product list smart guide must align with the 780px bottom-navigation breakpoint");
        assertTrue(css.contains(".product-list__smartBar") && css.contains("grid-template-columns: minmax(0, 1fr);"),
                "Smart guide should collapse to one column before the tablet bottom-nav breakpoint");
        assertTrue(css.contains(".product-list__smartActions") && css.contains("display: grid !important;"),
                "Smart guide actions should use explicit grid tracks instead of a squeezed Space row");
        assertTrue(css.contains("grid-template-columns: repeat(2, minmax(0, 1fr));"),
                "Smart guide action tracks must be bounded so buttons cannot overflow the viewport");
        assertTrue(css.contains(".product-list__smartActions .ant-space-item:has(.product-list__smartPick)")
                        && css.contains(".product-list__smartActions .ant-space-item:has(.product-list__smartPersonal)"),
                "Long smart guide actions should span the full action grid");
        assertTrue(css.contains("white-space: normal !important;"),
                "Smart guide button labels must be allowed to wrap instead of truncating to one unreadable line");
    }

    @Test
    void productListHidesBottomNavInMixedTabletBreakpoint() throws Exception {
        String css = Files.readString(Path.of("frontend/src/pages/ProductList.css"), StandardCharsets.UTF_8);

        assertTrue(css.contains("@media (min-width: 768px) and (max-width: 780px)"),
                "The exact 768-780px mixed product-list breakpoint must be handled explicitly");
        assertTrue(css.contains(".shop-app-shell--product-list .shop-nav__bottomBar")
                        && css.contains("display: none;"),
                "Product-list tablet layout must not keep the fixed mobile bottom bar over smart guide actions");
        assertTrue(css.contains("padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)) !important;"),
                "Product-list tablet layout should retain safe-area bottom spacing after hiding the mobile bottom bar");
    }
}
