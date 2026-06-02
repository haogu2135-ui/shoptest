package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Configuration
@RequiredArgsConstructor
public class ProductDataQualityConfig {
    private static final Logger log = LoggerFactory.getLogger(ProductDataQualityConfig.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    private final JdbcTemplate jdbcTemplate;
    private final RuntimeConfigService runtimeConfig;

    @Bean
    public ApplicationRunner repairProductDisplayData() {
        return args -> {
            if (!runtimeConfig.getBoolean("product.data-quality.repair-on-startup", true)) {
                return;
            }
            try {
                if (!tableExists("products")) {
                    return;
                }
                repairMissingTimestamps();
                repairDemoWarrantyText();
                repairInternalCatalogCopy();
                repairPlaceholderBrandWebsites();
                repairVariantImages();
            } catch (Exception ex) {
                log.warn("Product display data repair skipped after an unexpected error", ex);
            }
        };
    }

    private void repairMissingTimestamps() {
        executeQuietly("UPDATE products SET created_at = COALESCE(updated_at, NOW()) WHERE created_at IS NULL");
        executeQuietly("UPDATE products SET updated_at = created_at WHERE updated_at IS NULL AND created_at IS NOT NULL");
    }

    private void repairDemoWarrantyText() {
        executeQuietly("UPDATE products SET warranty = '30 day replacement for manufacturing defects' "
                + "WHERE warranty IS NOT NULL AND LOWER(warranty) LIKE '%demo warranty%'");
    }

    private void repairInternalCatalogCopy() {
        executeQuietly("UPDATE products SET detail_content = REPLACE(detail_content, "
                + "'English is the default content. Spanish and Chinese demo text is stored in specifications for language fallback testing.', "
                + "'Localized product copy is maintained for shoppers who switch language from the storefront.') "
                + "WHERE detail_content LIKE '%demo text is stored in specifications%'");
        executeQuietly("UPDATE products SET detail_content = REPLACE(detail_content, "
                + "'Bundle pricing is recognized by the storefront through the bundle.* specification fields.', "
                + "'The set keeps related pet care products together so checkout decisions stay simple.') "
                + "WHERE detail_content LIKE '%bundle.* specification fields%'");
        executeQuietly("UPDATE products SET detail_content = REPLACE(detail_content, "
                + "'A high-value bundle for testing cart totals, free shipping, discounts and rich details together.', "
                + "'A high-value starter set that brings everyday care essentials together in one box.') "
                + "WHERE detail_content LIKE '%testing cart totals%'");

        if (tableExists("categories")) {
            executeQuietly("UPDATE categories SET description = 'Main catalog root for pet food, care and accessories.' "
                    + "WHERE name = 'Pet Supplies' AND LOWER(description) LIKE '%pet-only test data%'");
            executeQuietly("UPDATE categories SET name = 'Pet Care Bundles', "
                    + "description = 'Curated multi-item sets for common pet care routines.' "
                    + "WHERE name = 'Bundle Samples' OR LOWER(description) LIKE '%demo root category%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, 'Bundle Samples', 'Pet Care Bundles') "
                    + "WHERE localized_content LIKE '%Bundle Samples%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, 'Demo root category for bundle products.', 'Curated multi-item sets for common pet care routines.') "
                    + "WHERE localized_content LIKE '%Demo root category for bundle products.%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, 'Paquetes de muestra', 'Paquetes de cuidado') "
                    + "WHERE localized_content LIKE '%Paquetes de muestra%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, 'Categoria raiz de demostracion para paquetes.', 'Sets seleccionados para rutinas comunes de cuidado de mascotas.') "
                    + "WHERE localized_content LIKE '%Categoria raiz de demostracion para paquetes.%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, '\u5957\u88c5\u6837\u4f8b', '\u5ba0\u7269\u62a4\u7406\u5957\u88c5') "
                    + "WHERE localized_content LIKE '%\u5957\u88c5\u6837\u4f8b%'");
            executeQuietly("UPDATE categories SET localized_content = REPLACE(localized_content, '\u5957\u88c5\u5546\u54c1\u6f14\u793a\u6839\u5206\u7c7b\u3002', '\u56f4\u7ed5\u5e38\u89c1\u5ba0\u7269\u62a4\u7406\u573a\u666f\u7ec4\u5408\u7684\u591a\u4ef6\u5957\u3002') "
                    + "WHERE localized_content LIKE '%\u5957\u88c5\u5546\u54c1\u6f14\u793a\u6839\u5206\u7c7b\u3002%'");
        }
    }

    private void repairPlaceholderBrandWebsites() {
        if (!tableExists("brands")) {
            return;
        }
        executeQuietly("UPDATE brands SET website_url = NULL "
                + "WHERE website_url IS NOT NULL AND LOWER(website_url) LIKE '%.example.com%'");
    }

    private void repairVariantImages() {
        List<ProductVariantRow> rows = jdbcTemplate.query(
                "SELECT id, image_url, images, variants FROM products WHERE variants IS NOT NULL AND TRIM(variants) <> ''",
                (rs, rowNum) -> new ProductVariantRow(
                        rs.getLong("id"),
                        rs.getString("image_url"),
                        rs.getString("images"),
                        rs.getString("variants")));
        for (ProductVariantRow row : rows) {
            String updatedVariants = variantsWithImages(row);
            if (updatedVariants != null && !updatedVariants.equals(row.variants)) {
                jdbcTemplate.update("UPDATE products SET variants = ?, updated_at = COALESCE(updated_at, NOW()) WHERE id = ?",
                        updatedVariants,
                        row.id);
            }
        }
    }

    private String variantsWithImages(ProductVariantRow row) {
        try {
            List<Map<String, Object>> variants = mapper.readValue(row.variants, new TypeReference<List<Map<String, Object>>>() {});
            if (variants == null || variants.isEmpty()) {
                return null;
            }
            List<String> fallbackImages = productImages(row);
            if (fallbackImages.isEmpty()) {
                return null;
            }
            boolean changed = false;
            List<Map<String, Object>> normalized = new ArrayList<>();
            for (int index = 0; index < variants.size(); index++) {
                Map<String, Object> variant = variants.get(index);
                if (variant == null || variant.isEmpty()) {
                    continue;
                }
                Map<String, Object> next = new LinkedHashMap<>(variant);
                Object imageUrl = next.get("imageUrl");
                if (imageUrl == null || String.valueOf(imageUrl).trim().isEmpty()) {
                    next.put("imageUrl", fallbackImages.get(index % fallbackImages.size()));
                    changed = true;
                }
                normalized.add(next);
            }
            return changed ? mapper.writeValueAsString(normalized) : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> productImages(ProductVariantRow row) {
        List<String> images = new ArrayList<>();
        addImage(images, row.imageUrl);
        if (row.images != null && !row.images.isBlank()) {
            try {
                List<String> parsed = mapper.readValue(row.images, new TypeReference<List<String>>() {});
                if (parsed != null) {
                    parsed.forEach(image -> addImage(images, image));
                }
            } catch (Exception ignored) {
                addImage(images, row.images);
            }
        }
        return images;
    }

    private void addImage(List<String> images, String value) {
        String image = value == null ? "" : value.trim();
        if (!image.isEmpty() && !images.contains(image)) {
            images.add(image);
        }
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                Integer.class,
                tableName);
        return count != null && count > 0;
    }

    private void executeQuietly(String sql) {
        try {
            jdbcTemplate.update(sql);
        } catch (Exception ex) {
            log.debug("Product display data repair statement skipped: {}", sql, ex);
        }
    }

    private static final class ProductVariantRow {
        private final long id;
        private final String imageUrl;
        private final String images;
        private final String variants;

        private ProductVariantRow(long id, String imageUrl, String images, String variants) {
            this.id = id;
            this.imageUrl = imageUrl;
            this.images = images;
            this.variants = variants;
        }
    }
}
