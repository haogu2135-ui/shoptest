package com.example.shop.service;

import com.example.shop.dto.ProductUrlImportPreview;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductUrlImportServiceTest {
    private final ProductUrlImportService service = new ProductUrlImportService();

    @Test
    void parsesJsonLdProductMetadata() {
        String html = "<html><head>"
                + "<script type=\"application/ld+json\">"
                + "{"
                + "\"@context\":\"https://schema.org\","
                + "\"@type\":\"Product\","
                + "\"name\":\"Reflective Dog Harness\","
                + "\"description\":\"Secure harness for night walks\","
                + "\"image\":[\"https://cdn.example.com/harness.jpg\",\"https://cdn.example.com/harness-side.jpg\"],"
                + "\"brand\":{\"@type\":\"Brand\",\"name\":\"PawCo\"},"
                + "\"offers\":{\"@type\":\"Offer\",\"price\":\"29.90\",\"highPrice\":\"39.90\",\"priceCurrency\":\"USD\"}"
                + "}"
                + "</script>"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/harness", html);

        assertEquals("Reflective Dog Harness", preview.getName());
        assertEquals("Secure harness for night walks", preview.getDescription());
        assertEquals(new BigDecimal("29.90"), preview.getPrice());
        assertEquals(new BigDecimal("39.90"), preview.getOriginalPrice());
        assertEquals("USD", preview.getCurrency());
        assertEquals("PawCo", preview.getBrand());
        assertEquals("https://cdn.example.com/harness.jpg", preview.getImageUrl());
        assertEquals(2, preview.getImages().size());
        assertEquals(100, preview.getConfidenceScore());
    }

    @Test
    void parsesJsonLdObjectImageFields() {
        String html = "<html><head>"
                + "<script type=\"application/ld+json\">"
                + "{"
                + "\"@context\":\"https://schema.org\","
                + "\"@type\":\"Product\","
                + "\"name\":\"Pet Travel Carrier\","
                + "\"description\":\"Ventilated carrier for short trips\","
                + "\"image\":{"
                + "\"contentUrl\":\"https://cdn.example.com/carrier-main.webp\","
                + "\"thumbnailUrl\":\"https://cdn.example.com/carrier-thumb.webp\""
                + "},"
                + "\"offers\":{\"price\":\"49.90\",\"priceCurrency\":\"USD\"}"
                + "}"
                + "</script>"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/carrier", html);

        assertEquals("Pet Travel Carrier", preview.getName());
        assertEquals("https://cdn.example.com/carrier-main.webp", preview.getImageUrl());
        assertEquals("https://cdn.example.com/carrier-main.webp", preview.getImages().get(0));
        assertEquals("https://cdn.example.com/carrier-thumb.webp", preview.getImages().get(1));
    }

    @Test
    void fallsBackToOpenGraphMetadata() {
        String html = "<html><head>"
                + "<meta property=\"og:title\" content=\"Cat Window Perch &amp; Hammock\">"
                + "<meta name=\"description\" content=\"Soft perch for sunny windows\">"
                + "<meta property=\"og:image\" content=\"https://cdn.example.com/perch.jpg\">"
                + "<meta property=\"product:price:amount\" content=\"$18.50\">"
                + "<meta property=\"product:price:currency\" content=\"MXN\">"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/perch", html);

        assertEquals("Cat Window Perch & Hammock", preview.getName());
        assertEquals("Soft perch for sunny windows", preview.getDescription());
        assertEquals(new BigDecimal("18.50"), preview.getPrice());
        assertEquals("MXN", preview.getCurrency());
        assertEquals("https://cdn.example.com/perch.jpg", preview.getImageUrl());
    }

    @Test
    void resolvesRelativeImagesAndEuropeanPriceText() {
        String html = "<html><head>"
                + "<meta property=\"og:title\" content=\"Travel Bowl\">"
                + "<meta property=\"og:image\" content=\"/assets/bowl.jpg\">"
                + "<meta itemprop=\"price\" content=\"1.299,95\">"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/bowl", html);

        assertEquals("Travel Bowl", preview.getName());
        assertEquals(new BigDecimal("1299.95"), preview.getPrice());
        assertEquals("https://shop.example.com/assets/bowl.jpg", preview.getImageUrl());
        assertEquals("missing_description", preview.getWarnings().get(0));
    }

    @Test
    void fallsBackToEmbeddedProductDataWhenMetaIsMissing() {
        String html = "<html><body><script>"
                + "window.__DATA__={\"itemTitle\":\"Cooling Mat\",\"salePrice\":\"88.00\",\"picUrl\":\"https:\\/\\/cdn.example.com\\/mat.jpg\"};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://item.example.com/item/1", html);

        assertEquals("Cooling Mat", preview.getName());
        assertEquals(new BigDecimal("88.00"), preview.getPrice());
        assertEquals("https://cdn.example.com/mat.jpg", preview.getImageUrl());
    }

    @Test
    void extractsImagesFromLazyHtmlAttributesAndSrcSet() {
        String html = "<html><head><title>Portable Pet Bowl</title></head><body>"
                + "<picture>"
                + "<source data-srcset=\"/assets/bowl-small.webp 480w, /assets/bowl-large.webp 960w\">"
                + "<img data-original-src=\"/assets/bowl-main.jpg\" data-large-image=\"https://cdn.example.com/bowl-large.jpg\">"
                + "</picture>"
                + "</body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/bowl", html);

        assertEquals("Portable Pet Bowl", preview.getName());
        assertEquals("https://shop.example.com/assets/bowl-main.jpg", preview.getImageUrl());
        assertEquals("https://shop.example.com/assets/bowl-main.jpg", preview.getImages().get(0));
        assertEquals("https://cdn.example.com/bowl-large.jpg", preview.getImages().get(1));
        assertEquals("https://shop.example.com/assets/bowl-small.webp", preview.getImages().get(2));
        assertEquals("https://shop.example.com/assets/bowl-large.webp", preview.getImages().get(3));
    }

    @Test
    void extractsImagesFromInlineStylesAndAdditionalLazyAttributes() {
        String html = "<html><head><title>Pet Bed</title></head><body>"
                + "<div class=\"hero\" style=\"background-image:url('/media/bed-hero.webp?size=large')\"></div>"
                + "<img data-img=\"/media/bed-main.jpg\" data-image-url=\"https://cdn.example.com/bed-side.jpeg\" "
                + "data-lazy-srcset=\"/media/bed-small.webp 480w, /media/bed-large.webp 960w\">"
                + "</body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/bed", html);

        assertEquals("Pet Bed", preview.getName());
        assertEquals("https://shop.example.com/media/bed-main.jpg", preview.getImageUrl());
        assertEquals("https://shop.example.com/media/bed-main.jpg", preview.getImages().get(0));
        assertEquals("https://cdn.example.com/bed-side.jpeg", preview.getImages().get(1));
        assertEquals("https://shop.example.com/media/bed-small.webp", preview.getImages().get(2));
        assertEquals("https://shop.example.com/media/bed-large.webp", preview.getImages().get(3));
        assertEquals("https://shop.example.com/media/bed-hero.webp?size=large", preview.getImages().get(4));
    }

    @Test
    void extractsEscapedScriptImageUrlsWhenJsonObjectIsNotStrictJson() {
        String html = "<html><head><title>Dog Raincoat</title></head><body><script>"
                + "window.__PRODUCT__ = {gallery:[{url:'https:\\/\\/cdn.example.com\\/raincoat-main.jpeg?x=1'},"
                + "{url:'\\/media\\/raincoat-side.webp'}], previewImage: 'https:\\u002F\\u002Fcdn.example.com\\u002Fraincoat-preview.jpg'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/raincoat", html);

        assertEquals("Dog Raincoat", preview.getName());
        assertEquals("https://cdn.example.com/raincoat-main.jpeg?x=1", preview.getImageUrl());
        assertEquals("https://cdn.example.com/raincoat-main.jpeg?x=1", preview.getImages().get(0));
        assertEquals("https://shop.example.com/media/raincoat-side.webp", preview.getImages().get(1));
        assertEquals("https://cdn.example.com/raincoat-preview.jpg", preview.getImages().get(2));
    }

    @Test
    void extractsPercentEncodedScriptImageUrls() {
        String html = "<html><head><title>TOPM Pet Rope Toy</title></head><body><script>"
                + "window.__PRODUCT__ = {imageUrl:'https%3A%2F%2Fp16-oec-sg.ibyteimg.com%2Ftos-alisg-i-aphluv4xwc-sg%2Fc9abcc.jpeg%3Ffrom%3D1432613627'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731", html);

        assertEquals("TOPM Pet Rope Toy", preview.getName());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/c9abcc.jpeg?from=1432613627", preview.getImageUrl());
    }

    @Test
    void extractsDoubleEncodedTopmScriptImageUrls() {
        String html = "<html><head><title>TOPM Double Encoded Toy</title></head><body><script>"
                + "window.__PRODUCT__ = {imageUrl:'https%253A%252F%252Fp16-oec-sg.ibyteimg.com%252Ftos-alisg-i-aphluv4xwc-sg%252Fdouble.webp%253Ffrom%253D1432613627'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731", html);

        assertEquals("TOPM Double Encoded Toy", preview.getName());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/double.webp?from=1432613627", preview.getImageUrl());
    }

    @Test
    void extractsScriptCssBackgroundImages() {
        String html = "<html><head><title>TOPM Background Image Toy</title></head><body><script>"
                + "document.body.innerHTML = '<div style=\\\"background:url(https:\\/\\/p16-oec-sg.ibyteimg.com\\/tos-alisg-i-aphluv4xwc-sg\\/bg.jpeg?from=1432613627)\\\"></div>';"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731", html);

        assertEquals("TOPM Background Image Toy", preview.getName());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/bg.jpeg?from=1432613627", preview.getImageUrl());
    }

    @Test
    void extractsSingleQuotedTopmCoverFieldsFromScripts() {
        String html = "<html><head><title>TOPM TikTok Rope Toy</title></head><body><script>"
                + "window.goodsDetail = {coverUrl:'https:\\/\\/p16-oec-sg.ibyteimg.com\\/tos-alisg-i-aphluv4xwc-sg\\/cover.webp?from=1432613627'};"
                + "window.moreGoods = {originalImg:'https%3A%2F%2Fp16-oec-sg.ibyteimg.com%2Ftos-alisg-i-aphluv4xwc-sg%2Foriginal.jpeg%3Ffrom%3D1432613627'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok", html);

        assertEquals("TOPM TikTok Rope Toy", preview.getName());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/cover.webp?from=1432613627", preview.getImageUrl());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/original.jpeg?from=1432613627", preview.getImages().get(1));
    }

    @Test
    void extractsTopmInlineImageArraysAndExtensionlessCdnUrls() {
        String firstImage = "https://img.topm.tech/uploads/goods/40731/main-image-token?x-oss-process=image/resize,w_800";
        String secondImage = "https://cdn.topm.tech/products/40731/gallery-token?from=topm";
        String html = "<html><head><title>TOPM Extensionless Gallery</title></head><body><script>"
                + "window.goods = {pictures:['" + firstImage + "','" + secondImage + "']};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok", html);

        assertEquals("TOPM Extensionless Gallery", preview.getName());
        assertEquals(firstImage, preview.getImageUrl());
        assertEquals(secondImage, preview.getImages().get(1));
    }

    @Test
    void extractsTopmQueryEncodedImageCandidatesAndAlternatePictureFields() {
        String firstImage = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/query-cover.webp?from=1432613627&width=800&height=800";
        String secondImage = "https://cdn.topm.tech/goods/40731/alternate-token?x-oss-process=image/resize,w_800";
        String encodedFirst = "https%3A%2F%2Fp16-oec-sg.ibyteimg.com%2Ftos-alisg-i-aphluv4xwc-sg%2Fquery-cover.webp%3Ffrom%3D1432613627%26width%3D800%26height%3D800";
        String html = "<html><head><title>TOPM Query Gallery</title></head><body><script>"
                + "window.goods = {shareUrl:'https://topm.tech/share?imageUrl=" + encodedFirst + "&goods_id=40731',"
                + "pictureUrl:'" + secondImage + "'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok", html);

        assertEquals("TOPM Query Gallery", preview.getName());
        assertEquals(firstImage, preview.getImageUrl());
        assertEquals(secondImage, preview.getImages().get(1));
    }

    @Test
    void extractsImagesFromTopmDetailUrlAndNestedGoodsUrlParameters() {
        String sourceUrl = "https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok&goods_url=https%3A%2F%2Ftopm.tech%2Fgoods.php%3Fid%3D40731%26imageUrl%3Dhttps%253A%252F%252Fp16-oec-sg.ibyteimg.com%252Ftos-alisg-i-aphluv4xwc-sg%252Fnested-cover.webp%253Ffrom%253D1432613627";
        String nestedImage = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/nested-cover.webp?from=1432613627";
        String html = "<html><head><title>TOPM Nested URL Toy</title></head><body><script>"
                + "window.goods = {goodsUrl:'https://topm.tech/goods.php?id=40731',"
                + "shareUrl:'https://topm.tech/share?cover=" + nestedImage + "&goods_id=40731'};"
                + "</script></body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml(sourceUrl, html);

        assertEquals("TOPM Nested URL Toy", preview.getName());
        assertEquals(nestedImage, preview.getImageUrl());
        assertFalse(preview.getImages().contains("https://topm.tech/goods.php?id=40731"));
    }

    @Test
    void extractsImagesFromUserProvidedTopmDetailUrlShape() {
        String encodedImage = "https%253A%252F%252Fp16-oec-sg.ibyteimg.com%252Ftos-alisg-i-aphluv4xwc-sg%252Fuser-provided-cover.jpeg%253Ffrom%253D1432613627%2526width%253D800";
        String expectedImage = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/user-provided-cover.jpeg?from=1432613627&width=800";
        String sourceUrl = "https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok&add_time=1777458564&formated_add_time=2026-04-28&goods_sn=11000033990671_-1&goods_url=https%3A%2F%2Ftopm.tech%2Fgoods.php%3Fid%3D40731%26cover%3D" + encodedImage;
        String html = "<html><head><title>TOPM User Provided URL</title></head><body>TopmConfig</body></html>";

        ProductUrlImportPreview preview = service.parseProductHtml(sourceUrl, html);

        assertEquals("TOPM User Provided URL", preview.getName());
        assertEquals(expectedImage, preview.getImageUrl());
        assertEquals(expectedImage, preview.getImages().get(0));
        assertFalse(preview.getImages().stream().anyMatch(image -> image.contains("goods.php")));
    }

    @Test
    void appliesTopmDynamicGoodsInfoPictures() {
        String json = "{"
                + "\"code\":0,"
                + "\"data\":{"
                + "\"goods_name\":\"Set de 4 juguetes de cuerda\","
                + "\"goods_desc\":\"Juguetes resistentes para mascotas\","
                + "\"shop_price_formated\":\"$0.00MXN\","
                + "\"market_price\":\"$0.00MXN\","
                + "\"shopinfo\":{\"shop_name\":\"alibaba\"},"
                + "\"goods_thumb\":\"images/no_picture.gif\","
                + "\"pictures\":["
                + "{\"img_url\":\"https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/c9ab.jpg?from=1432613627\"},"
                + "{\"img_url\":\"https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/77f7.jpg?from=1432613627\"}"
                + "]"
                + "}"
                + "}";
        ProductUrlImportPreview preview = new ProductUrlImportPreview();
        preview.setSourceUrl("https://topm.tech/new/detail.html?goods_id=40731");
        preview.setSourceHost("topm.tech");

        service.applyTopmGoodsInfoJson(preview, URI.create("https://topm.tech/new/detail.html?goods_id=40731"), json);

        assertEquals("Set de 4 juguetes de cuerda", preview.getName());
        assertEquals("Juguetes resistentes para mascotas", preview.getDescription());
        assertEquals(new BigDecimal("0.00"), preview.getPrice());
        assertEquals("MXN", preview.getCurrency());
        assertEquals("alibaba", preview.getBrand());
        assertEquals("https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/c9ab.jpg?from=1432613627", preview.getImageUrl());
        assertEquals(2, preview.getImages().size());
        assertEquals(100, preview.getConfidenceScore());
    }

    @Test
    void appliesTopmDetailPayloadImagesWhenPlaceholderFieldsArePresent() {
        String firstImage = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/c9abccdd47c0447e992ae17f5a9568da~tplv-aphluv4xwc-origin-jpeg.jpeg?from=1432613627";
        String secondImage = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/77f724beda934573b1d768f4a87c85cf~tplv-aphluv4xwc-origin-jpeg.jpeg?from=1432613627";
        String specImage = "https://cdn.example.com/spec-option.jpg";
        String json = "{"
                + "\"code\":0,"
                + "\"data\":{"
                + "\"goods_name\":\"Set de 4 juguetes de cuerda de novedad con chupetes de silicona\","
                + "\"goods_brief\":\"Set de 4 juguetes de cuerda de novedad con chupetes de silicona\","
                + "\"goods_desc\":\"Producto para mascotas importado desde TOPM\","
                + "\"shop_price_formated\":\"$0.00MXN\","
                + "\"goods_img\":\"images/no_picture.gif\","
                + "\"goods_thumb\":\"images/no_picture.gif\","
                + "\"original_img\":\"\","
                + "\"pictures\":["
                + "{\"img_url\":\"" + firstImage + "\"},"
                + "{\"img_url\":\"" + secondImage + "\"}"
                + "],"
                + "\"specification\":[{\"name\":\"color\",\"values\":[{\"label\":\"variado\",\"img_flie\":\"" + specImage + "\"}]}]"
                + "}"
                + "}";
        ProductUrlImportPreview preview = new ProductUrlImportPreview();
        preview.setSourceUrl("https://topm.tech/new/detail.html?goods_id=40731");
        preview.setSourceHost("topm.tech");

        service.applyTopmGoodsInfoJson(preview, URI.create("https://topm.tech/new/detail.html?goods_id=40731"), json);

        assertEquals("Set de 4 juguetes de cuerda de novedad con chupetes de silicona", preview.getName());
        assertEquals(firstImage, preview.getImageUrl());
        assertEquals(3, preview.getImages().size());
        assertEquals(firstImage, preview.getImages().get(0));
        assertEquals(secondImage, preview.getImages().get(1));
        assertEquals(specImage, preview.getImages().get(2));
    }

    @Test
    void appliesTopmArrayDataAndAlternateImageFields() {
        String cover = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/cover.webp?from=1432613627";
        String original = "https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/original.jpeg?from=1432613627";
        String originPic = "https://cdn.topm.tech/goods/40731/origin-token?x-oss-process=image/resize,w_800";
        String json = "{"
                + "\"code\":0,"
                + "\"data\":[{"
                + "\"title\":\"TOPM TikTok pet feeder\","
                + "\"description\":\"Automatic feeder imported from TOPM\","
                + "\"price\":\"$12.90MXN\","
                + "\"coverUrl\":\"" + cover + "\","
                + "\"goodsGallery\":[{\"originalImage\":\"" + original + "\",\"originPic\":\"" + originPic + "\"}]"
                + "}]"
                + "}";
        ProductUrlImportPreview preview = new ProductUrlImportPreview();
        preview.setSourceUrl("https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok");
        preview.setSourceHost("topm.tech");

        service.applyTopmGoodsInfoJson(preview, URI.create("https://topm.tech/new/detail.html?goods_id=40731&platform=tiktok"), json);

        assertEquals("TOPM TikTok pet feeder", preview.getName());
        assertEquals(new BigDecimal("12.90"), preview.getPrice());
        assertEquals("MXN", preview.getCurrency());
        assertEquals(cover, preview.getImageUrl());
        assertEquals(original, preview.getImages().get(1));
        assertEquals(originPic, preview.getImages().get(2));
    }

    @Test
    void rejectsLocalUrlsBeforeFetching() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.importFromUrl("http://127.0.0.1/admin/products"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void rejectsNonStandardWebPortsBeforeFetching() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.importFromUrl("https://example.com:8443/products/1"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void removesPrivateImageUrlsFromPreview() {
        String html = "<html><head>"
                + "<meta property=\"og:title\" content=\"Private CDN Test\">"
                + "<meta property=\"og:image\" content=\"http://127.0.0.1/internal.jpg\">"
                + "<meta property=\"product:price:amount\" content=\"12.00\">"
                + "</head></html>";

        ProductUrlImportPreview preview = service.parseProductHtml("https://shop.example.com/products/private-image", html);

        assertEquals("Private CDN Test", preview.getName());
        assertNull(preview.getImageUrl());
        assertEquals(1, preview.getBlockedImages().size());
        assertEquals("blocked_image_url", preview.getWarnings().get(preview.getWarnings().size() - 1));
    }

    @Test
    void rejectsOverlongUrlsBeforeFetching() {
        String url = "https://example.com/products/" + "a".repeat(2050);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.importFromUrl(url));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void stopsReadingProductPageWhenHtmlBodyExceedsLimit() {
        byte[] oversized = new byte[2 * 1024 * 1024 + 1];

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.readHtmlBody(new java.io.ByteArrayInputStream(oversized)));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void productUrlImportDoesNotHardcodeImportedImageMimeType() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/ProductUrlImportService.java"),
                StandardCharsets.UTF_8);

        assertFalse(source.contains("createImageRecord("));
        assertFalse(source.contains("setMimeType(\"image/jpeg\")"));
        assertFalse(Pattern.compile("\\bmimeType\\s*=\\s*\"image/jpeg\"").matcher(source).find());
        assertFalse(Pattern.compile("createImageRecord[\\s\\S]{0,800}\"image/jpeg\"").matcher(source).find());
    }

    @Test
    void productUrlImportExceptionFallbacksRemainObservable() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/ProductUrlImportService.java"),
                StandardCharsets.UTF_8);

        assertFalse(Pattern.compile("catch\\s*\\([^)]*\\bignored\\b[^)]*\\)").matcher(source).find());

        Matcher matcher = Pattern.compile("catch\\s*\\((?!ResponseStatusException\\b)[^)]*\\)\\s*\\{").matcher(source);
        List<String> silentCatches = new ArrayList<>();
        while (matcher.find()) {
            int bodyEnd = findMatchingBrace(source, matcher.end());
            if (bodyEnd < 0) {
                continue;
            }
            String body = source.substring(matcher.end(), bodyEnd);
            if (!body.contains("log.")) {
                silentCatches.add("line " + lineNumber(source, matcher.start()));
            }
            matcher.region(bodyEnd + 1, source.length());
        }

        assertTrue(silentCatches.isEmpty(),
                () -> "ProductUrlImportService catch fallbacks must log debug context: " + silentCatches);
    }

    private static int findMatchingBrace(String source, int bodyStart) {
        int depth = 1;
        Character stringQuote = null;
        boolean escaped = false;
        boolean lineComment = false;
        boolean blockComment = false;
        for (int index = bodyStart; index < source.length(); index++) {
            char current = source.charAt(index);
            char next = index + 1 < source.length() ? source.charAt(index + 1) : '\0';
            if (lineComment) {
                if (current == '\n') {
                    lineComment = false;
                }
                continue;
            }
            if (blockComment) {
                if (current == '*' && next == '/') {
                    blockComment = false;
                    index++;
                }
                continue;
            }
            if (stringQuote != null) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (current == '\\') {
                    escaped = true;
                    continue;
                }
                if (current == stringQuote) {
                    stringQuote = null;
                }
                continue;
            }
            if (current == '/' && next == '/') {
                lineComment = true;
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                blockComment = true;
                index++;
                continue;
            }
            if (current == '"' || current == '\'') {
                stringQuote = current;
                continue;
            }
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
                if (depth == 0) {
                    return index;
                }
            }
        }
        return -1;
    }

    private static long lineNumber(String source, int offset) {
        return source.substring(0, offset).chars().filter(ch -> ch == '\n').count() + 1;
    }
}
