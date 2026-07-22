package com.example.shop.controller;

import com.example.shop.dto.ProductListQuery;
import com.example.shop.entity.Product;
import com.example.shop.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Commercial public sitemap: marketing routes plus live public product detail URLs.
 * Served at {@code GET /sitemap.xml} and proxied by the edge / local UI server.
 */
@RestController
public class SitemapController {
    private static final String DEFAULT_STOREFRONT_BASE_URL = "https://pet.686888666.xyz";
    private static final int PRODUCT_PAGE_SIZE = 100;
    private static final int MAX_PRODUCT_URLS = 5_000;
    private static final DateTimeFormatter LASTMOD_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final List<StaticUrl> STATIC_URLS = List.of(
            new StaticUrl("/", "daily", "1.0"),
            new StaticUrl("/products", "daily", "0.9"),
            new StaticUrl("/coupons", "daily", "0.7"),
            new StaticUrl("/pet-finder", "weekly", "0.7"),
            new StaticUrl("/pet-gallery", "weekly", "0.6"),
            new StaticUrl("/track-order", "weekly", "0.5"),
            new StaticUrl("/privacy", "yearly", "0.3"),
            new StaticUrl("/terms", "yearly", "0.3")
    );

    @Autowired
    private ProductService productService;

    @Value("${app.storefront-base-url:" + DEFAULT_STOREFRONT_BASE_URL + "}")
    private String storefrontBaseUrlConfig = DEFAULT_STOREFRONT_BASE_URL;

    @RequestMapping(value = "/sitemap.xml", method = {RequestMethod.GET, RequestMethod.HEAD}, produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        String base = storefrontBaseUrl();
        StringBuilder xml = new StringBuilder(8_192);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        for (StaticUrl entry : STATIC_URLS) {
            appendUrl(xml, base + entry.path, null, entry.changefreq, entry.priority);
        }

        for (Map.Entry<Long, LocalDateTime> product : loadPublicProductEntries()) {
            String lastmod = product.getValue() == null ? null : LASTMOD_FORMAT.format(product.getValue().toLocalDate());
            appendUrl(xml, base + "/products/" + product.getKey(), lastmod, "weekly", "0.8");
        }

        xml.append("</urlset>\n");
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=300")
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.toString());
    }

    private List<Map.Entry<Long, LocalDateTime>> loadPublicProductEntries() {
        List<Map.Entry<Long, LocalDateTime>> entries = new ArrayList<>();
        int page = 0;
        while (entries.size() < MAX_PRODUCT_URLS) {
            ProductListQuery query = new ProductListQuery();
            query.setPage(page);
            query.setSize(PRODUCT_PAGE_SIZE);
            query.setSort("id,asc");
            Page<Product> result = productService.findPublicProductPage(query);
            List<Product> content = result.getContent();
            if (content == null || content.isEmpty()) {
                break;
            }
            for (Product product : content) {
                if (product == null || product.getId() == null) {
                    continue;
                }
                LocalDateTime updated = product.getUpdatedAt() != null ? product.getUpdatedAt() : product.getCreatedAt();
                entries.add(Map.entry(product.getId(), updated));
                if (entries.size() >= MAX_PRODUCT_URLS) {
                    break;
                }
            }
            if (!result.hasNext()) {
                break;
            }
            page += 1;
        }
        // Stable order for crawlers / smoke diffs.
        Map<Long, LocalDateTime> ordered = new LinkedHashMap<>();
        entries.stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> ordered.putIfAbsent(entry.getKey(), entry.getValue()));
        return new ArrayList<>(ordered.entrySet());
    }

    private String storefrontBaseUrl() {
        String configured = storefrontBaseUrlConfig;
        if (configured == null || configured.isBlank()) {
            configured = DEFAULT_STOREFRONT_BASE_URL;
        }
        return configured.trim().replaceAll("/+$", "");
    }

    private static void appendUrl(StringBuilder xml, String loc, String lastmod, String changefreq, String priority) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
        if (lastmod != null && !lastmod.isBlank()) {
            xml.append("    <lastmod>").append(escapeXml(lastmod)).append("</lastmod>\n");
        }
        xml.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        xml.append("    <priority>").append(priority).append("</priority>\n");
        xml.append("  </url>\n");
    }

    private static String escapeXml(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '&':
                    escaped.append("&amp;");
                    break;
                case '<':
                    escaped.append("&lt;");
                    break;
                case '>':
                    escaped.append("&gt;");
                    break;
                case '"':
                    escaped.append("&quot;");
                    break;
                case '\'':
                    escaped.append("&apos;");
                    break;
                default:
                    escaped.append(ch);
            }
        }
        return escaped.toString();
    }

    private static final class StaticUrl {
        private final String path;
        private final String changefreq;
        private final String priority;

        private StaticUrl(String path, String changefreq, String priority) {
            this.path = path;
            this.changefreq = changefreq;
            this.priority = priority;
        }
    }
}
