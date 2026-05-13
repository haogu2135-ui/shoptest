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
import com.example.shop.util.CsvUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private PetProfileMapper petProfileMapper;

    @Value("${product.search-cache-ttl-ms:30000}")
    private long searchCacheTtlMs;

    @Value("${product.search-cache-max-entries:80}")
    private int searchCacheMaxEntries;

    private final ConcurrentMap<String, ProductSearchCacheEntry> productSearchCache = new ConcurrentHashMap<>();

    @Override
    public List<Product> findAll() {
        return getCachedProducts("all", () -> enrichReviewStats(productRepository.findAll()));
    }

    @Override
    public Optional<Product> findById(Long id) {
        return productRepository.findById(id).map(this::enrichReviewStats);
    }

    @Override
    @Transactional
    public Product save(Product product) {
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
            return enrichReviewStats(candidates);
        }
        return enrichReviewStats(candidates.stream()
                .filter(product -> matchesNormalizedKeyword(product, normalizedKeyword))
                .collect(Collectors.toList()));
    }

    public List<Product> findRelatedProducts(Long productId, Long categoryId) {
        return enrichReviewStats(productRepository.findByCategoryId(categoryId).stream()
                .filter(p -> !p.getId().equals(productId))
                .limit(8)
                .collect(Collectors.toList()));
    }

    @Override
    public List<Product> findPersonalizedRecommendations(Long userId) {
        if (userId == null) {
            return List.of();
        }
        List<PetProfile> pets = petProfileMapper.findByUserId(userId);
        if (pets == null || pets.isEmpty()) {
            return List.of();
        }
        Map<Long, Category> categories = categoryRepository.findAll().stream()
                .collect(Collectors.toMap(Category::getId, category -> category));
        List<Product> products = productRepository.findAll().stream()
                .filter(product -> product.getStatus() == null || "ACTIVE".equalsIgnoreCase(product.getStatus()))
                .collect(Collectors.toList());

        return enrichReviewStats(products.stream()
                .map(product -> new ProductScore(product, scoreForPets(product, categories, pets)))
                .filter(entry -> entry.score > 0)
                .sorted(Comparator
                        .comparingInt((ProductScore entry) -> entry.score).reversed()
                        .thenComparing(entry -> entry.product.getReviewCount() == null ? 0L : entry.product.getReviewCount(), Comparator.reverseOrder())
                        .thenComparing(entry -> entry.product.getId()))
                .limit(12)
                .map(entry -> entry.product)
                .collect(Collectors.toList()));
    }

    @Override
    @Transactional
    public ProductImportResult importCsv(MultipartFile file) {
        ProductImportResult result = new ProductImportResult();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int rowNumber = 0;
            while ((line = reader.readLine()) != null) {
                rowNumber++;
                if (rowNumber == 1) {
                    line = line.replace("\uFEFF", "");
                }
                if (rowNumber == 1 && line.toLowerCase().startsWith("id,")) {
                    continue;
                }
                if (line.trim().isEmpty()) {
                    continue;
                }

                result.setTotalRows(result.getTotalRows() + 1);
                try {
                    Product product = toProduct(CsvUtils.parseLine(line));
                    if (product.getId() != null) {
                        Optional<Product> existing = productRepository.findById(product.getId());
                        if (existing.isPresent()) {
                            mergeForImport(existing.get(), product);
                            productRepository.save(existing.get());
                            result.setUpdated(result.getUpdated() + 1);
                            continue;
                        }
                    }
                    product.setId(null);
                    productRepository.save(product);
                    result.setCreated(result.getCreated() + 1);
                } catch (Exception ex) {
                    result.addError(rowNumber, ex.getMessage());
                }
            }
        } catch (Exception ex) {
            result.addError(0, "Failed to read CSV: " + ex.getMessage());
        }
        if (result.getCreated() > 0 || result.getUpdated() > 0) {
            clearProductSearchCache();
        }
        return result;
    }

    private Product toProduct(List<String> values) {
        if (values.size() < 6) {
            throw new IllegalArgumentException("Expected at least 6 columns: id,name,description,price,stock,categoryId");
        }

        Product product = new Product();
        product.setId(parseLong(value(values, 0), false, "id"));
        product.setName(required(value(values, 1), "name"));
        product.setDescription(value(values, 2));
        product.setPrice(parseDecimal(value(values, 3), true, "price"));
        product.setStock(parseInteger(value(values, 4), true, "stock"));
        product.setCategoryId(parseLong(value(values, 5), true, "categoryId"));
        product.setImageUrl(value(values, 6));
        product.setIsFeatured(parseBoolean(value(values, 7)));
        product.setBrand(value(values, 8));
        product.setOriginalPrice(parseDecimal(value(values, 9), false, "originalPrice"));
        product.setDiscount(parseInteger(value(values, 10), false, "discount"));
        product.setLimitedTimePrice(parseDecimal(value(values, 11), false, "limitedTimePrice"));
        product.setLimitedTimeStartAt(parseDateTime(value(values, 12), "limitedTimeStartAt"));
        product.setLimitedTimeEndAt(parseDateTime(value(values, 13), "limitedTimeEndAt"));
        product.setTag(value(values, 14));
        boolean hasDetailContentColumn = values.size() > 20;
        String status = value(values, hasDetailContentColumn ? 20 : 19);
        product.setStatus(status == null || status.isEmpty() ? "ACTIVE" : status);
        product.setImages(value(values, 15));
        product.setSpecifications(value(values, 16));
        product.setDetailContent(hasDetailContentColumn ? value(values, 17) : null);
        product.setWarranty(value(values, hasDetailContentColumn ? 18 : 17));
        product.setShipping(value(values, hasDetailContentColumn ? 19 : 18));
        product.setFreeShipping(parseBoolean(value(values, hasDetailContentColumn ? 21 : 20)));
        product.setFreeShippingThreshold(parseDecimal(value(values, hasDetailContentColumn ? 22 : 21), false, "freeShippingThreshold"));
        product.setVariants(value(values, hasDetailContentColumn ? 23 : 22));
        return product;
    }

    private void mergeForImport(Product existing, Product imported) {
        existing.setName(imported.getName());
        existing.setDescription(imported.getDescription());
        existing.setPrice(imported.getPrice());
        existing.setStock(imported.getStock());
        existing.setCategoryId(imported.getCategoryId());
        existing.setImageUrl(imported.getImageUrl());
        existing.setIsFeatured(imported.getIsFeatured());
        existing.setBrand(imported.getBrand());
        existing.setOriginalPrice(imported.getOriginalPrice());
        existing.setDiscount(imported.getDiscount());
        existing.setLimitedTimePrice(imported.getLimitedTimePrice());
        existing.setLimitedTimeStartAt(imported.getLimitedTimeStartAt());
        existing.setLimitedTimeEndAt(imported.getLimitedTimeEndAt());
        existing.setTag(imported.getTag());
        existing.setStatus(imported.getStatus());
        existing.setImages(imported.getImages());
        existing.setSpecifications(imported.getSpecifications());
        existing.setDetailContent(imported.getDetailContent());
        existing.setVariants(imported.getVariants());
        existing.setWarranty(imported.getWarranty());
        existing.setShipping(imported.getShipping());
        existing.setFreeShipping(imported.getFreeShipping());
        existing.setFreeShippingThreshold(imported.getFreeShippingThreshold());
    }

    private String value(List<String> values, int index) {
        return index < values.size() ? values.get(index).trim() : null;
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
        return Long.parseLong(value);
    }

    private Integer parseInteger(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        return Integer.parseInt(value);
    }

    private BigDecimal parseDecimal(String value, boolean required, String field) {
        if (value == null || value.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException(field + " is required");
            }
            return null;
        }
        return new BigDecimal(value);
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        return "true".equalsIgnoreCase(value) || "1".equals(value) || "yes".equalsIgnoreCase(value);
    }

    private LocalDateTime parseDateTime(String value, String field) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            return LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
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

    private static class ProductScore {
        private final Product product;
        private final int score;

        private ProductScore(Product product, int score) {
            this.product = product;
            this.score = score;
        }
    }

    private void collectCategoryIds(Long id, List<Long> ids) {
        ids.add(id);
        categoryRepository.findByParentId(id).forEach(child -> collectCategoryIds(child.getId(), ids));
    }

    private boolean matchesNormalizedKeyword(Product product, String normalizedKeyword) {
        if (normalizedKeyword.isEmpty()) {
            return true;
        }
        String searchable = productSearchText(product);
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

    private String productSearchText(Product product) {
        StringBuilder builder = new StringBuilder();
        appendSearchText(builder, product.getName());
        appendSearchText(builder, product.getDescription());
        appendSearchText(builder, product.getBrand());
        appendSearchText(builder, product.getTag());
        appendCategorySearchText(builder, product.getCategoryId());
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

    private void appendCategorySearchText(StringBuilder builder, Long categoryId) {
        Set<Long> visitedIds = new HashSet<>();
        Long currentId = categoryId;
        while (currentId != null && visitedIds.add(currentId)) {
            Optional<Category> categoryOptional = categoryRepository.findById(currentId);
            if (categoryOptional.isEmpty()) {
                return;
            }
            Category category = categoryOptional.get();
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
        if (cached != null && now - cached.createdAt <= Math.max(0, searchCacheTtlMs)) {
            return new ArrayList<>(cached.products);
        }
        List<Product> products = loader.load();
        if (searchCacheTtlMs > 0) {
            if (productSearchCache.size() >= Math.max(1, searchCacheMaxEntries)) {
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
        products.forEach(this::enrichReviewStats);
        return products;
    }

    private Product enrichReviewStats(Product product) {
        if (product == null || product.getId() == null) {
            return product;
        }
        long reviewCount = reviewRepository.countByProduct_IdAndStatus(product.getId(), "APPROVED");
        long positiveCount = reviewRepository.countByProduct_IdAndStatusAndRatingGreaterThanEqual(product.getId(), "APPROVED", 4);
        double positiveRate = reviewCount == 0 ? 0 : positiveCount * 100.0 / reviewCount;
        product.setReviewCount(reviewCount);
        product.setPositiveRate(Math.round(positiveRate * 10.0) / 10.0);
        product.setAverageRating(reviewRepository.findAverageRatingByProductId(product.getId()));
        return product;
    }
} 
