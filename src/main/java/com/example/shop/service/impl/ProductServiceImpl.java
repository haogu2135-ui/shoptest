package com.example.shop.service.impl;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.entity.Category;
import com.example.shop.entity.PetProfile;
import com.example.shop.entity.Product;
import com.example.shop.repository.CategoryRepository;
import com.example.shop.repository.PetProfileMapper;
import com.example.shop.repository.ProductRepository;
import com.example.shop.repository.ReviewRepository;
import com.example.shop.service.ProductService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.util.CsvUtils;
import com.example.shop.util.ProductStatusUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.NoTransactionException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PushbackInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ProductServiceImpl implements ProductService {
    private static final int MAX_IMPORT_IMAGE_URL_LENGTH = 2048;
    private static final int MAX_IMPORT_MONEY_SCALE = 2;
    private static final BigDecimal MAX_IMPORT_MONEY_AMOUNT = new BigDecimal("99999999.99");
    private static final int LEGACY_IMPORT_COLUMN_COUNT = 24;
    private static final Set<String> REQUIRED_IMPORT_HEADERS = Set.of("name", "price", "stock", "categoryid");
    private static final Set<String> SUPPORTED_IMPORT_HEADERS = Set.of(
            "id", "name", "description", "price", "stock", "categoryid", "categoryname", "imageurl",
            "isfeatured", "brand", "originalprice", "discount", "limitedtimeprice", "limitedtimestartat",
            "limitedtimeendat", "tag", "images", "specifications", "detailcontent", "warranty",
            "shipping", "status", "freeshipping", "freeshippingthreshold", "variants"
    );
    private static final List<String> FULL_IMPORT_UPDATE_FIELDS = List.of(
            "name", "description", "price", "stock", "categoryId", "imageUrl", "isFeatured",
            "brand", "originalPrice", "discount", "limitedTimePrice", "limitedTimeStartAt",
            "limitedTimeEndAt", "tag", "status", "images", "specifications", "detailContent",
            "variants", "warranty", "shipping", "freeShipping", "freeShippingThreshold"
    );
    private static final Map<String, String> IMPORT_HEADER_UPDATE_FIELDS = Map.ofEntries(
            Map.entry("name", "name"),
            Map.entry("description", "description"),
            Map.entry("price", "price"),
            Map.entry("stock", "stock"),
            Map.entry("categoryid", "categoryId"),
            Map.entry("categoryname", "categoryId"),
            Map.entry("imageurl", "imageUrl"),
            Map.entry("isfeatured", "isFeatured"),
            Map.entry("brand", "brand"),
            Map.entry("originalprice", "originalPrice"),
            Map.entry("discount", "discount"),
            Map.entry("limitedtimeprice", "limitedTimePrice"),
            Map.entry("limitedtimestartat", "limitedTimeStartAt"),
            Map.entry("limitedtimeendat", "limitedTimeEndAt"),
            Map.entry("tag", "tag"),
            Map.entry("status", "status"),
            Map.entry("images", "images"),
            Map.entry("specifications", "specifications"),
            Map.entry("detailcontent", "detailContent"),
            Map.entry("variants", "variants"),
            Map.entry("warranty", "warranty"),
            Map.entry("shipping", "shipping"),
            Map.entry("freeshipping", "freeShipping"),
            Map.entry("freeshippingthreshold", "freeShippingThreshold")
    );
    private static final Map<String, String> IMPORT_HEADER_DISPLAY_NAMES = Map.ofEntries(
            Map.entry("categoryid", "categoryId"),
            Map.entry("categoryname", "categoryName"),
            Map.entry("imageurl", "imageUrl"),
            Map.entry("isfeatured", "isFeatured"),
            Map.entry("originalprice", "originalPrice"),
            Map.entry("limitedtimeprice", "limitedTimePrice"),
            Map.entry("limitedtimestartat", "limitedTimeStartAt"),
            Map.entry("limitedtimeendat", "limitedTimeEndAt"),
            Map.entry("detailcontent", "detailContent"),
            Map.entry("freeshipping", "freeShipping"),
            Map.entry("freeshippingthreshold", "freeShippingThreshold")
    );
    private static final Map<String, String> IMPORT_HEADER_ALIASES = Map.ofEntries(
            Map.entry("title", "name"),
            Map.entry("productname", "name"),
            Map.entry("producttitle", "name"),
            Map.entry("body", "description"),
            Map.entry("bodyhtml", "description"),
            Map.entry("productdescription", "description"),
            Map.entry("saleprice", "price"),
            Map.entry("sellingprice", "price"),
            Map.entry("inventory", "stock"),
            Map.entry("inventoryquantity", "stock"),
            Map.entry("quantity", "stock"),
            Map.entry("qty", "stock"),
            Map.entry("category", "categoryname"),
            Map.entry("categorypath", "categoryname"),
            Map.entry("collection", "categoryname"),
            Map.entry("collectionid", "categoryid"),
            Map.entry("mainimage", "imageurl"),
            Map.entry("image", "imageurl"),
            Map.entry("imageurl", "imageurl"),
            Map.entry("featured", "isfeatured"),
            Map.entry("compareatprice", "originalprice"),
            Map.entry("compareprice", "originalprice"),
            Map.entry("msrp", "originalprice"),
            Map.entry("limitedprice", "limitedtimeprice"),
            Map.entry("limitedstart", "limitedtimestartat"),
            Map.entry("limitedend", "limitedtimeendat"),
            Map.entry("detail", "detailcontent"),
            Map.entry("details", "detailcontent"),
            Map.entry("richdetail", "detailcontent"),
            Map.entry("freeshippingmin", "freeshippingthreshold"),
            Map.entry("shippingthreshold", "freeshippingthreshold"),
            Map.entry("options", "variants")
    );
    private static final Pattern IPV4_HOST_PATTERN = Pattern.compile("^\\d{1,3}(?:\\.\\d{1,3}){3}$");
    private static final Pattern IPV6_HOST_PATTERN = Pattern.compile("^[0-9a-fA-F:]+$");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private PetProfileMapper petProfileMapper;
    @Autowired
    private RuntimeConfigService runtimeConfig;

    private final ConcurrentMap<String, ProductSearchCacheEntry> productSearchCache = new ConcurrentHashMap<>();

    @Override
    public List<Product> findAll() {
        return getCachedProducts("all", () -> enrichReviewStats(productRepository.findAll()));
    }

    @Override
    public List<Product> findPublicProducts() {
        return getCachedProducts("public", () -> enrichReviewStats(productRepository.findAll().stream()
                .filter(this::isPublicCatalogProduct)
                .sorted(Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList())));
    }

    @Override
    public long countProducts() {
        return productRepository.count();
    }

    @Override
    public long countActiveProducts() {
        return productRepository.countActiveProducts();
    }

    @Override
    public long countPendingReviewProducts() {
        return productRepository.countPendingReviewProducts();
    }

    @Override
    public long countLowStockProducts() {
        return productRepository.countLowStockProducts();
    }

    @Override
    public List<Product> findLowStockProducts(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return productRepository.findLowStockProducts(PageRequest.of(0, Math.min(limit, 50)));
    }

    @Override
    public Optional<Product> findById(Long id) {
        return productRepository.findById(id).map(this::enrichReviewStats);
    }

    @Override
    public Optional<Product> findPublicById(Long id) {
        return findById(id).filter(this::isPublicCatalogProduct);
    }

    @Override
    public List<Product> findByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Long> normalizedIds = ids.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .limit(40)
                .collect(Collectors.toList());
        if (normalizedIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Product> productById = enrichReviewStats(productRepository.findAllById(normalizedIds)).stream()
                .collect(Collectors.toMap(Product::getId, product -> product, (left, right) -> left));
        return normalizedIds.stream()
                .map(productById::get)
                .filter(product -> product != null)
                .collect(Collectors.toList());
    }

    @Override
    public List<Product> findPublicByIds(List<Long> ids) {
        return findByIds(ids).stream()
                .filter(this::isPublicCatalogProduct)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Product save(Product product) {
        validateDirectProduct(product);
        Product saved = productRepository.save(product);
        clearProductSearchCache();
        return saved;
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        productRepository.deleteById(id);
        clearProductSearchCache();
    }

    @Override
    public List<Product> findByIsFeaturedTrueOrderByIdAsc() {
        return enrichReviewStats(productRepository.findByIsFeaturedTrueOrderByIdAsc());
    }

    @Override
    public List<Product> findPublicFeaturedProducts() {
        return getCachedProducts("featured:public", () -> enrichReviewStats(productRepository.findByIsFeaturedTrueOrderByIdAsc().stream()
                .filter(this::isPublicCatalogProduct)
                .sorted(Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList())));
    }

    @Override
    public List<Product> findDiscountProducts() {
        return getCachedProducts("discount", () -> enrichReviewStats(productRepository.findAll().stream()
                .filter(ProductStatusUtils::isPublicProduct)
                .filter(this::isPublicCatalogProduct)
                .sorted(Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .filter(product -> {
                    if (product.getDiscount() != null && product.getDiscount() > 0) {
                        return true;
                    }
                    return product.isActiveLimitedTimeDiscount();
                })
                .collect(Collectors.toList())));
    }

    @Override
    public List<Product> findAddOnCandidates(BigDecimal targetAmount, List<Long> excludedProductIds, int limit) {
        BigDecimal normalizedTarget = targetAmount == null ? BigDecimal.ZERO : targetAmount.max(BigDecimal.ZERO);
        int normalizedLimit = Math.max(1, Math.min(limit <= 0 ? 3 : limit, 8));
        Set<Long> excludedIds = excludedProductIds == null
                ? Set.of()
                : excludedProductIds.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        String excludedKey = excludedIds.stream()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        String targetKey = normalizedTarget.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
        String cacheKey = "add-on:" + targetKey + ":" + normalizedLimit + ":" + excludedKey;
        return getCachedProducts(cacheKey, () -> findAddOnCandidatesUncached(normalizedTarget, excludedIds, normalizedLimit));
    }

    private List<Product> findAddOnCandidatesUncached(BigDecimal normalizedTarget, Set<Long> excludedIds, int normalizedLimit) {
        BigDecimal floor = normalizedTarget.multiply(safePositiveRatio(
                runtimeConfig.getBigDecimal("product.add-on-price-floor-ratio", BigDecimal.valueOf(0.45)),
                BigDecimal.valueOf(0.45)));
        BigDecimal ceiling = normalizedTarget
                .multiply(safePositiveRatio(
                        runtimeConfig.getBigDecimal("product.add-on-price-ceiling-ratio", BigDecimal.valueOf(1.35)),
                        BigDecimal.valueOf(1.35)))
                .max(safePositiveAmount(
                        runtimeConfig.getBigDecimal("product.add-on-price-ceiling", BigDecimal.valueOf(260)),
                        BigDecimal.valueOf(260)));

        return enrichReviewStats(productRepository.findAll().stream()
                .filter(product -> !excludedIds.contains(product.getId()))
                .filter(this::isReadyAddOnCandidate)
                .map(product -> new ProductAddOnCandidate(product, scoreAddOnCandidate(product, normalizedTarget, floor, ceiling)))
                .filter(candidate -> candidate.score > Integer.MIN_VALUE)
                .sorted(Comparator
                        .comparingInt((ProductAddOnCandidate candidate) -> candidate.score).reversed()
                        .thenComparing(candidate -> effectivePrice(candidate.product)))
                .limit(normalizedLimit)
                .map(candidate -> candidate.product)
                .collect(Collectors.toList()));
    }

    @Override
    public List<Product> search(String keyword, Long categoryId) {
        String normalizedKeyword = normalizeSearchText(keyword);
        String cacheKey = "search:" + (categoryId == null ? "all" : categoryId) + ":" + normalizedKeyword;
        return getCachedProducts(cacheKey, () -> searchUncached(normalizedKeyword, categoryId));
    }

    private List<Product> searchUncached(String normalizedKeyword, Long categoryId) {
        List<Product> candidates;
        if (categoryId != null) {
            candidates = productRepository.findByCategoryIdIn(collectCategoryIds(categoryId));
        } else {
            candidates = productRepository.findAll();
        }
        if (normalizedKeyword.isEmpty()) {
            return enrichReviewStats(candidates.stream()
                    .filter(this::isPublicCatalogProduct)
                    .collect(Collectors.toList()));
        }
        Map<Long, Category> categoryLookup = categoryRepository.findAll().stream()
                .collect(Collectors.toMap(Category::getId, category -> category, (left, right) -> left));
        return enrichReviewStats(candidates.stream()
                .filter(ProductStatusUtils::isPublicProduct)
                .filter(this::isPublicCatalogProduct)
                .filter(product -> matchesNormalizedKeyword(product, normalizedKeyword, categoryLookup))
                .collect(Collectors.toList()));
    }

    public List<Product> findRelatedProducts(Long productId, Long categoryId) {
        if (productId == null || categoryId == null) {
            return List.of();
        }
        String cacheKey = "related:" + productId + ":" + categoryId;
        return getCachedProducts(cacheKey, () -> enrichReviewStats(productRepository
                .findActiveByCategoryId(categoryId, PageRequest.of(0, 14))
                .stream()
                .filter(product -> !productId.equals(product.getId()))
                .filter(this::isPublicCatalogProduct)
                .filter(this::hasSellableStock)
                .limit(8)
                .collect(Collectors.toList())));
    }

    @Override
    public List<Product> findPersonalizedRecommendations(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return getCachedProducts("personalized:" + userId, () -> findPersonalizedRecommendationsUncached(userId));
    }

    @Override
    public void clearPersonalizedRecommendationCache(Long userId) {
        if (userId == null) {
            return;
        }
        productSearchCache.remove("personalized:" + userId);
    }

    private List<Product> findPersonalizedRecommendationsUncached(Long userId) {
        List<PetProfile> pets = petProfileMapper.findByUserId(userId);
        if (pets == null || pets.isEmpty()) {
            return List.of();
        }
        Map<Long, Category> categories = categoryRepository.findAll().stream()
                .collect(Collectors.toMap(Category::getId, category -> category));
        List<Product> products = productRepository.findAll().stream()
                .filter(this::isPublicCatalogProduct)
                .filter(product -> product.getStock() == null || product.getStock() > 0)
                .collect(Collectors.toList());

        return enrichReviewStats(products.stream()
                .map(product -> new ProductScore(product, scoreForPets(product, categories, pets)))
                .filter(entry -> entry.score > 0)
                .sorted(Comparator
                        .comparingInt((ProductScore entry) -> entry.score).reversed()
                        .thenComparingInt(entry -> personalizedRecommendationPriority(entry.product))
                        .thenComparing(entry -> entry.product.getReviewCount() == null ? 0L : entry.product.getReviewCount(), Comparator.reverseOrder())
                        .thenComparing(entry -> entry.product.getId()))
                .limit(12)
                .map(entry -> entry.product)
                .collect(Collectors.toList()));
    }

    @Override
    public ProductImportResult previewImportCsv(MultipartFile file) {
        return processCsvImport(file, true);
    }

    @Override
    @Transactional
    public ProductImportResult importCsv(MultipartFile file) {
        return processCsvImport(file, false);
    }

    private ProductImportResult processCsvImport(MultipartFile file, boolean preview) {
        ProductImportResult result = new ProductImportResult();
        result.setImportId(UUID.randomUUID().toString());
        result.setPreview(preview);
        result.setMaxRows(normalizedImportMaxRows());
        result.setMaxFileSizeBytes(normalizedImportMaxFileSizeBytes());
        populateImportFileMetadata(file, result);
        if (!validateImportFile(file, result)) {
            result.setStatus(importStatus(preview, result));
            return result;
        }
        populateImportFileFingerprint(file, result);
        Set<Long> importedIds = new HashSet<>();
        Set<String> importedTargetIdentities = new HashSet<>();
        Set<String> importedVariantSkus = new HashSet<>();
        ImportCategoryLookup categoryLookup = loadImportCategoryLookup();
        Map<String, Set<Long>> existingVariantSkuOwners = null;
        List<ProductImportRow> importRows = new ArrayList<>();
        try (BufferedReader reader = importCsvReader(file)) {
            List<CsvUtils.Record> records = CsvUtils.parseRecords(reader);
            Map<String, Integer> headerIndex = null;
            int headerColumnCount = 0;
            for (int i = 0; i < records.size(); i++) {
                CsvUtils.Record record = records.get(i);
                List<String> values = new ArrayList<>(record.getValues());
                int rowNumber = record.getLineNumber();
                if (i == 0 && !values.isEmpty()) {
                    values.set(0, values.get(0).replace("\uFEFF", ""));
                }
                if (i == 0 && isProductImportHeader(values)) {
                    headerIndex = productImportHeaderIndex(values);
                    headerColumnCount = values.size();
                    List<String> duplicateHeaders = duplicateImportHeaders(values);
                    if (!duplicateHeaders.isEmpty()) {
                        result.addError(
                                rowNumber,
                                duplicateHeaders.size() == 1 ? duplicateHeaders.get(0) : null,
                                "CSV header contains duplicate import columns: " + String.join(", ", duplicateHeaders)
                        );
                        break;
                    }
                    List<String> unsupportedHeaders = unsupportedImportHeaders(values);
                    if (!unsupportedHeaders.isEmpty()) {
                        result.addError(
                                rowNumber,
                                null,
                                "CSV header contains unsupported import columns: " + String.join(", ", unsupportedHeaders)
                                        + ". Remove or rename unsupported columns before import."
                        );
                        break;
                    }
                    List<String> missingHeaders = missingRequiredImportHeaders(headerIndex);
                    if (!missingHeaders.isEmpty()) {
                        result.addError(rowNumber, "CSV header missing required columns: " + String.join(", ", missingHeaders));
                        break;
                    }
                    populateImportUpdateFields(result, importUpdateFields(headerIndex));
                    continue;
                }
                if (values.stream().allMatch(value -> value == null || value.trim().isEmpty())) {
                    continue;
                }
                if (result.getTotalRows() >= normalizedImportMaxRows()) {
                    result.addError(rowNumber, "CSV row limit exceeded. Maximum rows: " + normalizedImportMaxRows());
                    break;
                }

                result.setTotalRows(result.getTotalRows() + 1);
                try {
                    validateImportRowColumnCount(values, headerIndex, headerColumnCount);
                    Product product = toProduct(values, headerIndex, categoryLookup);
                    Set<String> updateFields = importUpdateFields(headerIndex);
                    populateImportUpdateFields(result, updateFields);
                    Product existingProduct = null;
                    if (product.getId() != null) {
                        requirePositive(product.getId(), "id");
                        Optional<Product> existing = productRepository.findById(product.getId());
                        if (existing.isPresent()) {
                            existingProduct = existing.get();
                        } else {
                            throw new IllegalArgumentException("id does not exist: " + product.getId() + ". Leave id blank to create a new product.");
                        }
                    }
                    validateImportedProduct(product, importedIds, categoryLookup, updateFields, existingProduct != null);
                    validateImportTargetIdentity(existingProduct, product, importedTargetIdentities, updateFields);
                    validateImportVariantSkusAcrossFile(product.getVariants(), importedVariantSkus);
                    if (importHasVariantSku(product.getVariants()) && existingVariantSkuOwners == null) {
                        existingVariantSkuOwners = loadExistingVariantSkuOwners();
                    }
                    validateImportVariantSkusAgainstExisting(product.getVariants(), existingVariantSkuOwners, existingProduct == null ? null : existingProduct.getId());
                    validateMergedImportUpdate(existingProduct, product, updateFields);
                    validateImportProductNameDoesNotDuplicateExisting(existingProduct, product, updateFields);
                    if (existingProduct != null) {
                        result.setUpdated(result.getUpdated() + 1);
                    } else {
                        result.setCreated(result.getCreated() + 1);
                    }
                    importRows.add(new ProductImportRow(product, existingProduct, updateFields));
                } catch (Exception ex) {
                    result.addError(rowNumber, importFieldFromException(ex), ex.getMessage());
                }
            }
        } catch (Exception ex) {
            result.addError(0, "Failed to read CSV: " + ex.getMessage());
        }
        if (result.getFailed() == 0 && result.getTotalRows() == 0) {
            result.addError(0, "CSV file does not contain any product rows");
        }
        result.setReadyToImport(result.getFailed() == 0 && result.getTotalRows() > 0);
        if (!preview && result.isReadyToImport()) {
            try {
                importRows.forEach(this::saveImportRow);
                result.setApplied(true);
                clearProductSearchCache();
            } catch (RuntimeException ex) {
                markCurrentTransactionRollbackOnly();
                result.setApplied(false);
                result.setReadyToImport(false);
                result.addError(0, "Failed to write product import: " + safeImportExceptionMessage(ex));
            }
        }
        result.setStatus(importStatus(preview, result));
        return result;
    }

    private BufferedReader importCsvReader(MultipartFile file) throws IOException {
        PushbackInputStream input = new PushbackInputStream(file.getInputStream(), 3);
        byte[] bom = new byte[3];
        int bytesRead = input.read(bom);
        int skip = 0;
        Charset charset = StandardCharsets.UTF_8;
        if (bytesRead >= 3
                && (bom[0] & 0xFF) == 0xEF
                && (bom[1] & 0xFF) == 0xBB
                && (bom[2] & 0xFF) == 0xBF) {
            skip = 3;
        } else if (bytesRead >= 2
                && (bom[0] & 0xFF) == 0xFF
                && (bom[1] & 0xFF) == 0xFE) {
            charset = StandardCharsets.UTF_16LE;
            skip = 2;
        } else if (bytesRead >= 2
                && (bom[0] & 0xFF) == 0xFE
                && (bom[1] & 0xFF) == 0xFF) {
            charset = StandardCharsets.UTF_16BE;
            skip = 2;
        }
        if (bytesRead > skip) {
            input.unread(bom, skip, bytesRead - skip);
        }
        return new BufferedReader(new InputStreamReader(input, charset));
    }

    private void validateImportRowColumnCount(List<String> values, Map<String, Integer> headerIndex, int headerColumnCount) {
        int expectedColumns = headerIndex == null ? LEGACY_IMPORT_COLUMN_COUNT : headerColumnCount;
        if (values == null || values.size() <= expectedColumns) {
            return;
        }
        boolean extraData = values.subList(expectedColumns, values.size()).stream()
                .anyMatch(value -> value != null && !value.trim().isEmpty());
        if (extraData) {
            if (headerIndex == null) {
                throw new IllegalArgumentException("CSV row contains unsupported extra columns after the legacy import fields");
            }
            throw new IllegalArgumentException("CSV row contains values beyond the header columns. Remove extra cells or add supported headers before import.");
        }
    }

    private void markCurrentTransactionRollbackOnly() {
        try {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } catch (NoTransactionException ignored) {
            // Unit tests may exercise the importer without a Spring transaction.
        }
    }

    private String safeImportExceptionMessage(RuntimeException ex) {
        String message = ex == null ? null : ex.getMessage();
        return message == null || message.isBlank() ? "database write failed" : normalizeImportText(message);
    }

    private String importStatus(boolean preview, ProductImportResult result) {
        if (preview) {
            return result.isReadyToImport()
                    ? ProductImportResult.STATUS_PREVIEW_READY
                    : ProductImportResult.STATUS_PREVIEW_BLOCKED;
        }
        return result.isApplied()
                ? ProductImportResult.STATUS_APPLIED
                : ProductImportResult.STATUS_REJECTED;
    }

    private void populateImportFileFingerprint(MultipartFile file, ProductImportResult result) {
        if (file == null || file.isEmpty()) {
            return;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(file.getBytes());
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                hex.append(String.format("%02x", value));
            }
            result.setFileSha256(hex.toString());
        } catch (Exception ex) {
            result.addError(0, "Failed to fingerprint CSV file");
        }
    }

    private void populateImportFileMetadata(MultipartFile file, ProductImportResult result) {
        if (file == null || result == null) {
            return;
        }
        result.setFilename(safeImportFilename(file.getOriginalFilename()));
        result.setSizeBytes(Math.max(0L, file.getSize()));
    }

    private String safeImportFilename(String filename) {
        String normalized = normalizeImportText(filename);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        String portable = normalized.replace('\\', '/');
        int slashIndex = portable.lastIndexOf('/');
        return slashIndex >= 0 ? portable.substring(slashIndex + 1) : portable;
    }

    private boolean isProductImportHeader(List<String> values) {
        List<String> normalizedHeaders = values.stream()
                .map(this::normalizeImportHeader)
                .filter(header -> !header.isBlank())
                .collect(Collectors.toList());
        Set<String> headers = values.stream()
                .map(this::normalizeImportHeader)
                .filter(header -> !header.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (headers.containsAll(REQUIRED_IMPORT_HEADERS)) {
            return true;
        }
        long knownHeaders = headers.stream()
                .filter(SUPPORTED_IMPORT_HEADERS::contains)
                .count();
        if (headers.contains("id") && (knownHeaders >= 2 || normalizedHeaders.get(0).equals("id"))) {
            return true;
        }
        return knownHeaders >= 3;
    }

    private Map<String, Integer> productImportHeaderIndex(List<String> values) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < values.size(); i++) {
            String header = normalizeImportHeader(values.get(i));
            if (!header.isEmpty()) {
                index.put(header, i);
            }
        }
        return index;
    }

    private List<String> duplicateImportHeaders(List<String> values) {
        Set<String> seen = new HashSet<>();
        Set<String> duplicates = new LinkedHashSet<>();
        for (String value : values) {
            String header = normalizeImportHeader(value);
            if (header.isEmpty() || !SUPPORTED_IMPORT_HEADERS.contains(header)) {
                continue;
            }
            if (!seen.add(header)) {
                duplicates.add(displayImportHeader(header));
            }
        }
        return new ArrayList<>(duplicates);
    }

    private List<String> unsupportedImportHeaders(List<String> values) {
        Set<String> unsupported = new LinkedHashSet<>();
        for (String value : values) {
            String header = normalizeImportHeader(value);
            if (header.isEmpty() || SUPPORTED_IMPORT_HEADERS.contains(header)) {
                continue;
            }
            String rawHeader = value == null ? "" : value.trim().replace("\uFEFF", "");
            unsupported.add(rawHeader.isBlank() ? header : rawHeader);
        }
        return new ArrayList<>(unsupported);
    }

    private String normalizeImportHeader(String header) {
        if (header == null) {
            return "";
        }
        String normalized = header.trim().replace("\uFEFF", "").toLowerCase(Locale.ROOT);
        String compact = normalized.replaceAll("[^a-z0-9]", "");
        if (compact.isBlank()) {
            return "";
        }
        return IMPORT_HEADER_ALIASES.getOrDefault(compact, compact);
    }

    private List<String> missingRequiredImportHeaders(Map<String, Integer> headerIndex) {
        if (headerIndex.containsKey("id")) {
            if (importUpdateFields(headerIndex).isEmpty()) {
                return List.of("at least one editable column besides id");
            }
            return List.of();
        }
        List<String> missingHeaders = REQUIRED_IMPORT_HEADERS.stream()
                .filter(header -> !"categoryid".equals(header))
                .filter(header -> !headerIndex.containsKey(header))
                .map(this::displayImportHeader)
                .collect(Collectors.toCollection(ArrayList::new));
        if (!headerIndex.containsKey("categoryid") && !headerIndex.containsKey("categoryname")) {
            missingHeaders.add("categoryId or categoryName");
        }
        return missingHeaders;
    }

    private String displayImportHeader(String normalizedHeader) {
        return IMPORT_HEADER_DISPLAY_NAMES.getOrDefault(normalizedHeader, normalizedHeader);
    }

    private void saveImportRow(ProductImportRow row) {
        if (row.existingProduct != null) {
            mergeForImport(row.existingProduct, row.importedProduct, row.updateFields);
            productRepository.save(row.existingProduct);
            return;
        }
        row.importedProduct.setId(null);
        productRepository.save(row.importedProduct);
    }

    private Set<String> importUpdateFields(Map<String, Integer> headerIndex) {
        if (headerIndex == null) {
            return new LinkedHashSet<>(FULL_IMPORT_UPDATE_FIELDS);
        }
        return headerIndex.keySet().stream()
                .map(IMPORT_HEADER_UPDATE_FIELDS::get)
                .filter(field -> field != null && !field.equals("id"))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void populateImportUpdateFields(ProductImportResult result, Set<String> updateFields) {
        if (result == null || result.getUpdateFields() == null || !result.getUpdateFields().isEmpty()) {
            return;
        }
        result.setUpdateFields(FULL_IMPORT_UPDATE_FIELDS.stream()
                .filter(updateFields::contains)
                .collect(Collectors.toList()));
    }

    private boolean validateImportFile(MultipartFile file, ProductImportResult result) {
        if (file == null || file.isEmpty()) {
            result.addError(0, "CSV file is required");
            return false;
        }
        long maxBytes = normalizedImportMaxFileSizeBytes();
        if (file.getSize() > maxBytes) {
            result.addError(0, "CSV file is too large. Maximum size: " + maxBytes + " bytes");
            return false;
        }
        String filename = String.valueOf(file.getOriginalFilename() == null ? "" : file.getOriginalFilename()).trim().toLowerCase(Locale.ROOT);
        if (!filename.endsWith(".csv")) {
            result.addError(0, "Only .csv product imports are supported");
            return false;
        }
        return true;
    }

    private int normalizedImportMaxRows() {
        return Math.max(1, runtimeConfig.getInt("product.import.max-rows", 1000));
    }

    private long normalizedImportMaxFileSizeBytes() {
        return Math.max(1024L, runtimeConfig.getLong("product.import.max-file-size-bytes", 1048576));
    }

    private Product toProduct(List<String> values) {
        return toProduct(values, null, ImportCategoryLookup.empty());
    }

    private Product toProduct(List<String> values, Map<String, Integer> headerIndex, ImportCategoryLookup categoryLookup) {
        if (headerIndex == null && values.size() < 6) {
            throw new IllegalArgumentException("Expected at least 6 columns: id,name,description,price,stock,categoryId");
        }

        Product product = new Product();
        product.setId(parseLong(importValue(values, headerIndex, "id", 0), false, "id"));
        product.setName(headerRequired(headerIndex, "name")
                ? required(importValue(values, headerIndex, "name", 1), "name")
                : importValue(values, headerIndex, "name", 1));
        product.setDescription(importValue(values, headerIndex, "description", 2));
        product.setPrice(parseDecimal(importValue(values, headerIndex, "price", 3), headerRequired(headerIndex, "price"), "price"));
        product.setStock(parseInteger(importValue(values, headerIndex, "stock", 4), headerRequired(headerIndex, "stock"), "stock"));
        product.setCategoryId(resolveImportCategoryId(
                importValue(values, headerIndex, "categoryId", 5),
                importValue(values, headerIndex, "categoryName", -1),
                categoryLookup,
                categoryRequired(headerIndex)));
        product.setImageUrl(importValue(values, headerIndex, "imageUrl", 6));
        product.setIsFeatured(parseBoolean(importValue(values, headerIndex, "isFeatured", 7), "isFeatured"));
        product.setBrand(importValue(values, headerIndex, "brand", 8));
        product.setOriginalPrice(parseDecimal(importValue(values, headerIndex, "originalPrice", 9), false, "originalPrice"));
        product.setDiscount(parseInteger(importValue(values, headerIndex, "discount", 10), false, "discount"));
        product.setLimitedTimePrice(parseDecimal(importValue(values, headerIndex, "limitedTimePrice", 11), false, "limitedTimePrice"));
        product.setLimitedTimeStartAt(parseDateTime(importValue(values, headerIndex, "limitedTimeStartAt", 12), "limitedTimeStartAt"));
        product.setLimitedTimeEndAt(parseDateTime(importValue(values, headerIndex, "limitedTimeEndAt", 13), "limitedTimeEndAt"));
        product.setTag(importValue(values, headerIndex, "tag", 14));
        boolean hasDetailContentColumn = headerIndex != null ? headerIndex.containsKey("detailcontent") : values.size() > 20;
        String status = importValue(values, headerIndex, "status", hasDetailContentColumn ? 20 : 19);
        product.setStatus(normalizeImportedStatus(status));
        product.setImages(importValue(values, headerIndex, "images", 15));
        product.setSpecifications(importValue(values, headerIndex, "specifications", 16));
        product.setDetailContent(headerIndex != null || hasDetailContentColumn ? importValue(values, headerIndex, "detailContent", 17) : null);
        product.setWarranty(importValue(values, headerIndex, "warranty", hasDetailContentColumn ? 18 : 17));
        product.setShipping(importValue(values, headerIndex, "shipping", hasDetailContentColumn ? 19 : 18));
        product.setFreeShipping(parseBoolean(importValue(values, headerIndex, "freeShipping", hasDetailContentColumn ? 21 : 20), "freeShipping"));
        product.setFreeShippingThreshold(parseDecimal(importValue(values, headerIndex, "freeShippingThreshold", hasDetailContentColumn ? 22 : 21), false, "freeShippingThreshold"));
        product.setVariants(importValue(values, headerIndex, "variants", hasDetailContentColumn ? 23 : 22));
        return product;
    }

    private String importValue(List<String> values, Map<String, Integer> headerIndex, String field, int fallbackIndex) {
        if (headerIndex != null) {
            Integer index = headerIndex.get(field.toLowerCase(Locale.ROOT));
            return index == null ? null : value(values, index);
        }
        return value(values, fallbackIndex);
    }

    private boolean headerRequired(Map<String, Integer> headerIndex, String field) {
        return headerIndex == null || headerIndex.containsKey(field.toLowerCase(Locale.ROOT));
    }

    private boolean categoryRequired(Map<String, Integer> headerIndex) {
        return headerIndex == null || headerIndex.containsKey("categoryid") || headerIndex.containsKey("categoryname");
    }

    private ImportCategoryLookup loadImportCategoryLookup() {
        if (categoryRepository == null) {
            return ImportCategoryLookup.empty();
        }
        List<Category> categories = categoryRepository.findAll();
        Set<Long> ids = categories.stream()
                .map(Category::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Category> byId = categories.stream()
                .filter(category -> category.getId() != null)
                .collect(Collectors.toMap(Category::getId, category -> category, (left, right) -> left));
        Map<String, Long> names = new LinkedHashMap<>();
        Map<Long, Set<String>> namesById = new LinkedHashMap<>();
        Set<String> ambiguousNames = new HashSet<>();
        for (Category category : categories) {
            if (category.getId() == null || category.getId() <= 0) {
                continue;
            }
            registerImportCategoryName(names, ambiguousNames, namesById, category.getName(), category.getId());
            registerImportCategoryName(names, ambiguousNames, namesById, importCategoryPath(category, byId), category.getId());
        }
        return new ImportCategoryLookup(ids, names, namesById, ambiguousNames, true);
    }

    private void registerImportCategoryName(Map<String, Long> names, Set<String> ambiguousNames, Map<Long, Set<String>> namesById, String value, Long id) {
        String key = normalizeImportCategoryName(value);
        if (key.isBlank()) {
            return;
        }
        namesById.computeIfAbsent(id, ignored -> new LinkedHashSet<>()).add(key);
        Long existing = names.get(key);
        if (existing != null && !existing.equals(id)) {
            ambiguousNames.add(key);
            names.remove(key);
            return;
        }
        if (!ambiguousNames.contains(key)) {
            names.put(key, id);
        }
    }

    private String importCategoryPath(Category category, Map<Long, Category> byId) {
        LinkedList<String> parts = new LinkedList<>();
        Set<Long> visited = new HashSet<>();
        Category current = category;
        while (current != null && current.getId() != null && visited.add(current.getId())) {
            if (current.getName() != null && !current.getName().isBlank()) {
                parts.addFirst(current.getName());
            }
            current = current.getParentId() == null ? null : byId.get(current.getParentId());
        }
        return String.join(" > ", parts);
    }

    private Long resolveImportCategoryId(String rawCategoryId, String rawCategoryName, ImportCategoryLookup categoryLookup, boolean required) {
        Long categoryId = parseLong(rawCategoryId, false, "categoryId");
        String categoryName = normalizeImportText(rawCategoryName);
        if (categoryId != null) {
            validateImportCategoryNameMatchesId(categoryId, categoryName, categoryLookup);
            return categoryId;
        }
        if (categoryName == null || categoryName.isBlank()) {
            if (!required) {
                return null;
            }
            throw new IllegalArgumentException("categoryId or categoryName is required");
        }
        return resolveImportCategoryName(categoryName, categoryLookup);
    }

    private void validateImportCategoryNameMatchesId(Long categoryId, String categoryName, ImportCategoryLookup categoryLookup) {
        if (categoryId == null || categoryName == null || categoryName.isBlank() || categoryLookup == null) {
            return;
        }
        String key = normalizeImportCategoryName(categoryName);
        Set<String> knownNames = categoryLookup.namesById.getOrDefault(categoryId, Set.of());
        if (knownNames.contains(key)) {
            return;
        }
        Long resolvedId = resolveImportCategoryName(categoryName, categoryLookup);
        if (!categoryId.equals(resolvedId)) {
            throw new IllegalArgumentException("categoryName does not match categoryId: " + categoryName);
        }
    }

    private Long resolveImportCategoryName(String categoryName, ImportCategoryLookup categoryLookup) {
        String key = normalizeImportCategoryName(categoryName);
        if (categoryLookup.ambiguousNames.contains(key)) {
            throw new IllegalArgumentException("categoryName matches multiple categories: " + categoryName);
        }
        Long resolvedId = categoryLookup.names.get(key);
        if (resolvedId == null) {
            throw new IllegalArgumentException("categoryName does not exist: " + categoryName);
        }
        return resolvedId;
    }

    private String normalizeImportCategoryName(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
                .replace('\\', '>')
                .replace('/', '>')
                .replaceAll("\\s*>\\s*", ">")
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }

    private void validateImportedProduct(Product product, Set<Long> importedIds, ImportCategoryLookup categoryLookup, Set<String> updateFields, boolean existingProduct) {
        if (product.getId() != null) {
            requirePositive(product.getId(), "id");
            if (!importedIds.add(product.getId())) {
                throw new IllegalArgumentException("id appears more than once in this file");
            }
        }
        boolean newProduct = !existingProduct;
        if (newProduct || updateFields.contains("name")) {
            required(product.getName(), "name");
        }
        if (newProduct || updateFields.contains("price")) {
            requirePresent(product.getPrice(), "price");
        }
        if (newProduct || updateFields.contains("stock")) {
            requirePresent(product.getStock(), "stock");
        }
        if (newProduct || updateFields.contains("categoryId")) {
            requirePresent(product.getCategoryId(), "categoryId");
        }
        requireLength(product.getName(), 180, "name");
        requireLength(product.getDescription(), 2000, "description");
        requireLength(product.getBrand(), 120, "brand");
        requireLength(product.getTag(), 80, "tag");
        requireLength(product.getWarranty(), 500, "warranty");
        requireLength(product.getShipping(), 500, "shipping");
        requireNonNegative(product.getPrice(), "price");
        requireNonNegative(product.getOriginalPrice(), "originalPrice");
        requireNonNegative(product.getLimitedTimePrice(), "limitedTimePrice");
        requireNonNegative(product.getFreeShippingThreshold(), "freeShippingThreshold");
        if (product.getOriginalPrice() != null && product.getPrice() != null
                && product.getOriginalPrice().compareTo(product.getPrice()) < 0) {
            throw new IllegalArgumentException("originalPrice must be greater than or equal to price");
        }
        validateLimitedTimePrice(product.getPrice(), product.getLimitedTimePrice());
        if (product.getStock() != null && product.getStock() < 0) {
            throw new IllegalArgumentException("stock must be greater than or equal to 0");
        }
        if (product.getDiscount() != null && (product.getDiscount() < 0 || product.getDiscount() > 100)) {
            throw new IllegalArgumentException("discount must be between 0 and 100");
        }
        if (product.getLimitedTimeStartAt() != null && product.getLimitedTimeEndAt() != null
                && !product.getLimitedTimeEndAt().isAfter(product.getLimitedTimeStartAt())) {
            throw new IllegalArgumentException("limitedTimeEndAt must be after limitedTimeStartAt");
        }
        if (product.getCategoryId() != null && product.getCategoryId() <= 0) {
            throw new IllegalArgumentException("categoryId must be a positive category id");
        }
        if (product.getCategoryId() != null
                && categoryLookup != null
                && categoryLookup.validateIds
                && !categoryLookup.ids.contains(product.getCategoryId())) {
            throw new IllegalArgumentException("categoryId does not exist: " + product.getCategoryId());
        }
        validateImportImageUrl(product.getImageUrl(), "imageUrl");
        validateImportImageList(product.getImages());
        validateImportSpecifications(product.getSpecifications());
        validateImportDetailContent(product.getDetailContent());
        validateImportVariants(product.getVariants());
    }

    private void validateImportTargetIdentity(Product existing, Product imported, Set<String> importedTargetIdentities, Set<String> updateFields) {
        if (imported == null) {
            return;
        }
        String name = existing != null && !updateFields.contains("name") ? existing.getName() : imported.getName();
        Long categoryId = existing != null && !updateFields.contains("categoryId") ? existing.getCategoryId() : imported.getCategoryId();
        if (name == null || categoryId == null) {
            return;
        }
        String identity = categoryId + ":" + normalizeImportProductNameKey(name);
        if (!importedTargetIdentities.add(identity)) {
            throw new IllegalArgumentException("name appears more than once for this category after applying this file");
        }
    }

    private String normalizeImportProductNameKey(String value) {
        return normalizeImportText(value).toLowerCase(Locale.ROOT);
    }

    private void validateMergedImportUpdate(Product existing, Product imported, Set<String> updateFields) {
        if (existing == null) {
            return;
        }
        String name = updateFields.contains("name") ? imported.getName() : existing.getName();
        BigDecimal price = updateFields.contains("price") ? imported.getPrice() : existing.getPrice();
        Integer stock = updateFields.contains("stock") ? imported.getStock() : existing.getStock();
        Long categoryId = updateFields.contains("categoryId") ? imported.getCategoryId() : existing.getCategoryId();
        required(name, "name");
        requirePresent(price, "price");
        requirePresent(stock, "stock");
        requirePresent(categoryId, "categoryId");
        if (updateFields.contains("price") || updateFields.contains("originalPrice")) {
            BigDecimal originalPrice = updateFields.contains("originalPrice")
                    ? imported.getOriginalPrice()
                    : existing.getOriginalPrice();
            if (originalPrice != null && price != null && originalPrice.compareTo(price) < 0) {
                throw new IllegalArgumentException("originalPrice must be greater than or equal to price");
            }
        }
        if (updateFields.contains("price") || updateFields.contains("limitedTimePrice")) {
            BigDecimal limitedTimePrice = updateFields.contains("limitedTimePrice")
                    ? imported.getLimitedTimePrice()
                    : existing.getLimitedTimePrice();
            validateLimitedTimePrice(price, limitedTimePrice);
        }
        if (updateFields.contains("limitedTimeStartAt") || updateFields.contains("limitedTimeEndAt")) {
            LocalDateTime start = updateFields.contains("limitedTimeStartAt")
                    ? imported.getLimitedTimeStartAt()
                    : existing.getLimitedTimeStartAt();
            LocalDateTime end = updateFields.contains("limitedTimeEndAt")
                    ? imported.getLimitedTimeEndAt()
                    : existing.getLimitedTimeEndAt();
            if (start != null && end != null && !end.isAfter(start)) {
                throw new IllegalArgumentException("limitedTimeEndAt must be after limitedTimeStartAt");
            }
        }
    }

    private void validateImportProductNameDoesNotDuplicateExisting(Product existing, Product imported, Set<String> updateFields) {
        String name = existing != null && !updateFields.contains("name") ? existing.getName() : imported.getName();
        Long categoryId = existing != null && !updateFields.contains("categoryId") ? existing.getCategoryId() : imported.getCategoryId();
        if (name == null || name.isBlank() || categoryId == null || productRepository == null) {
            return;
        }
        String nameKey = normalizeImportProductNameKey(name);
        Long currentId = existing == null ? null : existing.getId();
        List<Product> matches = productRepository.findByCategoryId(categoryId);
        if (matches == null || matches.isEmpty()) {
            return;
        }
        for (Product match : matches) {
            if (match == null || match.getId() == null) {
                continue;
            }
            if (currentId != null && currentId.equals(match.getId())) {
                continue;
            }
            String matchName = normalizeImportProductNameKey(match.getName());
            if (nameKey.equals(matchName)) {
                throw new IllegalArgumentException("name already exists in this category: " + name);
            }
        }
    }

    private void validateDirectProduct(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Product payload is required");
        }
        product.setName(normalizeDirectText(product.getName(), "name", 180, true));
        product.setDescription(normalizeDirectText(product.getDescription(), "description", 1000, false));
        product.setBrand(normalizeDirectText(product.getBrand(), "brand", 120, false));
        product.setTag(normalizeDirectText(product.getTag(), "tag", 80, false));
        product.setWarranty(normalizeDirectText(product.getWarranty(), "warranty", 1000, false));
        product.setShipping(normalizeDirectText(product.getShipping(), "shipping", 1000, false));
        product.setStatus(normalizeImportedStatus(product.getStatus()));
        requirePresent(product.getPrice(), "price");
        requirePresent(product.getStock(), "stock");
        requirePresent(product.getCategoryId(), "categoryId");
        requirePositive(product.getCategoryId(), "categoryId");
        requireNonNegative(product.getPrice(), "price");
        validateImportMoneyAmount(product.getPrice(), "price");
        validateImportMoneyAmount(product.getOriginalPrice(), "originalPrice");
        validateImportMoneyAmount(product.getLimitedTimePrice(), "limitedTimePrice");
        validateImportMoneyAmount(product.getFreeShippingThreshold(), "freeShippingThreshold");
        if (product.getOriginalPrice() != null && product.getOriginalPrice().compareTo(product.getPrice()) < 0) {
            throw new IllegalArgumentException("originalPrice must be greater than or equal to price");
        }
        validateLimitedTimePrice(product.getPrice(), product.getLimitedTimePrice());
        if (product.getStock() < 0) {
            throw new IllegalArgumentException("stock must be greater than or equal to 0");
        }
        if (product.getDiscount() != null && (product.getDiscount() < 0 || product.getDiscount() > 100)) {
            throw new IllegalArgumentException("discount must be between 0 and 100");
        }
        validateImportImageUrl(product.getImageUrl(), "imageUrl");
        validateImportImageList(product.getImages());
        validateImportSpecifications(product.getSpecifications());
        validateImportDetailContent(product.getDetailContent());
        validateImportVariants(product.getVariants());
    }

    private String normalizeDirectText(String value, String field, int maxLength, boolean required) {
        String normalized = value == null ? null : value
                .replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized == null || normalized.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        requireLength(normalized, maxLength, field);
        return normalized;
    }

    private void validateLimitedTimePrice(BigDecimal price, BigDecimal limitedTimePrice) {
        if (limitedTimePrice != null && price != null && limitedTimePrice.compareTo(price) > 0) {
            throw new IllegalArgumentException("limitedTimePrice must be less than or equal to price");
        }
    }

    private void requirePositive(Long value, String field) {
        if (value != null && value <= 0) {
            throw new IllegalArgumentException(field + " must be greater than 0");
        }
    }

    private void requireNonNegative(BigDecimal value, String field) {
        if (value != null && value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(field + " must be greater than or equal to 0");
        }
    }

    private void requirePresent(Object value, String field) {
        if (value == null) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private void requireLength(String value, int maxLength, String field) {
        if (value != null && value.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be " + maxLength + " characters or fewer");
        }
    }

    private void validateImportImageList(String images) {
        if (images == null || images.isBlank()) {
            return;
        }
        try {
            List<String> urls = OBJECT_MAPPER.readValue(images, new TypeReference<List<String>>() {});
            if (urls.size() > 8) {
                throw new IllegalArgumentException("images must include 8 URLs or fewer");
            }
            for (String url : urls) {
                validateImportImageUrl(url, "images");
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("images must be a JSON array of image URLs");
        }
    }

    private void validateImportSpecifications(String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(value);
            if (!node.isObject()) {
                throw new IllegalArgumentException("specifications must be a JSON object");
            }
            if (node.size() > 100) {
                throw new IllegalArgumentException("specifications must include 100 keys or fewer");
            }
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey() == null ? "" : entry.getKey().trim();
                if (key.isBlank()) {
                    throw new IllegalArgumentException("specifications keys must not be blank");
                }
                requireLength(key, 120, "specifications key");
                JsonNode item = entry.getValue();
                if (item != null && (item.isObject() || item.isArray())) {
                    throw new IllegalArgumentException("specifications values must be text, numbers, or booleans");
                }
                requireLength(jsonText(item), 1000, "specifications value");
            });
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("specifications must be a valid JSON object");
        }
    }

    private JsonNode validateImportJsonArray(String value, String field, int maxItems) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(value);
            if (!node.isArray()) {
                throw new IllegalArgumentException(field + " must be a JSON array");
            }
            if (node.size() > maxItems) {
                throw new IllegalArgumentException(field + " must include " + maxItems + " items or fewer");
            }
            return node;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(field + " must be a valid JSON array");
        }
    }

    private void validateImportDetailContent(String value) {
        JsonNode blocks = validateImportJsonArray(value, "detailContent", 24);
        if (blocks == null) {
            return;
        }
        for (JsonNode block : blocks) {
            if (!block.isObject()) {
                throw new IllegalArgumentException("detailContent items must be JSON objects");
            }
            String type = jsonText(block.get("type"));
            if (type == null || type.isBlank()) {
                throw new IllegalArgumentException("detailContent type is required");
            }
            if (!Set.of("text", "image", "video").contains(type)) {
                throw new IllegalArgumentException("detailContent type must be text, image, or video");
            }
            requireLength(jsonText(block.get("caption")), 180, "detailContent caption");
            if ("text".equals(type)) {
                String content = jsonText(block.get("content"));
                if (content == null || content.isBlank()) {
                    throw new IllegalArgumentException("detailContent text content is required");
                }
                requireLength(content, 4000, "detailContent content");
                continue;
            }
            String url = jsonText(block.get("url"));
            if (url == null || url.isBlank()) {
                throw new IllegalArgumentException("detailContent media URL is required");
            }
            validateImportImageUrl(url, "detailContent");
        }
    }

    private void validateImportVariants(String value) {
        JsonNode variants = validateImportJsonArray(value, "variants", 200);
        if (variants == null) {
            return;
        }
        Set<String> seenSkus = new HashSet<>();
        Set<String> seenOptionCombinations = new HashSet<>();
        for (JsonNode variant : variants) {
            if (!variant.isObject()) {
                throw new IllegalArgumentException("variants items must be JSON objects");
            }
            String sku = jsonText(variant.get("sku"));
            if (sku != null && !sku.isBlank()) {
                requireLength(sku, 80, "variants sku");
                if (!seenSkus.add(normalizeImportSkuKey(sku))) {
                    throw new IllegalArgumentException("variants sku must be unique");
                }
            }
            JsonNode options = variant.get("options");
            if (options == null || !options.isObject() || options.size() == 0) {
                throw new IllegalArgumentException("variants options are required");
            }
            List<String> optionPairs = new ArrayList<>();
            options.fields().forEachRemaining(entry -> {
                String optionName = entry.getKey() == null ? "" : entry.getKey().trim();
                String optionValue = jsonText(entry.getValue());
                if (optionName.isBlank() || optionValue == null || optionValue.isBlank()) {
                    throw new IllegalArgumentException("variants options must include non-empty names and values");
                }
                requireLength(optionName, 60, "variants option name");
                requireLength(optionValue, 120, "variants option value");
                optionPairs.add(optionName + "=" + optionValue);
            });
            optionPairs.sort(String::compareTo);
            if (!seenOptionCombinations.add(String.join("|", optionPairs))) {
                throw new IllegalArgumentException("variants option combinations must be unique");
            }
            BigDecimal variantPrice = jsonDecimal(variant.get("price"), "variants price");
            if (variantPrice == null || variantPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("variants price must be greater than 0");
            }
            Integer variantStock = jsonInteger(variant.get("stock"), "variants stock");
            if (variantStock != null && variantStock < 0) {
                throw new IllegalArgumentException("variants stock must be greater than or equal to 0");
            }
            validateImportImageUrl(jsonText(variant.get("imageUrl")), "variants");
        }
    }

    private void validateImportVariantSkusAcrossFile(String value, Set<String> importedVariantSkus) {
        JsonNode variants = validateImportJsonArray(value, "variants", 200);
        if (variants == null) {
            return;
        }
        for (JsonNode variant : variants) {
            if (variant == null || !variant.isObject()) {
                continue;
            }
            String sku = jsonText(variant.get("sku"));
            if (sku == null || sku.isBlank()) {
                continue;
            }
            if (!importedVariantSkus.add(normalizeImportSkuKey(sku))) {
                throw new IllegalArgumentException("variants sku appears more than once in this import file");
            }
        }
    }

    private boolean importHasVariantSku(String value) {
        JsonNode variants = validateImportJsonArray(value, "variants", 200);
        if (variants == null) {
            return false;
        }
        for (JsonNode variant : variants) {
            if (variant == null || !variant.isObject()) {
                continue;
            }
            String sku = jsonText(variant.get("sku"));
            if (sku != null && !sku.isBlank()) {
                return true;
            }
        }
        return false;
    }

    private void validateImportVariantSkusAgainstExisting(String value, Map<String, Set<Long>> existingVariantSkuOwners, Long currentProductId) {
        JsonNode variants = validateImportJsonArray(value, "variants", 200);
        if (variants == null || existingVariantSkuOwners == null || existingVariantSkuOwners.isEmpty()) {
            return;
        }
        for (JsonNode variant : variants) {
            if (variant == null || !variant.isObject()) {
                continue;
            }
            String sku = jsonText(variant.get("sku"));
            if (sku == null || sku.isBlank()) {
                continue;
            }
            Set<Long> owners = existingVariantSkuOwners.get(normalizeImportSkuKey(sku));
            if (owners == null || owners.isEmpty()) {
                continue;
            }
            boolean usedByAnotherProduct = owners.stream()
                    .anyMatch(ownerId -> currentProductId == null || !currentProductId.equals(ownerId));
            if (usedByAnotherProduct) {
                throw new IllegalArgumentException("variants sku already exists on another product: " + normalizeImportText(sku));
            }
        }
    }

    private Map<String, Set<Long>> loadExistingVariantSkuOwners() {
        if (productRepository == null) {
            return Map.of();
        }
        List<Product> products = productRepository.findAll();
        if (products == null || products.isEmpty()) {
            return Map.of();
        }
        Map<String, Set<Long>> owners = new LinkedHashMap<>();
        for (Product product : products) {
            if (product == null || product.getId() == null || product.getVariants() == null || product.getVariants().isBlank()) {
                continue;
            }
            try {
                JsonNode variants = OBJECT_MAPPER.readTree(product.getVariants());
                if (variants == null || !variants.isArray()) {
                    continue;
                }
                for (JsonNode variant : variants) {
                    if (variant == null || !variant.isObject()) {
                        continue;
                    }
                    String sku = jsonText(variant.get("sku"));
                    if (sku == null || sku.isBlank()) {
                        continue;
                    }
                    owners.computeIfAbsent(normalizeImportSkuKey(sku), ignored -> new LinkedHashSet<>()).add(product.getId());
                }
            } catch (Exception ignored) {
                // Existing malformed variant data should not block unrelated imports.
            }
        }
        return owners;
    }

    private String normalizeImportSkuKey(String sku) {
        return normalizeImportText(sku).toUpperCase(Locale.ROOT);
    }

    private String jsonText(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (!node.isTextual() && !node.isNumber() && !node.isBoolean()) {
            return null;
        }
        return node.asText().trim();
    }

    private BigDecimal jsonDecimal(JsonNode node, String field) {
        String value = jsonText(node);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            BigDecimal decimal = new BigDecimal(normalizeImportDecimalText(value));
            validateImportMoneyAmount(decimal, field);
            return decimal;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a decimal number");
        }
    }

    private Integer jsonInteger(JsonNode node, String field) {
        String value = jsonText(node);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a whole number");
        }
    }

    private void validateImportImageUrl(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        String url = value.trim();
        if (url.length() > MAX_IMPORT_IMAGE_URL_LENGTH) {
            throw new IllegalArgumentException(field + " is too long");
        }
        if (url.startsWith("//")) {
            throw new IllegalArgumentException(field + " must include http or https");
        }
        if (url.startsWith("/")) {
            return;
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) {
                throw new IllegalArgumentException(field + " must use http, https, or a site-relative path");
            }
            if (uri.getUserInfo() != null) {
                throw new IllegalArgumentException(field + " must not include credentials");
            }
            int port = uri.getPort();
            if (port != -1 && port != 80 && port != 443) {
                throw new IllegalArgumentException(field + " must use a standard web port");
            }
            if (hasUnsafeImportMediaHost(uri.getHost())) {
                throw new IllegalArgumentException(field + " must not point to localhost or a private network");
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(field + " must be a valid image URL");
        }
    }

    private boolean hasUnsafeImportMediaHost(String host) {
        if (host == null || host.isBlank()) {
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
                InetAddress address = InetAddress.getByName(normalized);
                return address.isAnyLocalAddress()
                        || address.isLoopbackAddress()
                        || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress()
                        || address.isMulticastAddress();
            } catch (Exception ex) {
                return true;
            }
        }
        return false;
    }

    private String importFieldFromException(Exception ex) {
        String message = ex.getMessage();
        if (message == null) {
            return null;
        }
        for (String field : List.of(
                "id", "name", "description", "price", "stock", "categoryId", "categoryName", "imageUrl",
                "brand", "originalPrice", "discount", "limitedTimePrice", "limitedTimeStartAt",
                "limitedTimeEndAt", "tag", "status", "isFeatured", "freeShipping", "freeShippingThreshold", "images",
                "specifications", "detailContent", "variants", "warranty", "shipping")) {
            if (message.startsWith(field + " ") || message.startsWith(field + ":") || message.contains("[" + field + "]")) {
                return field;
            }
        }
        return null;
    }

    private void mergeForImport(Product existing, Product imported, Set<String> updateFields) {
        if (updateFields.contains("name")) {
            existing.setName(imported.getName());
        }
        if (updateFields.contains("description")) {
            existing.setDescription(imported.getDescription());
        }
        if (updateFields.contains("price")) {
            existing.setPrice(imported.getPrice());
        }
        if (updateFields.contains("stock")) {
            existing.setStock(imported.getStock());
        }
        if (updateFields.contains("categoryId")) {
            existing.setCategoryId(imported.getCategoryId());
        }
        if (updateFields.contains("imageUrl")) {
            existing.setImageUrl(imported.getImageUrl());
        }
        if (updateFields.contains("isFeatured")) {
            existing.setIsFeatured(imported.getIsFeatured());
        }
        if (updateFields.contains("brand")) {
            existing.setBrand(imported.getBrand());
        }
        if (updateFields.contains("originalPrice")) {
            existing.setOriginalPrice(imported.getOriginalPrice());
        }
        if (updateFields.contains("discount")) {
            existing.setDiscount(imported.getDiscount());
        }
        if (updateFields.contains("limitedTimePrice")) {
            existing.setLimitedTimePrice(imported.getLimitedTimePrice());
        }
        if (updateFields.contains("limitedTimeStartAt")) {
            existing.setLimitedTimeStartAt(imported.getLimitedTimeStartAt());
        }
        if (updateFields.contains("limitedTimeEndAt")) {
            existing.setLimitedTimeEndAt(imported.getLimitedTimeEndAt());
        }
        if (updateFields.contains("tag")) {
            existing.setTag(imported.getTag());
        }
        if (updateFields.contains("status")) {
            existing.setStatus(imported.getStatus());
        }
        if (updateFields.contains("images")) {
            existing.setImages(imported.getImages());
        }
        if (updateFields.contains("specifications")) {
            existing.setSpecifications(imported.getSpecifications());
        }
        if (updateFields.contains("detailContent")) {
            existing.setDetailContent(imported.getDetailContent());
        }
        if (updateFields.contains("variants")) {
            existing.setVariants(imported.getVariants());
        }
        if (updateFields.contains("warranty")) {
            existing.setWarranty(imported.getWarranty());
        }
        if (updateFields.contains("shipping")) {
            existing.setShipping(imported.getShipping());
        }
        if (updateFields.contains("freeShipping")) {
            existing.setFreeShipping(imported.getFreeShipping());
        }
        if (updateFields.contains("freeShippingThreshold")) {
            existing.setFreeShippingThreshold(imported.getFreeShippingThreshold());
        }
    }

    private String value(List<String> values, int index) {
        return index >= 0 && index < values.size() ? normalizeImportText(values.get(index)) : null;
    }

    private String normalizeImportText(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeImportedStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = ProductStatusUtils.normalizeProductStatus(status);
        if (normalized == null) {
            throw new IllegalArgumentException("status must be one of " + ProductStatusUtils.PRODUCT_STATUSES);
        }
        return normalized;
    }

    private String required(String value, String field) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }

    private Long parseLong(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a whole number");
        }
    }

    private Integer parseInteger(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a whole number");
        }
    }

    private BigDecimal parseDecimal(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        try {
            BigDecimal decimal = new BigDecimal(normalizeImportDecimalText(value));
            validateImportMoneyAmount(decimal, field);
            return decimal;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(field + " must be a decimal number");
        }
    }

    private String normalizeImportDecimalText(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (!trimmed.contains(".") && trimmed.matches("[+-]?\\d+,\\d{1,2}")) {
            return trimmed.replace(',', '.');
        }
        return trimmed;
    }

    private void validateImportMoneyAmount(BigDecimal value, String field) {
        if (value == null) {
            return;
        }
        if (value.stripTrailingZeros().scale() > MAX_IMPORT_MONEY_SCALE) {
            throw new IllegalArgumentException(field + " must use at most " + MAX_IMPORT_MONEY_SCALE + " decimal places");
        }
        if (value.abs().compareTo(MAX_IMPORT_MONEY_AMOUNT) > 0) {
            throw new IllegalArgumentException(field + " must be " + MAX_IMPORT_MONEY_AMOUNT.toPlainString() + " or less");
        }
    }

    private Boolean parseBoolean(String value, String field) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        if ("true".equalsIgnoreCase(value) || "1".equals(value) || "yes".equalsIgnoreCase(value)) {
            return true;
        }
        if ("false".equalsIgnoreCase(value) || "0".equals(value) || "no".equalsIgnoreCase(value)) {
            return false;
        }
        throw new IllegalArgumentException(field + " must be true or false");
    }

    private LocalDateTime parseDateTime(String value, String field) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            try {
                return LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            } catch (Exception nested) {
                throw new IllegalArgumentException(field + " must use ISO datetime or yyyy-MM-dd HH:mm:ss");
            }
        }
    }

    private List<Long> collectCategoryIds(Long id) {
        List<Long> ids = new java.util.ArrayList<>();
        collectCategoryIds(id, ids);
        return ids;
    }

    private int scoreForPets(Product product, Map<Long, Category> categories, List<PetProfile> pets) {
        String haystack = searchableText(product, categories);
        int bestScore = 0;
        for (PetProfile pet : pets) {
            int score = 0;
            String petType = normalize(pet.getPetType());
            if ("DOG".equals(petType)) {
                score += containsAny(haystack, "dog", "dogs", "perro", "canine", "puppy") ? 45 : 0;
                score -= containsAny(haystack, "cat", "cats", "gato", "feline") ? 12 : 0;
            } else if ("CAT".equals(petType)) {
                score += containsAny(haystack, "cat", "cats", "gato", "feline", "kitten") ? 45 : 0;
                score -= containsAny(haystack, "dog", "dogs", "perro", "canine") ? 12 : 0;
            } else if ("SMALL_PET".equals(petType)) {
                score += containsAny(haystack, "small pet", "hamster", "rabbit", "guinea", "small animal") ? 45 : 0;
            }

            String size = normalize(pet.getSize());
            if (!size.isEmpty()) {
                score += containsAny(haystack, size.toLowerCase(Locale.ROOT), petSizeLabel(size)) ? 18 : 0;
            }

            String breed = normalize(pet.getBreed()).toLowerCase(Locale.ROOT);
            if (!breed.isEmpty() && haystack.contains(breed)) {
                score += 10;
            }

            if (isYoungPet(pet)) {
                score += containsAny(haystack, "puppy", "kitten", "junior", "training", "starter") ? 16 : 0;
            } else {
                score += containsAny(haystack, "adult", "orthopedic", "calming", "daily") ? 6 : 0;
            }

            if (containsAny(haystack, "food", "feeder", "fountain", "water", "bed", "toy", "groom", "harness", "leash")) {
                score += 4;
            }
            if (Boolean.TRUE.equals(product.getIsFeatured())) {
                score += 3;
            }
            bestScore = Math.max(bestScore, score);
        }
        return bestScore;
    }

    private String searchableText(Product product, Map<Long, Category> categories) {
        List<String> parts = new ArrayList<>();
        parts.add(product.getName());
        parts.add(product.getDescription());
        parts.add(product.getBrand());
        parts.add(product.getTag());
        parts.add(product.getSpecifications());
        Category category = categories.get(product.getCategoryId());
        while (category != null) {
            parts.add(category.getName());
            parts.add(category.getDescription());
            category = category.getParentId() == null ? null : categories.get(category.getParentId());
        }
        return parts.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (keyword != null && !keyword.isBlank() && text.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String petSizeLabel(String size) {
        if ("SMALL".equals(size)) return "small";
        if ("MEDIUM".equals(size)) return "medium";
        if ("LARGE".equals(size)) return "large";
        return size.toLowerCase(Locale.ROOT);
    }

    private boolean isYoungPet(PetProfile pet) {
        LocalDate birthday = pet.getBirthday();
        if (birthday == null || birthday.isAfter(LocalDate.now())) {
            return false;
        }
        return Period.between(birthday, LocalDate.now()).getYears() < 1;
    }

    private boolean isReadyAddOnCandidate(Product product) {
        BigDecimal price = effectivePrice(product);
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        return isQuickAddReady(product);
    }

    private int personalizedRecommendationPriority(Product product) {
        return isQuickAddReady(product) ? 0 : 1;
    }

    private boolean isPublicCatalogProduct(Product product) {
        if (!ProductStatusUtils.isPublicProduct(product)) {
            return false;
        }
        if (isBlank(product.getName()) || product.getPrice() == null || product.getPrice().compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        if (product.getCategoryId() == null || product.getCategoryId() <= 0) {
            return false;
        }
        return true;
    }

    private boolean isQuickAddReady(Product product) {
        if (!ProductStatusUtils.isPublicProduct(product)) {
            return false;
        }
        if (!hasSellableStock(product)) {
            return false;
        }
        return !hasSelectableOptions(product);
    }

    private boolean hasSelectableOptions(Product product) {
        Map<String, String> specifications = product.getSpecificationsMap();
        boolean hasOptions = specifications != null && specifications.keySet().stream().anyMatch(key -> key.startsWith("options."));
        boolean hasVariants = product.getVariantsList() != null && !product.getVariantsList().isEmpty();
        return hasOptions || hasVariants;
    }

    private boolean hasSellableStock(Product product) {
        return product != null && (product.getStock() == null || product.getStock() > 0);
    }

    private int scoreAddOnCandidate(Product product, BigDecimal targetAmount, BigDecimal floor, BigDecimal ceiling) {
        BigDecimal price = effectivePrice(product);
        if (price == null) {
            return Integer.MIN_VALUE;
        }
        boolean inTargetWindow = price.compareTo(floor) >= 0 && price.compareTo(ceiling) <= 0;
        boolean coversGap = targetAmount.compareTo(BigDecimal.ZERO) == 0 || price.compareTo(targetAmount) >= 0;
        if (!inTargetWindow && !coversGap) {
            return Integer.MIN_VALUE;
        }
        BigDecimal distance = price.subtract(targetAmount).abs();
        int score = 1000 - Math.min(600, distance.intValue());
        if (coversGap) score += 180;
        if (inTargetWindow) score += 120;
        if (Boolean.TRUE.equals(product.getIsFeatured())) score += 45;
        score += Math.min(60, product.getEffectiveDiscountPercent() == null ? 0 : product.getEffectiveDiscountPercent() * 2);
        score += Math.min(50, product.getReviewCount() == null ? 0 : product.getReviewCount().intValue());
        return score;
    }

    private BigDecimal effectivePrice(Product product) {
        return product.getEffectivePrice() == null ? product.getPrice() : product.getEffectivePrice();
    }

    private BigDecimal safePositiveRatio(BigDecimal value, BigDecimal fallback) {
        return value == null || value.compareTo(BigDecimal.ZERO) <= 0 ? fallback : value;
    }

    private BigDecimal safePositiveAmount(BigDecimal value, BigDecimal fallback) {
        return value == null || value.compareTo(BigDecimal.ZERO) <= 0 ? fallback : value;
    }

    private static class ProductImportRow {
        private final Product importedProduct;
        private final Product existingProduct;
        private final Set<String> updateFields;

        private ProductImportRow(Product importedProduct, Product existingProduct, Set<String> updateFields) {
            this.importedProduct = importedProduct;
            this.existingProduct = existingProduct;
            this.updateFields = updateFields;
        }
    }

    private static class ImportCategoryLookup {
        private final Set<Long> ids;
        private final Map<String, Long> names;
        private final Map<Long, Set<String>> namesById;
        private final Set<String> ambiguousNames;
        private final boolean validateIds;

        private ImportCategoryLookup(Set<Long> ids, Map<String, Long> names, Map<Long, Set<String>> namesById, Set<String> ambiguousNames, boolean validateIds) {
            this.ids = ids;
            this.names = names;
            this.namesById = namesById;
            this.ambiguousNames = ambiguousNames;
            this.validateIds = validateIds;
        }

        private static ImportCategoryLookup empty() {
            return new ImportCategoryLookup(Set.of(), Map.of(), Map.of(), Set.of(), false);
        }
    }

    private static class ProductScore {
        private final Product product;
        private final int score;

        private ProductScore(Product product, int score) {
            this.product = product;
            this.score = score;
        }
    }

    private static class ProductAddOnCandidate {
        private final Product product;
        private final int score;

        private ProductAddOnCandidate(Product product, int score) {
            this.product = product;
            this.score = score;
        }
    }

    private void collectCategoryIds(Long id, List<Long> ids) {
        ids.add(id);
        categoryRepository.findByParentId(id).forEach(child -> collectCategoryIds(child.getId(), ids));
    }

    private boolean matchesNormalizedKeyword(Product product, String normalizedKeyword, Map<Long, Category> categoryLookup) {
        if (normalizedKeyword.isEmpty()) {
            return true;
        }
        String searchable = productSearchText(product, categoryLookup);
        if (searchable.contains(normalizedKeyword)) {
            return true;
        }
        List<String> tokens = Arrays.stream(normalizedKeyword.split("\\s+"))
                .filter(token -> token.length() > 1)
                .collect(Collectors.toList());
        List<String> intentTokens = tokens.stream()
                .filter(token -> !isPetContextToken(token))
                .collect(Collectors.toList());
        if (!intentTokens.isEmpty()) {
            return intentTokens.stream().allMatch(token -> matchesSearchToken(searchable, token));
        }
        return tokens.stream().anyMatch(token -> matchesSearchToken(searchable, token));
    }

    private boolean matchesSearchToken(String searchable, String token) {
        return expandSearchToken(token).stream().anyMatch(searchable::contains);
    }

    private boolean isPetContextToken(String token) {
        return "dog".equals(token)
                || "dogs".equals(token)
                || "puppy".equals(token)
                || "cat".equals(token)
                || "cats".equals(token)
                || "kitten".equals(token)
                || "pet".equals(token)
                || "pets".equals(token)
                || "small".equals(token);
    }

    private String productSearchText(Product product, Map<Long, Category> categoryLookup) {
        StringBuilder builder = new StringBuilder();
        appendSearchText(builder, product.getName());
        appendSearchText(builder, product.getDescription());
        appendSearchText(builder, product.getBrand());
        appendSearchText(builder, product.getTag());
        appendCategorySearchText(builder, product.getCategoryId(), categoryLookup);
        Map<String, String> specifications = product.getSpecificationsMap();
        if (specifications != null) {
            specifications.forEach((key, value) -> {
                appendSearchText(builder, key);
                appendSearchText(builder, value);
            });
        }
        return normalizeSearchText(builder.toString());
    }

    private void appendSearchText(StringBuilder builder, String value) {
        if (value != null && !value.trim().isEmpty()) {
            builder.append(' ').append(value);
        }
    }

    private void appendCategorySearchText(StringBuilder builder, Long categoryId, Map<Long, Category> categoryLookup) {
        if (categoryLookup == null || categoryLookup.isEmpty()) {
            return;
        }
        Set<Long> visitedIds = new HashSet<>();
        Long currentId = categoryId;
        while (currentId != null && visitedIds.add(currentId)) {
            Category category = categoryLookup.get(currentId);
            if (category == null) {
                return;
            }
            appendSearchText(builder, category.getName());
            appendSearchText(builder, category.getDescription());
            Map<String, Map<String, String>> localizedContent = category.getLocalizedContentMap();
            if (localizedContent != null) {
                localizedContent.values().forEach(fields ->
                        fields.values().forEach(value -> appendSearchText(builder, value)));
            }
            currentId = category.getParentId();
        }
    }

    private String normalizeSearchText(String value) {
        return value == null
                ? ""
                : value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    private List<Product> getCachedProducts(String cacheKey, ProductSearchLoader loader) {
        long now = System.currentTimeMillis();
        ProductSearchCacheEntry cached = productSearchCache.get(cacheKey);
        long searchCacheTtlMs = runtimeConfig.getLong("product.search-cache-ttl-ms", 30000);
        if (cached != null && now - cached.createdAt <= Math.max(0, searchCacheTtlMs)) {
            return new ArrayList<>(cached.products);
        }
        List<Product> products = loader.load();
        if (searchCacheTtlMs > 0) {
            if (productSearchCache.size() >= Math.max(1, runtimeConfig.getInt("product.search-cache-max-entries", 80))) {
                productSearchCache.clear();
            }
            productSearchCache.put(cacheKey, new ProductSearchCacheEntry(now, new ArrayList<>(products)));
        }
        return products;
    }

    private void clearProductSearchCache() {
        productSearchCache.clear();
    }

    @FunctionalInterface
    private interface ProductSearchLoader {
        List<Product> load();
    }

    private static class ProductSearchCacheEntry {
        private final long createdAt;
        private final List<Product> products;

        private ProductSearchCacheEntry(long createdAt, List<Product> products) {
            this.createdAt = createdAt;
            this.products = products;
        }
    }

    private String singularize(String token) {
        if (token.endsWith("ies") && token.length() > 4) {
            return token.substring(0, token.length() - 3) + "y";
        }
        if (token.endsWith("es") && token.length() > 4) {
            return token.substring(0, token.length() - 2);
        }
        return token.endsWith("s") && token.length() > 3 ? token.substring(0, token.length() - 1) : token;
    }

    private List<String> expandSearchToken(String token) {
        Set<String> terms = new LinkedHashSet<>();
        terms.add(token);
        terms.add(singularize(token));
        switch (singularize(token)) {
            case "bed":
            case "sleep":
            case "sleeping":
            case "nap":
            case "napping":
            case "rest":
            case "resting":
                terms.addAll(Arrays.asList("bed", "beds", "sleep", "rest", "nap", "comfort", "calming", "furniture"));
                break;
            case "leash":
            case "walk":
            case "walking":
            case "harness":
                terms.addAll(Arrays.asList("leash", "leashes", "harness", "harnesses", "walk", "walking", "collar", "travel"));
                break;
            case "toy":
            case "play":
                terms.addAll(Arrays.asList("toy", "toys", "play", "chew", "puzzle", "enrichment"));
                break;
            case "smart":
            case "device":
                terms.addAll(Arrays.asList("smart", "device", "devices", "automatic", "programmable", "connected", "feeder", "fountain"));
                break;
            case "water":
            case "waterer":
            case "fountain":
                terms.addAll(Arrays.asList("water", "waterer", "waterers", "fountain", "fountains", "drink", "drinking"));
                break;
            case "food":
            case "feed":
            case "feeding":
            case "treat":
                terms.addAll(Arrays.asList("food", "feed", "feeding", "feeder", "treat", "treats", "nutrition"));
                break;
            case "litter":
            case "hygiene":
                terms.addAll(Arrays.asList("litter", "hygiene", "clean", "cleaning", "pad", "pads"));
                break;
            case "groom":
            case "grooming":
            case "shampoo":
                terms.addAll(Arrays.asList("groom", "grooming", "shampoo", "brush", "hygiene", "clean"));
                break;
            default:
                break;
        }
        return terms.stream()
                .map(this::normalizeSearchText)
                .filter(term -> !term.isEmpty())
                .collect(Collectors.toList());
    }

    private List<Product> enrichReviewStats(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return products;
        }
        List<Long> productIds = products.stream()
                .map(Product::getId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (productIds.isEmpty()) {
            products.forEach(product -> applyReviewStats(product, null));
            return products;
        }
        Map<Long, ProductReviewStats> statsByProductId;
        try {
            statsByProductId = reviewRepository.summarizeApprovedReviewsByProductIds(productIds).stream()
                    .collect(Collectors.toMap(
                            row -> ((Number) row[0]).longValue(),
                            row -> new ProductReviewStats(
                                    ((Number) row[1]).longValue(),
                                    row[2] == null ? 0L : ((Number) row[2]).longValue(),
                                    row[3] == null ? 0.0 : ((Number) row[3]).doubleValue()
                            )
                    ));
        } catch (RuntimeException ex) {
            statsByProductId = Map.of();
        }
        Map<Long, ProductReviewStats> resolvedStatsByProductId = statsByProductId;
        products.forEach(product -> applyReviewStats(product, resolvedStatsByProductId.get(product.getId())));
        return products;
    }

    private Product enrichReviewStats(Product product) {
        if (product == null || product.getId() == null) {
            return product;
        }
        ProductReviewStats stats;
        try {
            stats = reviewRepository.summarizeApprovedReviewsByProductIds(List.of(product.getId())).stream()
                    .findFirst()
                    .map(row -> new ProductReviewStats(
                            ((Number) row[1]).longValue(),
                            row[2] == null ? 0L : ((Number) row[2]).longValue(),
                            row[3] == null ? 0.0 : ((Number) row[3]).doubleValue()
                    ))
                    .orElse(null);
        } catch (RuntimeException ex) {
            stats = null;
        }
        applyReviewStats(product, stats);
        return product;
    }

    private void applyReviewStats(Product product, ProductReviewStats stats) {
        if (product == null) {
            return;
        }
        long reviewCount = stats == null ? 0L : stats.reviewCount;
        long positiveCount = stats == null ? 0L : stats.positiveCount;
        double positiveRate = reviewCount == 0 ? 0 : positiveCount * 100.0 / reviewCount;
        product.setReviewCount(reviewCount);
        product.setPositiveRate(Math.round(positiveRate * 10.0) / 10.0);
        product.setAverageRating(stats == null ? 0.0 : Math.round(stats.averageRating * 10.0) / 10.0);
    }

    private static class ProductReviewStats {
        private final long reviewCount;
        private final long positiveCount;
        private final double averageRating;

        private ProductReviewStats(long reviewCount, long positiveCount, double averageRating) {
            this.reviewCount = reviewCount;
            this.positiveCount = positiveCount;
            this.averageRating = averageRating;
        }
    }
}
