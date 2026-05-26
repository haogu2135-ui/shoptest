package com.example.shop.service;

import com.example.shop.dto.ProductUrlImportPreview;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.IDN;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProductUrlImportService {
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_HTML_BYTES = 2 * 1024 * 1024;
    private static final int MAX_CACHE_ENTRIES = 100;
    private static final int MAX_URL_LENGTH = 2048;
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final Pattern TITLE_PATTERN = Pattern.compile("(?is)<title[^>]*>(.*?)</title>");
    private static final Pattern JSON_LD_PATTERN = Pattern.compile("(?is)<script[^>]+type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>");
    private static final Pattern META_PATTERN = Pattern.compile("(?is)<meta\\s+([^>]*?)>");
    private static final Pattern ATTR_PATTERN = Pattern.compile("(?is)([a-zA-Z_:.-]+)\\s*=\\s*([\"'])(.*?)\\2");
    private static final Pattern EMBEDDED_TITLE_PATTERN = Pattern.compile("(?is)\"(?:title|name|itemTitle|productTitle)\"\\s*:\\s*\"([^\"]{4,240})\"");
    private static final Pattern EMBEDDED_PRICE_PATTERN = Pattern.compile("(?is)\"(?:price|salePrice|currentPrice|reservePrice)\"\\s*:\\s*\"?([0-9][0-9.,]{0,16})\"?");
    private static final Pattern EMBEDDED_ORIGINAL_PRICE_PATTERN = Pattern.compile("(?is)\"(?:originalPrice|marketPrice|listPrice|compareAtPrice)\"\\s*:\\s*\"?([0-9][0-9.,]{0,16})\"?");
    private static final Pattern EMBEDDED_IMAGE_PATTERN = Pattern.compile("(?is)\"(?:image|imageUrl|picUrl|mainPic|mainImage)\"\\s*:\\s*\"(https?:\\\\?/\\\\?/[^\\\"]+)\"");
    private static final Pattern IPV4_HOST_PATTERN = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}$");
    private static final Pattern IPV6_HOST_PATTERN = Pattern.compile("^[0-9a-fA-F:]+$");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final ConcurrentMap<String, CachedProductUrlPreview> previewCache = new ConcurrentHashMap<>();

    public ProductUrlImportPreview importFromUrl(String rawUrl) {
        URI uri = normalizeAndValidateUri(rawUrl);
        ProductUrlImportPreview cachedPreview = getCachedPreview(uri.toString());
        if (cachedPreview != null) {
            return cachedPreview;
        }
        String html = fetchHtml(uri, 0);
        ProductUrlImportPreview preview = parseProductHtml(uri.toString(), html);
        if (isBlank(preview.getName()) && isBlank(preview.getDescription()) && isBlank(preview.getImageUrl())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "No public product metadata was found on this page");
        }
        cachePreview(uri.toString(), preview);
        return preview;
    }

    ProductUrlImportPreview parseProductHtml(String sourceUrl, String html) {
        URI uri = URI.create(sourceUrl);
        ProductUrlImportPreview preview = new ProductUrlImportPreview();
        preview.setSourceUrl(sourceUrl);
        preview.setSourceHost(uri.getHost());

        applyJsonLd(preview, html);
        if (isBlank(preview.getName())) {
            preview.setName(firstNonBlank(meta(html, "property", "og:title"), meta(html, "name", "twitter:title"), title(html)));
        }
        if (isBlank(preview.getDescription())) {
            preview.setDescription(firstNonBlank(meta(html, "property", "og:description"), meta(html, "name", "description"), meta(html, "name", "twitter:description"), meta(html, "itemprop", "description")));
        }
        if (isBlank(preview.getImageUrl())) {
            preview.setImageUrl(firstNonBlank(meta(html, "property", "og:image"), meta(html, "property", "og:image:url"), meta(html, "name", "twitter:image"), meta(html, "itemprop", "image")));
        }
        if (isBlank(preview.getCurrency())) {
            preview.setCurrency(firstNonBlank(meta(html, "property", "product:price:currency"), meta(html, "name", "currency")));
        }
        if (preview.getPrice() == null) {
            preview.setPrice(parsePrice(firstNonBlank(meta(html, "property", "product:price:amount"), meta(html, "name", "price"), meta(html, "itemprop", "price"))).orElse(null));
        }
        if (preview.getOriginalPrice() == null) {
            preview.setOriginalPrice(parsePrice(firstNonBlank(meta(html, "property", "product:original_price:amount"), meta(html, "name", "originalPrice"), meta(html, "name", "compareAtPrice"))).orElse(null));
        }
        applyEmbeddedFallback(preview, html);
        collectMetaImages(preview, html);
        normalizeImages(preview, uri);
        if (!isBlank(preview.getImageUrl()) && preview.getImages().isEmpty()) {
            preview.getImages().add(preview.getImageUrl());
        }
        preview.setName(clamp(cleanText(preview.getName()), 180));
        preview.setDescription(clamp(cleanText(preview.getDescription()), 1000));
        preview.setBrand(clamp(cleanText(preview.getBrand()), 120));
        preview.setCurrency(clamp(cleanText(preview.getCurrency()), 12));
        applyQualitySignals(preview);
        return preview;
    }

    private String fetchHtml(URI uri, int redirectCount) {
        if (redirectCount > MAX_REDIRECTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many redirects while importing product URL");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "ShopMX-ProductImporter/1.0")
                    .header("Accept", "text/html,application/xhtml+xml")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            int status = response.statusCode();
            if (status >= 300 && status < 400) {
                String location = response.headers().firstValue("location")
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Redirect response did not include a location"));
                return fetchHtml(normalizeAndValidateUri(uri.resolve(location).toString()), redirectCount + 1);
            }
            if (status < 200 || status >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product page returned HTTP " + status);
            }
            String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
            if (!contentType.isEmpty() && !contentType.contains("text/html") && !contentType.contains("application/xhtml")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL must point to a public HTML product page");
            }
            byte[] body = response.body();
            if (body.length > MAX_HTML_BYTES) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product page is too large to import");
            }
            return new String(body, java.nio.charset.StandardCharsets.UTF_8);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to fetch product page");
        }
    }

    private URI normalizeAndValidateUri(String rawUrl) {
        if (isBlank(rawUrl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product URL is required");
        }
        try {
            URI uri = URI.create(rawUrl.trim());
            if (uri.toString().length() > MAX_URL_LENGTH) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product URL is too long");
            }
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only http and https product URLs are supported");
            }
            if (uri.getUserInfo() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product URL must not include credentials");
            }
            int port = uri.getPort();
            if (port != -1 && port != 80 && port != 443) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product URL must use a standard web port");
            }
            String host = uri.getHost();
            if (isBlank(host)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product URL host is required");
            }
            String asciiHost = IDN.toASCII(host);
            for (InetAddress address : InetAddress.getAllByName(asciiHost)) {
                if (isBlockedAddress(address)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Private or local product URLs are not allowed");
                }
            }
            return uri;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid product URL");
        }
    }

    private boolean isBlockedAddress(InetAddress address) {
        return address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress();
    }

    private void applyJsonLd(ProductUrlImportPreview preview, String html) {
        Matcher matcher = JSON_LD_PATTERN.matcher(html == null ? "" : html);
        while (matcher.find()) {
            try {
                JsonNode product = findProductNode(OBJECT_MAPPER.readTree(unescapeHtml(matcher.group(1))));
                if (product != null) {
                    applyProductNode(preview, product);
                    return;
                }
            } catch (Exception ignored) {
                // Ignore malformed embedded JSON-LD and fall back to meta tags.
            }
        }
    }

    private JsonNode findProductNode(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findProductNode(child);
                if (found != null) return found;
            }
        }
        if (node.isObject()) {
            JsonNode type = node.get("@type");
            if (typeMatchesProduct(type)) return node;
            JsonNode graph = node.get("@graph");
            JsonNode found = findProductNode(graph);
            if (found != null) return found;
        }
        return null;
    }

    private boolean typeMatchesProduct(JsonNode type) {
        if (type == null) return false;
        if (type.isArray()) {
            for (JsonNode item : type) {
                if (typeMatchesProduct(item)) return true;
            }
            return false;
        }
        return "product".equalsIgnoreCase(type.asText(""));
    }

    private void applyProductNode(ProductUrlImportPreview preview, JsonNode product) {
        preview.setName(text(product.get("name")));
        preview.setDescription(text(product.get("description")));
        List<String> images = extractImages(product.get("image"));
        if (!images.isEmpty()) {
            preview.setImageUrl(images.get(0));
            preview.setImages(images);
        }
        JsonNode brand = product.get("brand");
        preview.setBrand(brand != null && brand.isObject() ? text(brand.get("name")) : text(brand));
        JsonNode offers = product.get("offers");
        if (offers != null && offers.isArray()) offers = offers.size() > 0 ? offers.get(0) : null;
        if (offers != null) {
            preview.setPrice(parsePrice(firstNonBlank(text(offers.get("price")), text(offers.get("lowPrice")))).orElse(null));
            preview.setOriginalPrice(parsePrice(firstNonBlank(text(offers.get("highPrice")), text(offers.get("listPrice")))).orElse(null));
            preview.setCurrency(firstNonBlank(text(offers.get("priceCurrency")), text(offers.get("priceCurrencyCode"))));
        }
    }

    private List<String> extractImages(JsonNode imageNode) {
        List<String> images = new ArrayList<>();
        if (imageNode == null || imageNode.isNull()) return images;
        if (imageNode.isArray()) {
            for (JsonNode item : imageNode) addImage(images, text(item));
        } else if (imageNode.isObject()) {
            addImage(images, text(imageNode.get("url")));
        } else {
            addImage(images, text(imageNode));
        }
        return images;
    }

    private void addImage(List<String> images, String image) {
        String cleaned = cleanText(image);
        if (!isBlank(cleaned) && images.size() < 8 && !images.contains(cleaned)) {
            images.add(cleaned);
        }
    }

    private String meta(String html, String attrName, String attrValue) {
        Matcher matcher = META_PATTERN.matcher(html == null ? "" : html);
        while (matcher.find()) {
            String attrs = matcher.group(1);
            if (attrValue.equalsIgnoreCase(attribute(attrs, attrName))) {
                return attribute(attrs, "content");
            }
        }
        return null;
    }

    private void collectMetaImages(ProductUrlImportPreview preview, String html) {
        Matcher matcher = META_PATTERN.matcher(html == null ? "" : html);
        while (matcher.find()) {
            String attrs = matcher.group(1);
            String property = firstNonBlank(attribute(attrs, "property"), attribute(attrs, "name"), attribute(attrs, "itemprop"));
            if (property != null && (
                    "og:image".equalsIgnoreCase(property)
                            || "og:image:url".equalsIgnoreCase(property)
                            || "twitter:image".equalsIgnoreCase(property)
                            || "image".equalsIgnoreCase(property))) {
                addImage(preview.getImages(), attribute(attrs, "content"));
            }
        }
    }

    private void applyEmbeddedFallback(ProductUrlImportPreview preview, String html) {
        String source = html == null ? "" : html;
        if (isBlank(preview.getName())) {
            preview.setName(regexGroup(EMBEDDED_TITLE_PATTERN, source));
        }
        if (preview.getPrice() == null) {
            preview.setPrice(parsePrice(regexGroup(EMBEDDED_PRICE_PATTERN, source)).orElse(null));
        }
        if (preview.getOriginalPrice() == null) {
            preview.setOriginalPrice(parsePrice(regexGroup(EMBEDDED_ORIGINAL_PRICE_PATTERN, source)).orElse(null));
        }
        if (isBlank(preview.getImageUrl())) {
            String image = regexGroup(EMBEDDED_IMAGE_PATTERN, source);
            if (!isBlank(image)) {
                preview.setImageUrl(image.replace("\\/", "/"));
            }
        }
    }

    private String regexGroup(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value == null ? "" : value);
        return matcher.find() ? unescapeHtml(matcher.group(1)) : null;
    }

    private void normalizeImages(ProductUrlImportPreview preview, URI baseUri) {
        List<String> normalizedImages = new ArrayList<>();
        for (String image : preview.getImages()) {
            addSafeImage(preview, normalizedImages, baseUri, image);
        }
        String mainImage = absolutizeUrl(baseUri, preview.getImageUrl());
        if (!isBlank(mainImage) && isSafePublicMediaUrl(mainImage)) {
            preview.setImageUrl(mainImage);
            if (!normalizedImages.contains(mainImage)) {
                normalizedImages.add(0, mainImage);
            }
        } else if (!isBlank(mainImage)) {
            if (!preview.getBlockedImages().contains(mainImage)) {
                preview.getBlockedImages().add(mainImage);
            }
            preview.setImageUrl(null);
        }
        preview.setImages(normalizedImages.size() > 8 ? new ArrayList<>(normalizedImages.subList(0, 8)) : normalizedImages);
    }

    private void addSafeImage(ProductUrlImportPreview preview, List<String> images, URI baseUri, String image) {
        String normalized = absolutizeUrl(baseUri, image);
        if (isBlank(normalized)) {
            return;
        }
        if (!isSafePublicMediaUrl(normalized)) {
            if (!preview.getBlockedImages().contains(normalized)) {
                preview.getBlockedImages().add(normalized);
            }
            return;
        }
        addImage(images, normalized);
    }

    private boolean isSafePublicMediaUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) {
                return false;
            }
            if (uri.toString().length() > MAX_URL_LENGTH || uri.getUserInfo() != null) {
                return false;
            }
            int port = uri.getPort();
            if (port != -1 && port != 80 && port != 443) {
                return false;
            }
            return !hasUnsafeMediaHost(uri.getHost());
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean hasUnsafeMediaHost(String host) {
        if (isBlank(host)) {
            return true;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        if ("localhost".equals(normalized)
                || normalized.endsWith(".localhost")
                || normalized.endsWith(".local")
                || normalized.endsWith(".internal")
                || normalized.endsWith(".lan")) {
            return true;
        }
        if (IPV4_HOST_PATTERN.matcher(normalized).matches() || (normalized.contains(":") && IPV6_HOST_PATTERN.matcher(normalized).matches())) {
            try {
                return isBlockedAddress(InetAddress.getByName(normalized));
            } catch (Exception ex) {
                return true;
            }
        }
        return false;
    }

    private String absolutizeUrl(URI baseUri, String url) {
        String cleaned = cleanText(url);
        if (isBlank(cleaned)) return null;
        if (cleaned.startsWith("//")) {
            return baseUri.getScheme() + ":" + cleaned;
        }
        try {
            URI parsed = URI.create(cleaned);
            if (parsed.isAbsolute()) return cleaned;
            return baseUri.resolve(parsed).toString();
        } catch (Exception ex) {
            return cleaned;
        }
    }

    private void applyQualitySignals(ProductUrlImportPreview preview) {
        int score = 0;
        if (!isBlank(preview.getName())) score += 30; else preview.getWarnings().add("missing_name");
        if (preview.getPrice() != null) score += 20; else preview.getWarnings().add("missing_price");
        if (!isBlank(preview.getImageUrl())) score += 25; else preview.getWarnings().add("missing_image");
        if (!isBlank(preview.getDescription())) score += 15; else preview.getWarnings().add("missing_description");
        if (!isBlank(preview.getBrand())) score += 10;
        if (!preview.getBlockedImages().isEmpty()) preview.getWarnings().add("blocked_image_url");
        preview.setConfidenceScore(Math.min(score, 100));
    }

    private ProductUrlImportPreview getCachedPreview(String url) {
        CachedProductUrlPreview cached = previewCache.get(url);
        if (cached == null) return null;
        if (cached.expiresAt < System.currentTimeMillis()) {
            previewCache.remove(url);
            return null;
        }
        return cached.preview;
    }

    private void cachePreview(String url, ProductUrlImportPreview preview) {
        if (previewCache.size() >= MAX_CACHE_ENTRIES) {
            previewCache.entrySet().stream()
                    .min(Comparator.comparingLong(entry -> entry.getValue().expiresAt))
                    .map(Map.Entry::getKey)
                    .ifPresent(previewCache::remove);
        }
        previewCache.put(url, new CachedProductUrlPreview(preview, System.currentTimeMillis() + CACHE_TTL.toMillis()));
    }

    private static class CachedProductUrlPreview {
        private final ProductUrlImportPreview preview;
        private final long expiresAt;

        private CachedProductUrlPreview(ProductUrlImportPreview preview, long expiresAt) {
            this.preview = preview;
            this.expiresAt = expiresAt;
        }
    }

    private String attribute(String attrs, String name) {
        Matcher matcher = ATTR_PATTERN.matcher(attrs == null ? "" : attrs);
        while (matcher.find()) {
            if (name.equalsIgnoreCase(matcher.group(1))) {
                return unescapeHtml(matcher.group(3));
            }
        }
        return null;
    }

    private String title(String html) {
        Matcher matcher = TITLE_PATTERN.matcher(html == null ? "" : html);
        return matcher.find() ? unescapeHtml(matcher.group(1)) : null;
    }

    private Optional<BigDecimal> parsePrice(String value) {
        if (isBlank(value)) return Optional.empty();
        String normalized = value.replaceAll("[^0-9.,-]", "");
        int lastComma = normalized.lastIndexOf(',');
        int lastDot = normalized.lastIndexOf('.');
        if (lastComma > lastDot && normalized.length() - lastComma <= 3) {
            normalized = normalized.replace(".", "").replace(",", ".");
        } else {
            normalized = normalized.replace(",", "");
        }
        if (isBlank(normalized)) return Optional.empty();
        try {
            return Optional.of(new BigDecimal(normalized));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String text(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText(null);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return null;
    }

    private String cleanText(String value) {
        return value == null ? null : unescapeHtml(value).replaceAll("\\s+", " ").trim();
    }

    private String clamp(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength).trim();
    }

    private String unescapeHtml(String value) {
        if (value == null) return null;
        return value
                .replace("&quot;", "\"")
                .replace("&#34;", "\"")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&nbsp;", " ");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
