package com.example.shop.service;

import com.example.shop.dto.ProductUrlImportPreview;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.IDN;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.charset.Charset;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Consumer;
import java.util.Iterator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProductUrlImportService {
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_HTML_BYTES = 2 * 1024 * 1024;
    private static final int MAX_CACHE_ENTRIES = 100;
    private static final int MAX_URL_LENGTH = 2048;
    private static final int MAX_IMPORT_IMAGES = 12;
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final Pattern TITLE_PATTERN = Pattern.compile("(?is)<title[^>]*>(.*?)</title>");
    private static final Pattern JSON_LD_PATTERN = Pattern.compile("(?is)<script[^>]+type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>");
    private static final Pattern META_PATTERN = Pattern.compile("(?is)<meta\\s+([^>]*?)>");
    private static final Pattern ATTR_PATTERN = Pattern.compile("(?is)([a-zA-Z_:.-]+)\\s*=\\s*([\"'])(.*?)\\2");
    private static final Pattern UNQUOTED_ATTR_PATTERN = Pattern.compile("(?is)([a-zA-Z_:.-]+)\\s*=\\s*([^\\s\"'`=<>]+)");
    private static final Pattern EMBEDDED_TITLE_PATTERN = Pattern.compile("(?is)\"(?:title|name|itemTitle|productTitle)\"\\s*:\\s*\"([^\"]{4,240})\"");
    private static final Pattern EMBEDDED_PRICE_PATTERN = Pattern.compile("(?is)\"(?:price|salePrice|currentPrice|reservePrice)\"\\s*:\\s*\"?([0-9][0-9.,]{0,16})\"?");
    private static final Pattern EMBEDDED_ORIGINAL_PRICE_PATTERN = Pattern.compile("(?is)\"(?:originalPrice|marketPrice|listPrice|compareAtPrice)\"\\s*:\\s*\"?([0-9][0-9.,]{0,16})\"?");
    private static final Pattern EMBEDDED_IMAGE_PATTERN = Pattern.compile("(?is)[\"'](?:image|imageUrl|image_url|pic|picture|photo|picUrl|pic_url|pictureUrl|picture_url|mainPic|main_pic|mainPicture|main_picture|mainImage|main_image|cover|coverUrl|cover_url|videoCover|video_cover|goodsImg|goods_img|goodsImage|goods_image|goodsImageUrl|goods_image_url|originalImg|original_img|originalImage|original_image|originalImageUrl|original_image_url|originImg|origin_img|originPic|origin_pic|originImage|origin_image|thumb|thumbnail|thumbnailUrl|thumbnail_url)[\"']\\s*:\\s*([\"'])([^\"']+)\\1");
    private static final Pattern LOOSE_EMBEDDED_IMAGE_PATTERN = Pattern.compile("(?is)(?:^|[,{\\s])(?:image|imageUrl|image_url|pic|picture|photo|picUrl|pic_url|pictureUrl|picture_url|mainPic|main_pic|mainPicture|main_picture|mainImage|main_image|cover|coverUrl|cover_url|videoCover|video_cover|goodsImg|goods_img|goodsImage|goods_image|goodsImageUrl|goods_image_url|originalImg|original_img|originalImage|original_image|originalImageUrl|original_image_url|originImg|origin_img|originPic|origin_pic|originImage|origin_image|thumb|thumbnail|thumbnailUrl|thumbnail_url)\\s*:\\s*([\"'])([^\"']+)\\1");
    private static final Pattern UNQUOTED_EMBEDDED_IMAGE_PATTERN = Pattern.compile("(?is)(?:[\"']?(?:image|imageUrl|image_url|pic|picture|photo|picUrl|pic_url|pictureUrl|picture_url|mainPic|main_pic|mainPicture|main_picture|mainImage|main_image|cover|coverUrl|cover_url|videoCover|video_cover|goodsImg|goods_img|goodsImage|goods_image|goodsImageUrl|goods_image_url|originalImg|original_img|originalImage|original_image|originalImageUrl|original_image_url|originImg|origin_img|originPic|origin_pic|originImage|origin_image|thumb|thumbnail|thumbnailUrl|thumbnail_url)[\"']?)\\s*:\\s*((?:https?:)?//[^\\s,}\"'<>\\\\]+|/[^\\s,}\"'<>\\\\]+|[^\\s,}\"'<>\\\\]+\\.(?:jpg|jpeg|png|webp|gif|avif|bmp|jfif)(?:\\?[^\\s,}\"'<>\\\\]*)?)");
    private static final Pattern ASSIGNED_EMBEDDED_IMAGE_PATTERN = Pattern.compile("(?is)(?:^|[,{;\\s])(?:image|imageUrl|image_url|pic|picture|photo|picUrl|pic_url|pictureUrl|picture_url|mainPic|main_pic|mainPicture|main_picture|mainImage|main_image|cover|coverUrl|cover_url|videoCover|video_cover|goodsImg|goods_img|goodsImage|goods_image|goodsImageUrl|goods_image_url|originalImg|original_img|originalImage|original_image|originalImageUrl|original_image_url|originImg|origin_img|originPic|origin_pic|originImage|origin_image|thumb|thumbnail|thumbnailUrl|thumbnail_url)\\s*=\\s*([\"']?)(?<url>(?:https?:)?//[^\\s,;}\"'<>\\\\]+|/[^\\s,;}\"'<>\\\\]+|[^\\s,;}\"'<>\\\\]+\\.(?:jpg|jpeg|png|webp|gif|avif|bmp|jfif)(?:\\?[^\\s,;}\"'<>\\\\]*)?)\\1");
    private static final Pattern HTML_IMAGE_PATTERN = Pattern.compile("(?is)<(img|source)\\s+([^>]*?)>");
    private static final Pattern SCRIPT_JSON_PATTERN = Pattern.compile("(?is)<script[^>]*>(.*?)</script>");
    private static final Pattern STYLE_URL_PATTERN = Pattern.compile("(?is)url\\(\\s*([\"']?)([^\"')]+\\.(?:jpg|jpeg|png|webp|gif|avif|bmp|jfif)(?:\\?[^\"')\\s]*)?)\\1\\s*\\)");
    private static final Pattern SCRIPT_IMAGE_URL_PATTERN = Pattern.compile("(?is)(?:https?:)?//[^\\s\"'<>\\\\]+?\\.(?:jpg|jpeg|png|webp|gif|avif|bmp|jfif)(?:\\?[^\\s\"'<>\\\\]*)?|(?<![a-z0-9:/])/(?!/)[a-z0-9_./%~+\\-]+\\.(?:jpg|jpeg|png|webp|gif|avif|bmp|jfif)(?:\\?[^\\s\"'<>]*)?");
    private static final Pattern LOOSE_CDN_IMAGE_URL_PATTERN = Pattern.compile("(?is)(?:https?:)?//[^\\s\"'<>\\\\]*(?:tiktokcdn|alicdn|cloudfront|cdn|/image/|/images/|/img/|/imgs/|/upload/|/uploads/|/goods/|/products/|/product/|/thumb/|/thumbnail/|/tos-)[^\\s\"'<>\\\\]*");
    private static final Pattern TOPM_MEDIA_PATH_PATTERN = Pattern.compile("(?is)(?:https?:)?//[^\\s\"'<>\\\\]*(?:topm\\.tech|tiktokcdn|alicdn|cloudfront|cdn)[^\\s\"'<>\\\\]*(?:/goods/|/uploads/|/upload/|/images/|/image/|/img/|/imgs/|/tos-|[?&](?:x-oss-process|imageMogr2|format|width|height|resize|quality|w|h)=)[^\\s\"'<>\\\\]*");
    private static final Pattern TOPM_MEDIA_QUERY_URL_PATTERN = Pattern.compile("(?is)(?<![a-z0-9_])(?:image|img|pic|photo|thumb|cover|src|url|goods_img|goods_pic|original_img|original_pic|media)[a-z0-9_\\-]*=([^\\s\"'<>\\\\]+)");
    private static final Pattern INLINE_IMAGE_ARRAY_PATTERN = Pattern.compile("(?is)(?:images|imageList|image_list|imgList|img_list|picList|pic_list|gallery|goodsGallery|goods_gallery|photos|photoList|photo_list|pictures|goodsImages|goods_images|goodsPictures|goods_pictures|detailImages|detail_images|descImages|desc_images|pictureList|picture_list|mediaList|media_list)\\s*[:=]\\s*\\[(.*?)\\]");
    private static final Pattern TOPM_GENERIC_IMAGE_FIELD_PATTERN = Pattern.compile("(?is)[\"'](?:media|mediaUrl|media_url|goodsPic|goods_pic|goodsPicture|goods_picture|goodsImg|goods_img|goodsImage|goods_image|goodsImageUrl|goods_image_url|originalPic|original_pic|originalPicture|original_picture|originalImg|original_img|originalImage|original_image|originalImageUrl|original_image_url|originUrl|origin_url|originPicture|origin_picture|originImg|origin_img|originImage|origin_image|photo|photoUrl|photo_url|detailImage|detail_image|descImage|desc_image|imageUrls|image_urls|imageUrlList|image_url_list|imgUrls|img_urls|picUrls|pic_urls|imgListJson|imageListJson|galleryJson|goodsGalleryJson|goods_gallery_json|dataSrc|data_src|dataOriginal|data_original|lazySrc|lazy_src)[\"']\\s*:\\s*([\"'])([^\"']+)\\1");
    private static final Pattern QUOTED_STRING_PATTERN = Pattern.compile("([\"'])(.*?)\\1");
    private static final Pattern UNICODE_ESCAPE_PATTERN = Pattern.compile("\\\\u([0-9a-fA-F]{4})");
    private static final Pattern HEX_ESCAPE_PATTERN = Pattern.compile("\\\\x([0-9a-fA-F]{2})");
    private static final Pattern DECIMAL_HTML_ENTITY_PATTERN = Pattern.compile("&#(\\d{1,7});");
    private static final Pattern HEX_HTML_ENTITY_PATTERN = Pattern.compile("&#x([0-9a-fA-F]{1,6});");
    private static final Pattern TOPM_CDN_IMAGE_ID_PATTERN = Pattern.compile("(?i)(?:^|[/_-])([A-Za-z0-9_-]{16,})(?:$|[._/-])");
    private static final Pattern IPV4_HOST_PATTERN = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}$");
    private static final Pattern IPV6_HOST_PATTERN = Pattern.compile("^[0-9a-fA-F:]+$");
    private static final int MAX_RECURSIVE_IMAGE_DEPTH = 8;
    private static final String IMPORT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ShopMX-ProductImporter/1.0";
    private static final String[] STRUCTURED_IMAGE_VALUE_FIELDS = {
            "url", "src", "image", "imageUrl", "image_url", "contentUrl", "content_url", "thumbnailUrl", "thumbnail_url", "thumbnail", "mainImage", "main_image",
            "cover", "coverUrl", "cover_url", "videoCover", "video_cover", "pic", "picture", "photo", "media", "mediaUrl", "media_url", "picUrl", "pic_url", "pictureUrl", "picture_url", "photoUrl", "photo_url", "mainPic", "main_pic", "mainPicture", "main_picture", "goodsImg", "goods_img", "goodsPic", "goods_pic", "goodsPicture", "goods_picture", "goodsImage", "goods_image", "goodsImageUrl", "goods_image_url", "originalImg", "original_img", "originalPic", "original_pic", "originalPicture", "original_picture", "originalImageUrl", "original_image_url", "originImg", "origin_img", "originUrl", "origin_url", "originPic", "origin_pic", "originPicture", "origin_picture", "originImage", "origin_image"
    };
    private static final String[] TOPM_IMAGE_LIST_FIELDS = {
            "pictures", "picture", "gallery", "galleries", "goods_gallery", "goodsGallery", "goodsGalleryList", "goods_gallery_list",
            "images", "image_list", "imageList", "pic_list", "picList", "img_list", "imgList", "imgs", "photos", "photoList", "photo_list", "photo_list_arr", "pictureList", "picture_list", "mediaList", "media_list", "detailImages", "detail_images", "descImages", "desc_images", "goodsImages", "goods_images", "goodsPictures", "goods_pictures",
            "image_urls", "imageUrls", "image_url_list", "imageUrlList", "img_urls", "imgUrls", "pic_urls", "picUrls", "imgListJson", "imageListJson", "galleryJson", "goods_img_list", "goodsImgList", "goods_gallery_json", "goodsGalleryJson",
            "specification", "values", "sku", "skus", "skuImages", "sku_images", "variants", "variantImages", "variant_images"
    };
    private static final String[] TOPM_IMAGE_VALUE_FIELDS = {
            "img_url", "imgUrl", "url", "href", "image", "imageUrl", "image_url", "contentUrl", "content_url", "media", "mediaUrl", "media_url", "thumbnailUrl", "thumbnail_url", "pic", "picture", "photo", "src", "thumb", "thumb_url", "thumbUrl",
            "main_image", "mainImage", "img_file", "img_flie", "img_site", "goods_img", "goods_pic", "goods_picture", "goods_thumb", "original_img", "original_pic", "original_picture",
            "origin_img", "origin_url", "originUrl", "originImage", "origin_image", "origin_pic", "origin_picture", "originalImage", "original_image", "goods_image", "goodsImage", "cover", "cover_url", "coverUrl", "videoCover", "video_cover",
            "goodsImg", "originalImg", "picUrl", "pic_url", "pictureUrl", "picture_url", "mainPic", "mainPicUrl", "main_pic", "main_pic_url", "mainPicture", "mainPictureUrl", "main_picture", "main_picture_url", "srcUrl", "src_url", "path", "imagePath", "image_path", "filePath", "file_path",
            "imagePathUrl", "image_path_url", "preview", "previewUrl", "preview_url", "large", "largeUrl", "large_url", "zoom", "zoomUrl", "zoom_url", "goods_gallery_img", "goodsGalleryImg", "goods_image_url", "goodsImageUrl", "original_image_url", "originalImageUrl", "origin_pic", "originPic", "source_url", "sourceUrl", "cdn_url", "cdnUrl"
    };
    private static final String[] TOPM_GOODS_INFO_QUERY_FIELDS = {
            "platform", "goods_sn", "add_time", "formated_add_time"
    };
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
        applyDynamicProductFallback(uri, html, preview);
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
        collectImageUrlsFromText(preview.getImages(), sourceUrl);
        collectImageUrlsFromQueryParams(preview.getImages(), uri);
        collectMetaImages(preview, html);
        collectHtmlImages(preview, html);
        collectEmbeddedJsonImages(preview, html);
        finalizePreview(preview, uri);
        return preview;
    }

    private String fetchHtml(URI uri, int redirectCount) {
        if (redirectCount > MAX_REDIRECTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many redirects while importing product URL");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", IMPORT_USER_AGENT)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("Cache-Control", "no-cache")
                    .header("Pragma", "no-cache")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            int status = response.statusCode();
            if (status >= 300 && status < 400) {
                String location = response.headers().firstValue("location")
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Redirect response did not include a location"));
                closeQuietly(response.body());
                return fetchHtml(normalizeAndValidateUri(uri.resolve(location).toString()), redirectCount + 1);
            }
            if (status < 200 || status >= 300) {
                closeQuietly(response.body());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product page returned HTTP " + status);
            }
            String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
            if (!contentType.isEmpty() && !contentType.contains("text/html") && !contentType.contains("application/xhtml")) {
                closeQuietly(response.body());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL must point to a public HTML product page");
            }
            long contentLength = response.headers().firstValueAsLong("content-length").orElse(-1L);
            if (contentLength > MAX_HTML_BYTES) {
                closeQuietly(response.body());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product page is too large to import");
            }
            byte[] body = readHtmlBody(response.body());
            return decodeHtmlBody(body, contentType);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to fetch product page");
        }
    }

    private void applyDynamicProductFallback(URI sourceUri, String html, ProductUrlImportPreview preview) {
        if (!looksLikeTopmDetailPage(sourceUri, html)) {
            return;
        }
        String goodsId = firstNonBlank(queryParam(sourceUri, "goods_id"), queryParam(sourceUri, "goodsId"), queryParam(sourceUri, "id"), topmGoodsIdFromNestedUrl(sourceUri));
        if (isBlank(goodsId)) {
            return;
        }
        try {
            String body = fetchTopmGoodsInfo(sourceUri, goodsId);
            if (!isBlank(body)) {
                applyTopmGoodsInfoJson(preview, sourceUri, body);
            }
        } catch (Exception ignored) {
            // Dynamic storefront APIs are best-effort; static metadata still provides a usable preview when present.
        }
        applyTopmGoodsUrlFallback(sourceUri, preview);
        collectImageUrlsFromText(preview.getImages(), sourceUri.toString());
        collectImageUrlsFromText(preview.getImages(), queryParam(sourceUri, "goods_url"));
        collectImageUrlsFromQueryParams(preview.getImages(), sourceUri);
        finalizePreview(preview, sourceUri);
    }

    private boolean looksLikeTopmDetailPage(URI sourceUri, String html) {
        String source = html == null ? "" : html;
        String path = sourceUri.getPath() == null ? "" : sourceUri.getPath();
        String host = sourceUri.getHost() == null ? "" : sourceUri.getHost().toLowerCase(Locale.ROOT);
        boolean hasGoodsId = !isBlank(queryParam(sourceUri, "goods_id"))
                || !isBlank(queryParam(sourceUri, "goodsId"))
                || !isBlank(queryParam(sourceUri, "id"))
                || !isBlank(topmGoodsIdFromNestedUrl(sourceUri));
        return hasGoodsId
                && path.endsWith("/detail.html")
                && (host.equals("topm.tech")
                || host.endsWith(".topm.tech")
                || source.contains("TopmConfig")
                || source.contains("/goods/info")
                || source.contains("/js/detail/order-tools.js"));
    }

    private String fetchTopmGoodsInfo(URI sourceUri, String goodsId) throws IOException, InterruptedException {
        String body = buildTopmGoodsInfoRequestBody(sourceUri, goodsId);
        for (URI candidate : resolveTopmGoodsInfoEndpoints(sourceUri)) {
            URI endpoint = normalizeAndValidateUri(candidate.toString());
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", IMPORT_USER_AGENT)
                    .header("Accept", "application/json,text/plain,*/*")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Origin", sourceUri.getScheme() + "://" + sourceUri.getHost())
                    .header("Referer", sourceUri.toString())
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            String responseText = sendTopmRequest(request);
            if (!isBlank(responseText)) {
                return responseText;
            }
        }
        for (URI candidate : resolveTopmGoodsInfoGetEndpoints(sourceUri, body)) {
            URI endpoint = normalizeAndValidateUri(candidate.toString());
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", IMPORT_USER_AGENT)
                    .header("Accept", "application/json,text/plain,*/*")
                    .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                    .header("Referer", sourceUri.toString())
                    .GET()
                    .build();
            String responseText = sendTopmRequest(request);
            if (!isBlank(responseText)) {
                return responseText;
            }
        }
        return null;
    }

    private String sendTopmRequest(HttpRequest request) throws IOException, InterruptedException {
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            closeQuietly(response.body());
            return null;
        }
        long contentLength = response.headers().firstValueAsLong("content-length").orElse(-1L);
        if (contentLength > MAX_HTML_BYTES) {
            closeQuietly(response.body());
            return null;
        }
        String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
        byte[] responseBody = readHtmlBody(response.body());
        return decodeHtmlBody(responseBody, contentType);
    }

    private String decodeHtmlBody(byte[] body, String contentType) {
        if (body == null || body.length == 0) {
            return "";
        }
        Charset charset = charsetFromContentType(contentType);
        if (charset == null) {
            String utf8Probe = new String(body, StandardCharsets.UTF_8);
            charset = charsetFromHtml(utf8Probe);
            if (charset != null) {
                return new String(body, charset);
            }
            return utf8Probe;
        }
        return new String(body, charset);
    }

    private Charset charsetFromContentType(String contentType) {
        if (isBlank(contentType)) {
            return null;
        }
        Matcher matcher = Pattern.compile("(?i)charset\\s*=\\s*([a-z0-9_\\-]+)").matcher(contentType);
        return matcher.find() ? charsetByName(matcher.group(1)) : null;
    }

    private Charset charsetFromHtml(String html) {
        if (isBlank(html)) {
            return null;
        }
        Matcher matcher = Pattern.compile("(?is)<meta[^>]+charset\\s*=\\s*['\"]?([a-z0-9_\\-]+)").matcher(html);
        if (matcher.find()) {
            return charsetByName(matcher.group(1));
        }
        matcher = Pattern.compile("(?is)<meta[^>]+content\\s*=\\s*['\"][^'\"]*charset\\s*=\\s*([a-z0-9_\\-]+)").matcher(html);
        return matcher.find() ? charsetByName(matcher.group(1)) : null;
    }

    private Charset charsetByName(String value) {
        try {
            return isBlank(value) ? null : Charset.forName(value.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<URI> resolveTopmGoodsInfoEndpoints(URI sourceUri) {
        List<URI> endpoints = new ArrayList<>();
        String path = sourceUri.getPath() == null ? "" : sourceUri.getPath();
        int detailIndex = path.lastIndexOf("/detail.html");
        String prefix = detailIndex > 0 ? path.substring(0, detailIndex) : "";
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/info"));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/info"));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/getInfo"));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/getInfo"));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/goods/info"));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/detail"));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/detail"));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/detailInfo"));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/detailInfo"));
        return endpoints;
    }

    private List<URI> resolveTopmGoodsInfoGetEndpoints(URI sourceUri, String query) {
        List<URI> endpoints = new ArrayList<>();
        String path = sourceUri.getPath() == null ? "" : sourceUri.getPath();
        int detailIndex = path.lastIndexOf("/detail.html");
        String prefix = detailIndex > 0 ? path.substring(0, detailIndex) : "";
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/info?" + query));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/info?" + query));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/getInfo?" + query));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/getInfo?" + query));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/goods/info?" + query));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/detail?" + query));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/detail?" + query));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/api/goods/detailInfo?" + query));
        addEndpoint(endpoints, sourceUri.resolve("/api/goods/detailInfo?" + query));
        addEndpoint(endpoints, sourceUri.resolve((prefix.isBlank() ? "" : prefix) + "/goods.php?act=goods_info&" + query));
        addEndpoint(endpoints, sourceUri.resolve("/goods.php?act=goods_info&" + query));
        return endpoints;
    }

    private void addEndpoint(List<URI> endpoints, URI endpoint) {
        if (endpoint == null || endpoints.contains(endpoint)) {
            return;
        }
        endpoints.add(endpoint);
    }

    private String buildTopmGoodsInfoRequestBody(URI sourceUri, String goodsId) {
        StringBuilder body = new StringBuilder();
        appendFormField(body, "goods_id", goodsId);
        appendFormField(body, "goodsId", goodsId);
        appendFormField(body, "id", goodsId);
        for (String field : TOPM_GOODS_INFO_QUERY_FIELDS) {
            appendFormField(body, field, queryParam(sourceUri, field));
        }
        appendFormField(body, "lang", firstNonBlank(queryParam(sourceUri, "lang"), "zh_cn"));
        return body.toString();
    }

    private String topmGoodsIdFromNestedUrl(URI sourceUri) {
        String goodsUrl = queryParam(sourceUri, "goods_url");
        if (isBlank(goodsUrl)) {
            return null;
        }
        try {
            URI nested = URI.create(decodeImageCandidate(goodsUrl).trim());
            return firstNonBlank(queryParam(nested, "id"), queryParam(nested, "goods_id"), queryParam(nested, "goodsId"));
        } catch (Exception ignored) {
            return null;
        }
    }

    private void appendFormField(StringBuilder body, String name, String value) {
        if (isBlank(name) || isBlank(value)) {
            return;
        }
        if (body.length() > 0) {
            body.append('&');
        }
        body.append(URLEncoder.encode(name, StandardCharsets.UTF_8))
                .append('=')
                .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
    }

    private void applyTopmGoodsUrlFallback(URI sourceUri, ProductUrlImportPreview preview) {
        String goodsUrl = queryParam(sourceUri, "goods_url");
        if (isBlank(goodsUrl)) {
            return;
        }
        try {
            URI goodsUri = normalizeAndValidateUri(decodeImageCandidate(goodsUrl));
            String nestedGoodsId = firstNonBlank(queryParam(goodsUri, "id"), queryParam(goodsUri, "goods_id"), queryParam(goodsUri, "goodsId"));
            if (!isBlank(nestedGoodsId)) {
                try {
                    String body = fetchTopmGoodsInfo(goodsUri, nestedGoodsId);
                    if (!isBlank(body)) {
                        ProductUrlImportPreview dynamicFallback = new ProductUrlImportPreview();
                        dynamicFallback.setSourceUrl(goodsUri.toString());
                        dynamicFallback.setSourceHost(goodsUri.getHost());
                        applyTopmGoodsInfoJson(dynamicFallback, goodsUri, body);
                        mergeFallbackPreview(preview, dynamicFallback);
                    }
                } catch (Exception ignored) {
                    // Static nested page parsing below still provides a fallback when TOPM APIs block crawlers.
                }
            }
            String goodsHtml = fetchHtml(goodsUri, 0);
            ProductUrlImportPreview fallback = parseProductHtml(goodsUri.toString(), goodsHtml);
            mergeFallbackPreview(preview, fallback);
            finalizePreview(preview, sourceUri);
        } catch (Exception ignored) {
            // Nested TOPM goods URLs are optional and may block crawlers; keep the best available preview.
        }
    }

    private void mergeFallbackPreview(ProductUrlImportPreview preview, ProductUrlImportPreview fallback) {
        if (preview == null || fallback == null) {
            return;
        }
        setIfPresentWhenBlank(preview::setName, preview.getName(), fallback.getName());
        setIfPresentWhenBlank(preview::setDescription, preview.getDescription(), fallback.getDescription());
        setIfPresentWhenBlank(preview::setBrand, preview.getBrand(), fallback.getBrand());
        setIfPresentWhenBlank(preview::setCurrency, preview.getCurrency(), fallback.getCurrency());
        if (preview.getPrice() == null) {
            preview.setPrice(fallback.getPrice());
        }
        if (preview.getOriginalPrice() == null) {
            preview.setOriginalPrice(fallback.getOriginalPrice());
        }
        if (isBlank(preview.getImageUrl())) {
            preview.setImageUrl(fallback.getImageUrl());
        }
        if (fallback.getImageUrl() != null) {
            addLikelyImage(preview.getImages(), fallback.getImageUrl());
        }
        for (String image : fallback.getImages()) {
            addLikelyImage(preview.getImages(), image);
        }
        for (String blockedImage : fallback.getBlockedImages()) {
            if (!preview.getBlockedImages().contains(blockedImage)) {
                preview.getBlockedImages().add(blockedImage);
            }
        }
    }

    ProductUrlImportPreview applyTopmGoodsInfoJson(ProductUrlImportPreview preview, URI sourceUri, String json) {
        if (preview == null || isBlank(json)) {
            return preview;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(json);
            JsonNode data = root.has("data") ? root.get("data") : root;
            if (data != null && data.isArray() && data.size() > 0) {
                data = data.get(0);
            }
            if (data == null || !data.isObject()) {
                return preview;
            }
            setIfPresent(preview::setName, firstNonBlank(
                    text(data.get("goods_name")),
                    text(data.get("cloud_goodsname")),
                    text(data.get("title")),
                    text(data.get("name"))));
            setIfPresent(preview::setDescription, firstNonBlank(
                    text(data.get("goods_desc")),
                    text(data.get("desc_mobile")),
                    text(data.get("goods_brief")),
                    text(data.get("description"))));
            setIfPresent(preview::setBrand, firstNonBlank(
                    topmText(data.get("brand")),
                    text(data.at("/shopinfo/shop_name")),
                    text(data.get("supplier_name"))));
            applyTopmPrice(preview, data);
            List<String> images = topmImages(data);
            if (!images.isEmpty()) {
                preview.setImageUrl(images.get(0));
                preview.setImages(images);
            }
            finalizePreview(preview, sourceUri);
        } catch (Exception ignored) {
            // Ignore malformed dynamic JSON and keep the static preview.
        }
        return preview;
    }

    private void applyTopmPrice(ProductUrlImportPreview preview, JsonNode data) {
        if (preview.getPrice() == null) {
            preview.setPrice(parsePrice(firstNonBlank(
                    text(data.get("shop_price_formated")),
                    text(data.get("shop_price")),
                    text(data.get("goods_price")),
                    text(data.get("price")),
                    text(data.get("product_price")))).orElse(null));
        }
        if (preview.getOriginalPrice() == null) {
            preview.setOriginalPrice(parsePrice(firstNonBlank(
                    text(data.get("market_price")),
                    text(data.get("marketPrice")),
                    text(data.get("rank_price")))).orElse(null));
        }
        if (isBlank(preview.getCurrency())) {
            String priceText = firstNonBlank(
                    text(data.get("shop_price_formated")),
                    text(data.get("market_price")),
                    text(data.get("price")));
            if (priceText != null && priceText.toUpperCase(Locale.ROOT).contains("MXN")) {
                preview.setCurrency("MXN");
            }
        }
    }

    private List<String> topmImages(JsonNode data) {
        List<String> images = new ArrayList<>();
        addTopmImage(images, text(data.get("cover")));
        addTopmImage(images, text(data.get("coverUrl")));
        addTopmImage(images, text(data.get("cover_url")));
        addTopmImage(images, text(data.get("goods_img")));
        addTopmImage(images, text(data.get("goodsImg")));
        addTopmImage(images, text(data.get("goods_pic")));
        addTopmImage(images, text(data.get("goodsPic")));
        addTopmImage(images, text(data.get("goods_picture")));
        addTopmImage(images, text(data.get("goodsPicture")));
        addTopmImage(images, text(data.get("goods_thumb")));
        addTopmImage(images, text(data.get("goodsThumb")));
        addTopmImage(images, text(data.get("main_image")));
        addTopmImage(images, text(data.get("mainImage")));
        addTopmImage(images, text(data.get("main_pic")));
        addTopmImage(images, text(data.get("mainPic")));
        for (String field : TOPM_IMAGE_LIST_FIELDS) {
            collectTopmImages(images, data.get(field));
        }
        collectLikelyImageValues(images, data, 0);
        addTopmImage(images, text(data.get("original_img")));
        addTopmImage(images, text(data.get("original_pic")));
        addTopmImage(images, text(data.get("original_picture")));
        addTopmImage(images, text(data.get("goods_img")));
        addTopmImage(images, text(data.get("goods_pic")));
        addTopmImage(images, text(data.get("goods_picture")));
        addTopmImage(images, text(data.get("goods_thumb")));
        addTopmImage(images, text(data.get("cover")));
        addTopmImage(images, text(data.get("cover_url")));
        addTopmImage(images, text(data.get("media")));
        addTopmImage(images, text(data.get("media_url")));
        addTopmImage(images, text(data.get("photo")));
        addTopmImage(images, text(data.get("photo_url")));
        addTopmImage(images, text(data.get("origin_url")));
        addTopmImage(images, text(data.get("video_img_url")));
        return images;
    }

    private void collectTopmImages(List<String> images, JsonNode node) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                collectTopmImageItem(images, item);
            }
            return;
        }
        if (node.isTextual()) {
            collectTopmImagesFromText(images, node.asText());
            return;
        }
        collectTopmImageItem(images, node);
    }

    private void collectTopmImageItem(List<String> images, JsonNode item) {
        if (item == null || item.isNull()) {
            return;
        }
        if (!item.isObject()) {
            addTopmImage(images, text(item));
            return;
        }
        for (String field : TOPM_IMAGE_VALUE_FIELDS) {
            addTopmImage(images, text(item.get(field)));
        }
        for (String field : TOPM_IMAGE_LIST_FIELDS) {
            collectTopmImages(images, item.get(field));
        }
        collectLikelyImageValues(images, item, 0);
    }

    private void addTopmImage(List<String> images, String image) {
        String cleaned = decodeImageCandidate(image);
        if (isBlank(cleaned)) {
            return;
        }
        String normalized = cleaned.toLowerCase(Locale.ROOT);
        if (normalized.contains("no_picture") || normalized.startsWith("data:")) {
            return;
        }
        addLikelyImage(images, cleaned);
    }

    private void collectTopmImagesFromText(List<String> images, String value) {
        if (isBlank(value) || images.size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        String decoded = decodeImageCandidate(value);
        if (isBlank(decoded)) {
            return;
        }
        addTopmImage(images, decoded);
        collectImageUrlsFromText(images, decoded);
        Matcher stringMatcher = QUOTED_STRING_PATTERN.matcher(decoded);
        while (stringMatcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            addTopmImage(images, stringMatcher.group(2));
        }
        for (String part : decoded.split("[,|]")) {
            if (images.size() >= MAX_IMPORT_IMAGES) {
                break;
            }
            addTopmImage(images, part);
        }
        String trimmed = decoded.trim();
        if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
            try {
                collectLikelyImageValues(images, OBJECT_MAPPER.readTree(trimmed), 0);
            } catch (Exception ignored) {
                // Keep loose URL extraction for JavaScript-style arrays or malformed JSON strings.
            }
        }
    }

    byte[] readHtmlBody(InputStream inputStream) throws IOException {
        try (InputStream body = inputStream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = body.read(buffer)) != -1) {
                if (output.size() + read > MAX_HTML_BYTES) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product page is too large to import");
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private void closeQuietly(InputStream inputStream) {
        try {
            if (inputStream != null) {
                inputStream.close();
            }
        } catch (IOException ignored) {
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
        collectStructuredImages(images, imageNode, 0);
        return images;
    }

    private void collectStructuredImages(List<String> images, JsonNode node, int depth) {
        if (node == null || node.isNull() || depth > MAX_RECURSIVE_IMAGE_DEPTH || images.size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        if (node.isTextual()) {
            addLikelyImage(images, text(node));
            return;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                collectStructuredImages(images, item, depth + 1);
                if (images.size() >= MAX_IMPORT_IMAGES) {
                    return;
                }
            }
            return;
        }
        if (!node.isObject()) {
            return;
        }
        for (String field : STRUCTURED_IMAGE_VALUE_FIELDS) {
            collectStructuredImages(images, node.get(field), depth + 1);
            if (images.size() >= MAX_IMPORT_IMAGES) {
                return;
            }
        }
    }

    private void addImage(List<String> images, String image) {
        String cleaned = decodeImageCandidate(image);
        if (!isBlank(cleaned) && images.size() < MAX_IMPORT_IMAGES && !images.contains(cleaned)) {
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
                            || "og:image:secure_url".equalsIgnoreCase(property)
                            || "twitter:image".equalsIgnoreCase(property)
                            || "twitter:image:src".equalsIgnoreCase(property)
                            || "image".equalsIgnoreCase(property))) {
                addLikelyImage(preview.getImages(), attribute(attrs, "content"));
            }
        }
    }

    private void collectHtmlImages(ProductUrlImportPreview preview, String html) {
        Matcher matcher = HTML_IMAGE_PATTERN.matcher(html == null ? "" : html);
        List<String> imageAttrs = new ArrayList<>();
        List<String> sourceAttrs = new ArrayList<>();
        while (matcher.find()) {
            String tagName = matcher.group(1);
            String attrs = matcher.group(2);
            if ("img".equalsIgnoreCase(tagName)) {
                imageAttrs.add(attrs);
            } else {
                sourceAttrs.add(attrs);
            }
        }
        imageAttrs.forEach(attrs -> collectHtmlImageAttributes(preview, attrs));
        sourceAttrs.forEach(attrs -> collectHtmlImageAttributes(preview, attrs));
        collectCssImageUrls(preview.getImages(), html);
        if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
        }
    }

    private void collectHtmlImageAttributes(ProductUrlImportPreview preview, String attrs) {
        addImageCandidate(preview, attribute(attrs, "src"));
        addImageCandidate(preview, attribute(attrs, "data-src"));
        addImageCandidate(preview, attribute(attrs, "data-original"));
        addImageCandidate(preview, attribute(attrs, "data-original-src"));
        addImageCandidate(preview, attribute(attrs, "data-lazy"));
        addImageCandidate(preview, attribute(attrs, "data-lazyload"));
        addImageCandidate(preview, attribute(attrs, "data-lazy-src"));
        addImageCandidate(preview, attribute(attrs, "data-lazyload-src"));
        addImageCandidate(preview, attribute(attrs, "data-src-medium"));
        addImageCandidate(preview, attribute(attrs, "data-src-large"));
        addImageCandidate(preview, attribute(attrs, "data-large"));
        addImageCandidate(preview, attribute(attrs, "data-large-image"));
        addImageCandidate(preview, attribute(attrs, "data-thumb"));
        addImageCandidate(preview, attribute(attrs, "data-thumbnail"));
        addImageCandidate(preview, attribute(attrs, "data-ks-lazyload"));
        addImageCandidate(preview, attribute(attrs, "data-img"));
        addImageCandidate(preview, attribute(attrs, "data-image"));
        addImageCandidate(preview, attribute(attrs, "data-image-src"));
        addImageCandidate(preview, attribute(attrs, "data-image-url"));
        addImageCandidate(preview, attribute(attrs, "data-img-src"));
        addImageCandidate(preview, attribute(attrs, "data-img-url"));
        addImageCandidate(preview, attribute(attrs, "data-file"));
        addImageCandidate(preview, attribute(attrs, "data-file-url"));
        addImageCandidate(preview, attribute(attrs, "data-bg"));
        addImageCandidate(preview, attribute(attrs, "data-bg-src"));
        addImageCandidate(preview, attribute(attrs, "data-bg-url"));
        addImageCandidate(preview, attribute(attrs, "data-background"));
        addImageCandidate(preview, attribute(attrs, "data-background-image"));
        addImageCandidate(preview, attribute(attrs, "data-background-src"));
        addImageCandidate(preview, attribute(attrs, "data-background-url"));
        addImageCandidate(preview, attribute(attrs, "data-original-image"));
        addImageCandidate(preview, attribute(attrs, "data-zoom"));
        addImageCandidate(preview, attribute(attrs, "data-zoom-image"));
        addImageCandidate(preview, attribute(attrs, "poster"));
        collectSrcSetImages(preview, attribute(attrs, "srcset"));
        collectSrcSetImages(preview, attribute(attrs, "data-srcset"));
        collectSrcSetImages(preview, attribute(attrs, "data-original-srcset"));
        collectSrcSetImages(preview, attribute(attrs, "data-lazy-srcset"));
        collectSrcSetImages(preview, attribute(attrs, "data-lazyload-srcset"));
        collectSrcSetImages(preview, attribute(attrs, "imagesrcset"));
        collectCssImageUrls(preview.getImages(), attribute(attrs, "style"));
        collectImageLikeAttributeValues(preview, attrs);
    }

    private void collectImageLikeAttributeValues(ProductUrlImportPreview preview, String attrs) {
        if (preview == null || isBlank(attrs) || preview.getImages().size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        Matcher matcher = ATTR_PATTERN.matcher(attrs);
        while (matcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            String name = matcher.group(1) == null ? "" : matcher.group(1).toLowerCase(Locale.ROOT);
            String value = matcher.group(3);
            collectImageCarrierAttribute(preview, name, value);
        }
        Matcher unquotedMatcher = UNQUOTED_ATTR_PATTERN.matcher(attrs);
        while (unquotedMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            String name = unquotedMatcher.group(1) == null ? "" : unquotedMatcher.group(1).toLowerCase(Locale.ROOT);
            String value = unquotedMatcher.group(2);
            collectImageCarrierAttribute(preview, name, value);
        }
    }

    private void collectImageCarrierAttribute(ProductUrlImportPreview preview, String name, String value) {
        if (preview == null || isBlank(value) || preview.getImages().size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        boolean likelyCarrier = name.startsWith("data-")
                || name.contains("src")
                || name.contains("image")
                || name.contains("img")
                || name.contains("pic")
                || name.contains("thumb")
                || name.contains("gallery")
                || name.contains("poster")
                || name.contains("background")
                || name.equals("href")
                || name.contains("style");
        if (!likelyCarrier) {
            return;
        }
        addImageCandidate(preview, value);
        collectImageUrlsFromText(preview.getImages(), value);
        collectCssImageUrls(preview.getImages(), value);
        if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
        }
    }

    private void collectCssImageUrls(List<String> images, String value) {
        if (isBlank(value)) {
            return;
        }
        Matcher matcher = STYLE_URL_PATTERN.matcher(decodeImageCandidate(value));
        while (matcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            addLikelyImage(images, matcher.group(2));
        }
    }

    private void collectSrcSetImages(ProductUrlImportPreview preview, String srcset) {
        if (isBlank(srcset)) {
            return;
        }
        for (String candidate : srcset.split(",")) {
            String[] parts = candidate.trim().split("\\s+");
            if (parts.length > 0) {
                addImageCandidate(preview, parts[0]);
            }
        }
    }

    private void collectEmbeddedJsonImages(ProductUrlImportPreview preview, String html) {
        Matcher matcher = SCRIPT_JSON_PATTERN.matcher(html == null ? "" : html);
        while (matcher.find()) {
            String script = matcher.group(1);
            String normalizedScript = script == null ? "" : script.toLowerCase(Locale.ROOT);
            if (isBlank(script)
                    || !normalizedScript.contains("http")
                    && !normalizedScript.contains("image")
                    && !normalizedScript.contains("img")
                    && !normalizedScript.contains("pic")
                    && !normalizedScript.contains("photo")
                    && !normalizedScript.contains("media")
                    && !normalizedScript.contains("cover")
                    && !normalizedScript.contains("goods")
                    && !normalizedScript.contains("thumb")
                    && !normalizedScript.contains("gallery")
                    && !normalizedScript.contains("src")) {
                continue;
            }
            collectJsonObjectImages(preview, script);
            collectImageUrlsFromText(preview.getImages(), script);
            collectLooseEmbeddedImages(preview, script);
            collectTopmInlineImageArrays(preview, script);
            collectCssImageUrls(preview.getImages(), script);
        }
        if (isTopmSource(preview) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
        } else if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
        }
    }

    private boolean isTopmSource(ProductUrlImportPreview preview) {
        String sourceHost = preview == null ? "" : String.valueOf(preview.getSourceHost()).toLowerCase(Locale.ROOT);
        String sourceUrl = preview == null ? "" : String.valueOf(preview.getSourceUrl()).toLowerCase(Locale.ROOT);
        return sourceHost.equals("topm.tech") || sourceHost.endsWith(".topm.tech") || sourceUrl.contains("topm.tech/");
    }

    private void collectJsonObjectImages(ProductUrlImportPreview preview, String script) {
        List<String> candidates = balancedJsonCandidates(script);
        for (String candidate : candidates) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(unescapeHtml(candidate));
                collectLikelyImageValues(preview.getImages(), root, 0);
            } catch (Exception ignored) {
                // Many storefront scripts are JavaScript object literals; skip malformed snippets.
            }
        }
    }

    private void collectLooseEmbeddedImages(ProductUrlImportPreview preview, String script) {
        if (preview == null || isBlank(script) || preview.getImages().size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        String decoded = decodeCommonScriptEscapes(unescapeHtml(script));
        Matcher quotedMatcher = EMBEDDED_IMAGE_PATTERN.matcher(decoded == null ? "" : decoded);
        while (quotedMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            addImageCandidate(preview, quotedMatcher.group(2));
        }
        Matcher topmFieldMatcher = TOPM_GENERIC_IMAGE_FIELD_PATTERN.matcher(decoded == null ? "" : decoded);
        while (topmFieldMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            addImageCandidate(preview, topmFieldMatcher.group(2));
        }
        Matcher looseMatcher = LOOSE_EMBEDDED_IMAGE_PATTERN.matcher(decoded == null ? "" : decoded);
        while (looseMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            addImageCandidate(preview, looseMatcher.group(2));
        }
        Matcher unquotedMatcher = UNQUOTED_EMBEDDED_IMAGE_PATTERN.matcher(decoded == null ? "" : decoded);
        while (unquotedMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            addImageCandidate(preview, unquotedMatcher.group(1));
        }
        Matcher assignedMatcher = ASSIGNED_EMBEDDED_IMAGE_PATTERN.matcher(decoded == null ? "" : decoded);
        while (assignedMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            addImageCandidate(preview, assignedMatcher.group("url"));
        }
        String percentDecoded = decodePercentEncodedUrlParts(decoded);
        if (percentDecoded != null && !percentDecoded.equals(decoded)) {
            collectLooseEmbeddedImages(preview, percentDecoded);
        }
    }

    private void collectTopmInlineImageArrays(ProductUrlImportPreview preview, String script) {
        if (preview == null || isBlank(script) || preview.getImages().size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        String decoded = decodeCommonScriptEscapes(unescapeHtml(script));
        if (isBlank(decoded)) {
            return;
        }
        Matcher matcher = INLINE_IMAGE_ARRAY_PATTERN.matcher(decoded);
        while (matcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
            collectImageUrlsFromText(preview.getImages(), matcher.group(1));
            Matcher stringMatcher = QUOTED_STRING_PATTERN.matcher(matcher.group(1));
            while (stringMatcher.find() && preview.getImages().size() < MAX_IMPORT_IMAGES) {
                addImageCandidate(preview, stringMatcher.group(2));
            }
        }
        if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
        }
    }

    private List<String> balancedJsonCandidates(String value) {
        List<String> candidates = new ArrayList<>();
        if (value == null) {
            return candidates;
        }
        int length = value.length();
        for (int index = 0; index < length && candidates.size() < 12; index++) {
            char start = value.charAt(index);
            if (start != '{' && start != '[') {
                continue;
            }
            int braceDepth = 0;
            int bracketDepth = 0;
            boolean quoted = false;
            boolean escaped = false;
            for (int cursor = index; cursor < length; cursor++) {
                char current = value.charAt(cursor);
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (current == '\\') {
                    escaped = true;
                    continue;
                }
                if (current == '"') {
                    quoted = !quoted;
                    continue;
                }
                if (quoted) {
                    continue;
                }
                if (current == '{') {
                    braceDepth++;
                } else if (current == '[') {
                    bracketDepth++;
                } else if (current == '}') {
                    braceDepth--;
                } else if (current == ']') {
                    bracketDepth--;
                }
                if (braceDepth < 0 || bracketDepth < 0) {
                    break;
                }
                if (braceDepth == 0 && bracketDepth == 0) {
                    String candidate = value.substring(index, cursor + 1).trim();
                    if (candidate.length() >= 16 && candidate.length() <= MAX_HTML_BYTES) {
                        candidates.add(candidate);
                    }
                    index = cursor;
                    break;
                }
            }
        }
        return candidates;
    }

    private void collectLikelyImageValues(List<String> images, JsonNode node, int depth) {
        if (node == null || node.isNull() || depth > MAX_RECURSIVE_IMAGE_DEPTH || images.size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        if (node.isTextual()) {
            String value = node.asText();
            addLikelyImage(images, value);
            collectImageUrlsFromText(images, value);
            String decoded = decodeImageCandidate(value);
            String trimmed = decoded == null ? "" : decoded.trim();
            if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
                try {
                    collectLikelyImageValues(images, OBJECT_MAPPER.readTree(trimmed), depth + 1);
                } catch (Exception ignored) {
                    // Text fields often contain escaped JSON; loose URL extraction above still covers malformed values.
                }
            }
            return;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                collectLikelyImageValues(images, item, depth + 1);
                if (images.size() >= MAX_IMPORT_IMAGES) {
                    return;
                }
            }
            return;
        }
        if (!node.isObject()) {
            return;
        }
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext() && images.size() < MAX_IMPORT_IMAGES) {
            Map.Entry<String, JsonNode> entry = fields.next();
            if (images.size() >= MAX_IMPORT_IMAGES) {
                return;
            }
            String key = entry.getKey() == null ? "" : entry.getKey().toLowerCase(Locale.ROOT);
            JsonNode value = entry.getValue();
            if (key.contains("image")
                    || key.contains("img")
                    || key.contains("pic")
                    || key.contains("photo")
                    || key.contains("media")
                    || key.contains("cover")
                    || key.contains("thumb")
                    || key.contains("gallery")
                    || key.contains("goods")
                    || key.contains("detail")
                    || key.contains("desc")) {
                collectLikelyImageValues(images, value, depth + 1);
            } else if (value != null && (value.isObject() || value.isArray())) {
                collectLikelyImageValues(images, value, depth + 1);
            }
        }
    }

    private void addLikelyImage(List<String> images, String value) {
        String cleaned = decodeImageCandidate(value);
        if (isBlank(cleaned)) {
            return;
        }
        String normalized = decodeImageCandidate(cleaned);
        String lower = normalized.toLowerCase(Locale.ROOT);
        String pathLower = imagePathLower(normalized);
        String hostLower = imageHostLower(normalized);
        if (lower.startsWith("data:") || lower.contains("no_picture")) {
            return;
        }
        boolean absoluteLike = lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//");
        boolean extensionLike = hasImageFileExtension(normalized);
        boolean plainTopmPageUrl = absoluteLike
                && (hostLower.endsWith("topm.tech") || hostLower.endsWith(".topm.tech"))
                && (pathLower.contains("/goods.php") || pathLower.contains("/new/detail"));
        boolean pathMediaLike = pathLower.contains("/image/")
                || pathLower.contains("/images/")
                || pathLower.contains("/img/")
                || pathLower.contains("/imgs/")
                || pathLower.contains("/upload/")
                || pathLower.contains("/uploads/")
                || pathLower.contains("/thumb/")
                || pathLower.contains("/thumbnail/")
                || pathLower.contains("/tos-");
        boolean transformLike = lower.contains("x-oss-process") || lower.contains("imagemogr2");
        boolean knownImageHost = hostLower.contains("tiktokcdn")
                || hostLower.contains("alicdn")
                || hostLower.contains("ibyteimg")
                || hostLower.contains("cloudfront")
                || hostLower.contains("cdn");
        boolean imageHostLike = absoluteLike && !plainTopmPageUrl && (
                pathMediaLike || transformLike || knownImageHost);
        boolean relativeMediaPathLike = pathLower.startsWith("/") && pathMediaLike;
        boolean topmOpaqueImageToken = TOPM_CDN_IMAGE_ID_PATTERN.matcher(normalized).find()
                && (imageHostLike || relativeMediaPathLike || extensionLike);
        boolean imageLike = (lower.startsWith("/") && extensionLike)
                || relativeMediaPathLike
                || extensionLike
                || imageHostLike
                || topmOpaqueImageToken;
        if (!imageLike) {
            return;
        }
        addImage(images, normalized);
    }

    private boolean hasImageFileExtension(String value) {
        String path = imagePathLower(value);
        return path.matches(".*\\.(jpg|jpeg|png|webp|gif|avif|bmp|jfif)$");
    }

    private String imagePathLower(String value) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) {
            return "";
        }
        try {
            URI uri = URI.create(cleaned.startsWith("//") ? "https:" + cleaned : cleaned);
            String path = uri.getPath();
            if (path != null && !path.isBlank()) {
                return path.toLowerCase(Locale.ROOT);
            }
        } catch (Exception ignored) {
            // Fall back to simple delimiter parsing for malformed script fragments.
        }
        int end = cleaned.length();
        int queryIndex = cleaned.indexOf('?');
        int fragmentIndex = cleaned.indexOf('#');
        if (queryIndex >= 0) {
            end = Math.min(end, queryIndex);
        }
        if (fragmentIndex >= 0) {
            end = Math.min(end, fragmentIndex);
        }
        return cleaned.substring(0, Math.max(0, end)).toLowerCase(Locale.ROOT);
    }

    private String imageHostLower(String value) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) {
            return "";
        }
        try {
            URI uri = URI.create(cleaned.startsWith("//") ? "https:" + cleaned : cleaned);
            return uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
            return "";
        }
    }

    private void collectImageUrlsFromText(List<String> images, String value) {
        String normalized = decodeImageCandidate(value);
        if (isBlank(normalized)) {
            return;
        }
        Matcher topmQueryUrlMatcher = TOPM_MEDIA_QUERY_URL_PATTERN.matcher(normalized);
        int priorityInsertIndex = 0;
        while (topmQueryUrlMatcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            String candidate = topmQueryUrlMatcher.group(1);
            String normalizedCandidate = decodeImageCandidate(candidate);
            addLikelyImage(images, candidate);
            int candidateIndex = normalizedCandidate == null ? -1 : images.indexOf(normalizedCandidate);
            if (candidateIndex >= priorityInsertIndex) {
                String prioritized = images.remove(candidateIndex);
                images.add(Math.min(priorityInsertIndex, images.size()), prioritized);
                priorityInsertIndex++;
            }
        }
        Matcher matcher = SCRIPT_IMAGE_URL_PATTERN.matcher(normalized);
        while (matcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            addLikelyImage(images, matcher.group());
        }
        Matcher cdnMatcher = LOOSE_CDN_IMAGE_URL_PATTERN.matcher(normalized);
        while (cdnMatcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            addLikelyImage(images, cdnMatcher.group());
        }
        Matcher topmMediaMatcher = TOPM_MEDIA_PATH_PATTERN.matcher(normalized);
        while (topmMediaMatcher.find() && images.size() < MAX_IMPORT_IMAGES) {
            addLikelyImage(images, topmMediaMatcher.group());
        }
    }

    private void collectImageUrlsFromQueryParams(List<String> images, URI uri) {
        collectImageUrlsFromQueryParams(images, uri, 0);
    }

    private void collectImageUrlsFromQueryParams(List<String> images, URI uri, int depth) {
        if (images == null || uri == null || isBlank(uri.getRawQuery()) || images.size() >= MAX_IMPORT_IMAGES) {
            return;
        }
        if (depth > MAX_RECURSIVE_IMAGE_DEPTH) {
            return;
        }
        String[] pairs = uri.getRawQuery().split("&");
        for (int pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
            if (images.size() >= MAX_IMPORT_IMAGES) {
                break;
            }
            String pair = pairs[pairIndex];
            int equalsIndex = pair.indexOf('=');
            String rawKey = equalsIndex >= 0 ? pair.substring(0, equalsIndex) : pair;
            String rawValue = equalsIndex >= 0 ? pair.substring(equalsIndex + 1) : "";
            String key = recursiveUrlDecodeQueryComponent(rawKey);
            String value = recursiveUrlDecodeQueryComponent(rawValue);
            if (isBlank(value)) {
                continue;
            }
            if (isImageQueryKey(key)) {
                while (pairIndex + 1 < pairs.length) {
                    String nextPair = pairs[pairIndex + 1];
                    int nextEqualsIndex = nextPair.indexOf('=');
                    String nextRawKey = nextEqualsIndex >= 0 ? nextPair.substring(0, nextEqualsIndex) : nextPair;
                    String nextKey = recursiveUrlDecodeQueryComponent(nextRawKey);
                    if (!isImageUrlContinuationQueryKey(nextKey)) {
                        break;
                    }
                    String nextRawValue = nextEqualsIndex >= 0 ? nextPair.substring(nextEqualsIndex + 1) : "";
                    value = value + "&" + nextKey + "=" + recursiveUrlDecodeQueryComponent(nextRawValue);
                    pairIndex++;
                }
            }
            String keyValueText = (isBlank(key) ? "" : key + "=") + value;
            collectImageUrlsFromText(images, keyValueText);
            String decodedCandidate = decodeImageCandidate(value);
            addLikelyImage(images, decodedCandidate);
            if (decodedCandidate != null && decodedCandidate.contains("?")) {
                URI nestedQueryUri = safeUriForQueryOnly(decodedCandidate);
                if (nestedQueryUri != null) {
                    collectImageUrlsFromQueryParams(images, nestedQueryUri, depth + 1);
                }
            }
        }
    }

    private boolean isImageQueryKey(String key) {
        if (isBlank(key)) {
            return false;
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("image")
                || normalized.contains("img")
                || normalized.contains("pic")
                || normalized.contains("photo")
                || normalized.contains("thumb")
                || normalized.contains("cover")
                || normalized.contains("media");
    }

    private boolean isImageUrlContinuationQueryKey(String key) {
        if (isBlank(key)) {
            return false;
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return List.of("from", "width", "height", "w", "h", "format", "quality", "q", "resize",
                "x-oss-process", "imagemogr2").contains(normalized);
    }

    private URI safeUriForQueryOnly(String value) {
        try {
            return URI.create(value);
        } catch (Exception ignored) {
            int queryIndex = value.indexOf('?');
            if (queryIndex < 0) {
                return null;
            }
            try {
                return URI.create("https://topm.tech/placeholder" + value.substring(queryIndex).replace(" ", "%20"));
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private String decodeCommonScriptEscapes(String value) {
        if (value == null) {
            return null;
        }
        return decodeHexEscapes(decodeUnicodeEscapes(value))
                .replace("\\/", "/")
                .replace("\\\\/", "/")
                .replace("\\\"", "\"")
                .replace("\\'", "'")
                .replace("\\u002F", "/")
                .replace("\\u002f", "/")
                .replace("\\u003A", ":")
                .replace("\\u003a", ":")
                .replace("\\u0026", "&")
                .replace("\\u003D", "=")
                .replace("\\u003d", "=")
                .replace("\\u003F", "?")
                .replace("\\u003f", "?");
    }

    private String decodeImageCandidate(String value) {
        if (value == null) {
            return null;
        }
        String decoded = decodeCommonScriptEscapes(unescapeHtml(value));
        for (int i = 0; i < 3 && decoded != null && decoded.indexOf('%') >= 0; i++) {
            String next = decodePercentEncodedUrlParts(decoded);
            if (next.equals(decoded)) {
                break;
            }
            decoded = next;
        }
        return cleanImageCandidateText(decoded);
    }

    private String cleanImageCandidateText(String value) {
        String cleaned = cleanText(value);
        if (isBlank(cleaned)) {
            return cleaned;
        }
        cleaned = cleaned.replace("\\\"", "\"").replace("\\'", "'").trim();
        while (cleaned.length() >= 2
                && ((cleaned.startsWith("\"") && cleaned.endsWith("\""))
                || (cleaned.startsWith("'") && cleaned.endsWith("'")))) {
            cleaned = cleaned.substring(1, cleaned.length() - 1).trim();
        }
        while (!cleaned.isEmpty() && "[,;)]}".indexOf(cleaned.charAt(cleaned.length() - 1)) >= 0) {
            cleaned = cleaned.substring(0, cleaned.length() - 1).trim();
        }
        while (!cleaned.isEmpty() && "[({".indexOf(cleaned.charAt(0)) >= 0) {
            cleaned = cleaned.substring(1).trim();
        }
        return stripTrailingPageQueryParameters(cleaned);
    }

    private String stripTrailingPageQueryParameters(String value) {
        if (isBlank(value) || value.indexOf('?') < 0) {
            return value;
        }
        String lower = value.toLowerCase(Locale.ROOT);
        int queryIndex = lower.indexOf('?');
        int cutIndex = -1;
        for (String marker : List.of(
                "&goods_id=", "&goodsid=", "&goods_sn=", "&platform=", "&add_time=",
                "&formated_add_time=", "&goods_url=", "&spm=", "&sku_id=", "&seller_id=")) {
            int index = lower.indexOf(marker, queryIndex + 1);
            if (index >= 0 && (cutIndex < 0 || index < cutIndex)) {
                cutIndex = index;
            }
        }
        return cutIndex >= 0 ? value.substring(0, cutIndex) : value;
    }

    private String decodePercentEncodedUrlParts(String value) {
        if (value == null || value.indexOf('%') < 0) {
            return value;
        }
        return value
                .replaceAll("(?i)%25", "%")
                .replaceAll("(?i)%3A", ":")
                .replaceAll("(?i)%2F", "/")
                .replaceAll("(?i)%3F", "?")
                .replaceAll("(?i)%26", "&")
                .replaceAll("(?i)%3D", "=")
                .replaceAll("(?i)%2E", ".")
                .replaceAll("(?i)%2D", "-")
                .replaceAll("(?i)%5F", "_")
                .replaceAll("(?i)%7E", "~")
                .replaceAll("(?i)%2C", ",");
    }

    private String decodeUnicodeEscapes(String value) {
        if (value == null || !value.contains("\\u")) {
            return value;
        }
        Matcher matcher = UNICODE_ESCAPE_PATTERN.matcher(value);
        StringBuffer decoded = new StringBuffer();
        while (matcher.find()) {
            try {
                char decodedChar = (char) Integer.parseInt(matcher.group(1), 16);
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(String.valueOf(decodedChar)));
            } catch (Exception ignored) {
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(decoded);
        return decoded.toString();
    }

    private String decodeHexEscapes(String value) {
        if (value == null || !value.contains("\\x")) {
            return value;
        }
        Matcher matcher = HEX_ESCAPE_PATTERN.matcher(value);
        StringBuffer decoded = new StringBuffer();
        while (matcher.find()) {
            try {
                char decodedChar = (char) Integer.parseInt(matcher.group(1), 16);
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(String.valueOf(decodedChar)));
            } catch (Exception ignored) {
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(decoded);
        return decoded.toString();
    }

    private void addImageCandidate(ProductUrlImportPreview preview, String image) {
        addLikelyImage(preview.getImages(), image);
        if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
            preview.setImageUrl(preview.getImages().get(0));
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
            String image = firstNonBlank(
                    regexGroup(EMBEDDED_IMAGE_PATTERN, source, 2),
                    regexGroup(LOOSE_EMBEDDED_IMAGE_PATTERN, source, 2),
                    regexGroup(UNQUOTED_EMBEDDED_IMAGE_PATTERN, source, 1),
                    regexGroup(ASSIGNED_EMBEDDED_IMAGE_PATTERN, source, "url"));
            if (!isBlank(image)) {
                String normalizedImage = decodeImageCandidate(image);
                addLikelyImage(preview.getImages(), normalizedImage);
                if (isBlank(preview.getImageUrl()) && !preview.getImages().isEmpty()) {
                    preview.setImageUrl(preview.getImages().get(0));
                }
            }
        }
    }

    private String regexGroup(Pattern pattern, String value) {
        return regexGroup(pattern, value, 1);
    }

    private String regexGroup(Pattern pattern, String value, int group) {
        Matcher matcher = pattern.matcher(value == null ? "" : value);
        return matcher.find() ? unescapeHtml(matcher.group(group)) : null;
    }

    private String regexGroup(Pattern pattern, String value, String group) {
        Matcher matcher = pattern.matcher(value == null ? "" : value);
        return matcher.find() ? unescapeHtml(matcher.group(group)) : null;
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
        List<String> finalImages = normalizedImages.size() > MAX_IMPORT_IMAGES ? new ArrayList<>(normalizedImages.subList(0, MAX_IMPORT_IMAGES)) : normalizedImages;
        preview.setImages(finalImages);
        if (isBlank(preview.getImageUrl()) && !finalImages.isEmpty()) {
            preview.setImageUrl(finalImages.get(0));
        }
    }

    private void finalizePreview(ProductUrlImportPreview preview, URI baseUri) {
        preview.getWarnings().clear();
        normalizeImages(preview, baseUri);
        if (!isBlank(preview.getImageUrl()) && preview.getImages().isEmpty()) {
            preview.getImages().add(preview.getImageUrl());
        }
        preview.setName(clamp(cleanText(preview.getName()), 180));
        preview.setDescription(clamp(cleanText(preview.getDescription()), 1000));
        preview.setBrand(clamp(cleanText(preview.getBrand()), 120));
        preview.setCurrency(clamp(cleanText(preview.getCurrency()), 12));
        applyQualitySignals(preview);
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
        Matcher unquotedMatcher = UNQUOTED_ATTR_PATTERN.matcher(attrs == null ? "" : attrs);
        while (unquotedMatcher.find()) {
            if (name.equalsIgnoreCase(unquotedMatcher.group(1))) {
                return unescapeHtml(unquotedMatcher.group(2));
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

    private String topmText(JsonNode node) {
        String value = text(node);
        if (isBlank(value) || "false".equalsIgnoreCase(value) || "0".equals(value)) {
            return null;
        }
        return value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return null;
    }

    private void setIfPresent(Consumer<String> setter, String value) {
        if (!isBlank(value)) {
            setter.accept(value);
        }
    }

    private void setIfPresentWhenBlank(Consumer<String> setter, String currentValue, String fallbackValue) {
        if (isBlank(currentValue) && !isBlank(fallbackValue)) {
            setter.accept(fallbackValue);
        }
    }

    private String queryParam(URI uri, String name) {
        if (uri == null || isBlank(uri.getRawQuery()) || isBlank(name)) {
            return null;
        }
        String[] pairs = uri.getRawQuery().split("&");
        for (String pair : pairs) {
            int equalsIndex = pair.indexOf('=');
            String rawKey = equalsIndex >= 0 ? pair.substring(0, equalsIndex) : pair;
            String key = urlDecode(rawKey);
            if (!name.equals(key)) {
                continue;
            }
            String rawValue = equalsIndex >= 0 ? pair.substring(equalsIndex + 1) : "";
            return recursiveUrlDecode(rawValue);
        }
        return null;
    }

    private String recursiveUrlDecode(String value) {
        String decoded = value;
        for (int i = 0; i < 3; i++) {
            String next = urlDecode(decoded);
            if (next == null || next.equals(decoded)) {
                break;
            }
            decoded = next;
        }
        return decoded;
    }

    private String recursiveUrlDecodeQueryComponent(String value) {
        return recursiveUrlDecode(value == null ? "" : value.replace("+", "%2B"));
    }

    private String urlDecode(String value) {
        try {
            return URLDecoder.decode(value == null ? "" : value, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return value;
        }
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
        String named = value
                .replace("&quot;", "\"")
                .replace("&apos;", "'")
                .replace("&#39;", "'")
                .replace("&#34;", "\"")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&nbsp;", " ");
        return decodeHexHtmlEntities(decodeDecimalHtmlEntities(named));
    }

    private String decodeDecimalHtmlEntities(String value) {
        if (value == null || !value.contains("&#")) {
            return value;
        }
        Matcher matcher = DECIMAL_HTML_ENTITY_PATTERN.matcher(value);
        StringBuffer decoded = new StringBuffer();
        while (matcher.find()) {
            try {
                int codePoint = Integer.parseInt(matcher.group(1));
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(new String(Character.toChars(codePoint))));
            } catch (Exception ignored) {
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(decoded);
        return decoded.toString();
    }

    private String decodeHexHtmlEntities(String value) {
        if (value == null || !value.contains("&#")) {
            return value;
        }
        Matcher matcher = HEX_HTML_ENTITY_PATTERN.matcher(value);
        StringBuffer decoded = new StringBuffer();
        while (matcher.find()) {
            try {
                int codePoint = Integer.parseInt(matcher.group(1), 16);
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(new String(Character.toChars(codePoint))));
            } catch (Exception ignored) {
                matcher.appendReplacement(decoded, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(decoded);
        return decoded.toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
