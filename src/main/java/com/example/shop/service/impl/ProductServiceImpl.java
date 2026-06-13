package com.example.shop.service.impl;

import com.example.shop.dto.ProductImportResult;
import com.example.shop.dto.ProductListQuery;
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
import com.example.shop.util.ImageUrlValidator;
import com.example.shop.util.ProductStatusUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.NoTransactionException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.web.multipart.MultipartFile;

import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Expression;
import javax.persistence.criteria.Order;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PushbackInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
@Slf4j
public class ProductServiceImpl implements ProductService {
    private static final int MAX_IMPORT_IMAGE_URL_LENGTH = 2000;
    private static final int MAX_IMPORT_MONEY_SCALE = 2;
    private static final BigDecimal MAX_IMPORT_MONEY_AMOUNT = new BigDecimal("99999999.99");
    private static final BigDecimal ZERO_REVIEW_STAT = BigDecimal.ZERO.setScale(1);
    private static final int DEFAULT_FEATURED_PRODUCT_LIMIT = 12;
    private static final int MAX_FEATURED_PRODUCT_LIMIT = 36;
    private static final int HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT = 100;
    private static final int HARD_ADMIN_PRODUCT_PAGE_SIZE_LIMIT = 500;
    private static final int HARD_LEGACY_PRODUCT_LIST_LIMIT = 500;
    private static final int MAX_CATEGORY_TREE_DEPTH = 10;
    private static final int HARD_PRODUCT_IMPORT_VARIANT_SCAN_ROWS = 5_000;
    private static final String SMART_DEVICES_COLLECTION = "smart-devices";
    private static final Pattern HTML_COMMENT_PATTERN = Pattern.compile("(?is)<!--.*?-->");
    private static final Pattern HTML_BLOCK_PATTERN = Pattern.compile("(?is)<(script|style|iframe|object|embed|svg|math)\\b[^>]*>.*?</\\1\\s*>");
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("(?is)<[^>]+>");
    private static final Set<Long> SMART_DEVICE_COLLECTION_CATEGORY_IDS = Set.of(10L, 11L);
    private static final List<String> SMART_DEVICE_COLLECTION_TERMS = List.of(
            "smart", "automatic", "feeder", "feeders", "fountain", "waterer", "waterers",
            "camera", "tracker", "sensor", "device", "connected"
    );
    private static final int LEGACY_IMPORT_COLUMN_COUNT = 24;
    private static final char LIKE_ESCAPE_CHAR = '!';
    private static final Set<String> REQUIRED_IMPORT_HEADERS = Set.of("name", "price", "stock", "categoryid");
    private static final Set<String> SUPPORTED_IMPORT_HEADERS = Set.of(
            "id", "name", "description", "price", "stock", "categoryid", "categoryname", "imageurl",
            "isfeatured", "brand", "originalprice", "discount", "limitedtimeprice", "limitedtimestartat",
            "limitedtimeendat", "tag", "images", "specifications", "detailcontent", "warranty",
            "shipping", "status", "freeshipping", "freeshippingthreshold", "bestsellerrank", "variants"
    );
    private static final List<String> FULL_IMPORT_UPDATE_FIELDS = List.of(
            "name", "description", "price", "stock", "categoryId", "imageUrl", "isFeatured",
            "brand", "originalPrice", "discount", "limitedTimePrice", "limitedTimeStartAt",
            "limitedTimeEndAt", "tag", "status", "images", "specifications", "detailContent",
            "variants", "warranty", "shipping", "freeShipping", "freeShippingThreshold", "bestSellerRank"
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
            Map.entry("freeshippingthreshold", "freeShippingThreshold"),
            Map.entry("bestsellerrank", "bestSellerRank")
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
            Map.entry("freeshippingthreshold", "freeShippingThreshold"),
            Map.entry("bestsellerrank", "bestSellerRank")
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
            Map.entry("bestseller", "bestsellerrank"),
            Map.entry("bestsellerrank", "bestsellerrank"),
            Map.entry("options", "variants")
    );
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

    @Autowired(required = false)
    private CacheManager cacheManager;

    private final ConcurrentMap<String, ProductSearchCacheEntry> productSearchCache = new ConcurrentHashMap<>();
    private final Object productSearchCacheLock = new Object();

    @Override
    public List<Product> findAll() {
        int limit = legacyProductListLimit("product.legacy-list-max-rows", 500, HARD_LEGACY_PRODUCT_LIST_LIMIT);
        return getCachedProducts("all:limit=" + limit, () -> enrichReviewStats(productRepository
                .findAll(PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "id")))
                .getContent()));
    }

    @Override
    public List<Product> findPublicProducts() {
        ProductListQuery query = new ProductListQuery();
        query.setPage(0);
        query.setSize(legacyProductListLimit(
                "product.public-legacy-list-max-rows",
                runtimeConfig.getInt("product.public-default-page-size", 20),
                HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT));
        query.setSort("id,asc");
        return findPublicProducts(query);
    }

    @Override
    public List<Product> findPublicProducts(ProductListQuery query) {
        ProductListQuery normalizedQuery = query == null ? new ProductListQuery() : query;
        String normalizedKeyword = normalizeSearchText(normalizedQuery.getKeyword());
        String cacheKey = productListCacheKey(normalizedQuery, normalizedKeyword);
        return getCachedProducts(cacheKey, () -> findPublicProductsUncached(normalizedQuery, normalizedKeyword));
    }

    private List<Product> findPublicProductsUncached(ProductListQuery query, String normalizedKeyword) {
        return findPublicProductPageUncached(query, normalizedKeyword).getContent();
    }

    @Override
    public Page<Product> findPublicProductPage(ProductListQuery query) {
        ProductListQuery normalizedQuery = query == null ? new ProductListQuery() : query;
        String normalizedKeyword = normalizeSearchText(normalizedQuery.getKeyword());
        return findPublicProductPageUncached(normalizedQuery, normalizedKeyword);
    }

    private Page<Product> findPublicProductPageUncached(ProductListQuery normalizedQuery, String normalizedKeyword) {
        int normalizedPage = normalizeProductPage(normalizedQuery.getPage());
        int normalizedSize = normalizeProductPageSize(normalizedQuery.getSize());
        BigDecimal minPrice = normalizeMinPrice(normalizedQuery.getMinPrice());
        BigDecimal maxPrice = normalizeMaxPrice(normalizedQuery.getMaxPrice());
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            return new PageImpl<>(List.of(), PageRequest.of(normalizedPage, normalizedSize), 0);
        }
        Set<Long> categoryIds = selectedCategoryIds(normalizedQuery);
        Set<Long> keywordCategoryIds = findKeywordCategoryIds(normalizedKeyword);
        String normalizedStatus = normalizePublicStatusFilter(normalizedQuery.getStatus());
        String normalizedCollection = normalizePublicCollection(normalizedQuery.getCollection());
        Set<Long> collectionCategoryIds = smartDeviceCollectionCategoryIds(normalizedCollection);
        PageRequest pageRequest = PageRequest.of(normalizedPage, normalizedSize, productPageSort(normalizedQuery.getSort()));
        Page<Product> page = productRepository.findAll(publicProductSpecification(
                normalizedQuery,
                normalizedKeyword,
                categoryIds,
                keywordCategoryIds,
                normalizedCollection,
                collectionCategoryIds,
                minPrice,
                maxPrice,
                normalizedStatus), pageRequest);
        List<Product> pageItems = enrichReviewStats(page.getContent());
        Map<Long, Category> categoryLookup = loadCategoryLookupForProducts(pageItems);
        pageItems = pageItems.stream()
                .filter(product -> matchesPublicListQuery(product, normalizedQuery, normalizedKeyword, categoryLookup,
                        categoryIds, normalizedCollection, collectionCategoryIds, minPrice, maxPrice, normalizedStatus))
                .collect(Collectors.toList());
        return new PageImpl<>(pageItems, pageRequest, page.getTotalElements());
    }

    private Specification<Product> publicProductSpecification(ProductListQuery query,
                                                              String normalizedKeyword,
                                                              Set<Long> categoryIds,
                                                              Set<Long> keywordCategoryIds,
                                                              String normalizedCollection,
                                                              Set<Long> collectionCategoryIds,
                                                              BigDecimal minPrice,
                                                              BigDecimal maxPrice,
                                                              String normalizedStatus) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.isNull(root.get("status")),
                    criteriaBuilder.equal(criteriaBuilder.upper(root.get("status")), "ACTIVE")));
            predicates.add(criteriaBuilder.isNotNull(root.get("name")));
            predicates.add(criteriaBuilder.notEqual(root.get("name"), ""));
            predicates.add(criteriaBuilder.isNotNull(root.get("price")));
            predicates.add(criteriaBuilder.greaterThan(root.get("price"), BigDecimal.ZERO));
            predicates.add(criteriaBuilder.isNotNull(root.get("categoryId")));
            predicates.add(criteriaBuilder.greaterThan(root.get("categoryId"), 0L));
            if (normalizedStatus != null && !"ACTIVE".equals(normalizedStatus)) {
                predicates.add(criteriaBuilder.disjunction());
            }
            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.get("categoryId").in(categoryIds));
            }
            addCollectionPredicates(predicates, criteriaBuilder, root, normalizedCollection, collectionCategoryIds);
            if (query.getFeatured() != null) {
                predicates.add(criteriaBuilder.equal(root.get("isFeatured"), query.getFeatured()));
            }
            if (Boolean.TRUE.equals(query.getDiscount())) {
                predicates.add(activeDiscountPredicate(criteriaBuilder, root));
            }
            Expression<BigDecimal> effectivePrice = effectivePriceExpression(criteriaBuilder, root);
            if (minPrice != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(effectivePrice, minPrice));
            }
            if (maxPrice != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(effectivePrice, maxPrice));
            }
            addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get("specifications"), query.getPetSizes());
            addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get("specifications"), query.getMaterials());
            addColorPredicates(predicates, criteriaBuilder, root.get("name"), root.get("specifications"), query.getColors());
            if (normalizedKeyword != null && !normalizedKeyword.isEmpty()) {
                List<Predicate> keywordPredicates = new ArrayList<>();
                recommendationSearchTerms(List.of(normalizedKeyword)).forEach(term -> keywordPredicates.add(criteriaBuilder.or(
                        containsLike(criteriaBuilder, root.get("name"), term),
                        containsLike(criteriaBuilder, root.get("description"), term),
                        containsLike(criteriaBuilder, root.get("brand"), term),
                        containsLike(criteriaBuilder, root.get("tag"), term),
                        containsLike(criteriaBuilder, root.get("specifications"), term))));
                if (keywordCategoryIds != null && !keywordCategoryIds.isEmpty()) {
                    keywordPredicates.add(root.get("categoryId").in(keywordCategoryIds));
                }
                predicates.add(keywordPredicates.isEmpty()
                        ? criteriaBuilder.disjunction()
                        : criteriaBuilder.or(keywordPredicates.toArray(new Predicate[0])));
            }
            applyProductPageRanking(criteriaQuery, criteriaBuilder, root, query.getSort());
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private void applyProductPageRanking(CriteriaQuery<?> criteriaQuery,
                                         CriteriaBuilder criteriaBuilder,
                                         Root<Product> root,
                                         String sort) {
        SortSpec sortSpec = parseProductSort(sort);
        if (!sortSpec.requiresCriteriaRanking() || isCountQuery(criteriaQuery)) {
            return;
        }
        List<Order> orders = new ArrayList<>();
        Expression<Integer> sellableRank = sellableRank(criteriaBuilder, root);
        Expression<Integer> quickAddRank = quickAddRank(criteriaBuilder, root);
        Expression<Integer> featuredRank = booleanRank(criteriaBuilder, root, "isFeatured");
        Expression<Integer> activeDiscountRank = activeDiscountRank(criteriaBuilder, root);
        Expression<Integer> freeShippingRank = booleanRank(criteriaBuilder, root, "freeShipping");
        Expression<Integer> lowStockRank = lowStockRank(criteriaBuilder, root);
        Expression<Integer> discountValue = criteriaBuilder.coalesce(root.<Integer>get("discount"), 0);
        Expression<BigDecimal> savingsValue = savingsValue(criteriaBuilder, root);

        if ("quickadd".equals(sortSpec.field)) {
            orders.add(criteriaBuilder.desc(quickAddRank));
            addConversionRanking(orders, criteriaBuilder, root, sellableRank, featuredRank, activeDiscountRank,
                    discountValue, freeShippingRank, savingsValue);
        } else if ("bestvalue".equals(sortSpec.field)) {
            orders.add(criteriaBuilder.desc(activeDiscountRank));
            orders.add(criteriaBuilder.desc(savingsValue));
            orders.add(criteriaBuilder.desc(discountValue));
            addConversionRanking(orders, criteriaBuilder, root, sellableRank, featuredRank, activeDiscountRank,
                    discountValue, freeShippingRank, savingsValue);
        } else if ("lowstock".equals(sortSpec.field)) {
            orders.add(criteriaBuilder.desc(lowStockRank));
            orders.add(criteriaBuilder.asc(root.<Integer>get("stock")));
            addConversionRanking(orders, criteriaBuilder, root, sellableRank, featuredRank, activeDiscountRank,
                    discountValue, freeShippingRank, savingsValue);
        } else {
            addConversionRanking(orders, criteriaBuilder, root, sellableRank, featuredRank, activeDiscountRank,
                    discountValue, freeShippingRank, savingsValue);
        }
        criteriaQuery.orderBy(orders);
    }

    private boolean isCountQuery(CriteriaQuery<?> criteriaQuery) {
        if (criteriaQuery == null || criteriaQuery.getResultType() == null) {
            return false;
        }
        Class<?> resultType = criteriaQuery.getResultType();
        return Long.class.equals(resultType) || long.class.equals(resultType);
    }

    private void addConversionRanking(List<Order> orders,
                                      CriteriaBuilder criteriaBuilder,
                                      Root<Product> root,
                                      Expression<Integer> sellableRank,
                                      Expression<Integer> featuredRank,
                                      Expression<Integer> activeDiscountRank,
                                      Expression<Integer> discountValue,
                                      Expression<Integer> freeShippingRank,
                                      Expression<BigDecimal> savingsValue) {
        orders.add(criteriaBuilder.desc(sellableRank));
        orders.add(criteriaBuilder.desc(featuredRank));
        orders.add(criteriaBuilder.desc(activeDiscountRank));
        orders.add(criteriaBuilder.desc(discountValue));
        orders.add(criteriaBuilder.desc(freeShippingRank));
        orders.add(criteriaBuilder.desc(savingsValue));
        orders.add(criteriaBuilder.asc(root.<Long>get("id")));
    }

    private Expression<Integer> sellableRank(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        return criteriaBuilder.<Integer>selectCase()
                .when(criteriaBuilder.or(
                        criteriaBuilder.isNull(root.get("stock")),
                        criteriaBuilder.greaterThan(root.<Integer>get("stock"), 0)), 1)
                .otherwise(0);
    }

    private Expression<Integer> quickAddRank(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        Predicate sellable = criteriaBuilder.or(
                criteriaBuilder.isNull(root.get("stock")),
                criteriaBuilder.greaterThan(root.<Integer>get("stock"), 0));
        Predicate noVariants = criteriaBuilder.or(
                criteriaBuilder.isNull(root.get("variants")),
                criteriaBuilder.equal(criteriaBuilder.trim(root.<String>get("variants")), ""));
        Predicate noOptions = criteriaBuilder.or(
                criteriaBuilder.isNull(root.get("specifications")),
                criteriaBuilder.notLike(criteriaBuilder.lower(root.<String>get("specifications")), "%options.%"));
        return criteriaBuilder.<Integer>selectCase()
                .when(criteriaBuilder.and(sellable, noVariants, noOptions), 1)
                .otherwise(0);
    }

    private Expression<Integer> booleanRank(CriteriaBuilder criteriaBuilder, Root<Product> root, String field) {
        return criteriaBuilder.<Integer>selectCase()
                .when(criteriaBuilder.equal(root.get(field), true), 1)
                .otherwise(0);
    }

    private Expression<Integer> activeDiscountRank(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        return criteriaBuilder.<Integer>selectCase()
                .when(activeDiscountPredicate(criteriaBuilder, root), 1)
                .otherwise(0);
    }

    private Predicate activeDiscountPredicate(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        return criteriaBuilder.or(
                criteriaBuilder.greaterThan(root.<Integer>get("discount"), 0),
                criteriaBuilder.and(
                        criteriaBuilder.isNotNull(root.get("originalPrice")),
                        criteriaBuilder.isNotNull(root.get("price")),
                        criteriaBuilder.greaterThan(root.<BigDecimal>get("originalPrice"), BigDecimal.ZERO),
                        criteriaBuilder.lessThan(root.<BigDecimal>get("price"), root.<BigDecimal>get("originalPrice"))),
                activeLimitedTimePricePredicate(criteriaBuilder, root));
    }

    private Predicate activeLimitedTimePricePredicate(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        LocalDateTime now = LocalDateTime.now();
        return criteriaBuilder.and(
                criteriaBuilder.isNotNull(root.get("limitedTimePrice")),
                criteriaBuilder.isNotNull(root.get("limitedTimeEndAt")),
                criteriaBuilder.and(
                        criteriaBuilder.or(
                                criteriaBuilder.isNull(root.get("limitedTimeStartAt")),
                                criteriaBuilder.lessThanOrEqualTo(root.<LocalDateTime>get("limitedTimeStartAt"), now)),
                        criteriaBuilder.greaterThan(root.<LocalDateTime>get("limitedTimeEndAt"), now)));
    }

    private Expression<BigDecimal> effectivePriceExpression(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        return criteriaBuilder.<BigDecimal>selectCase()
                .when(activeLimitedTimePricePredicate(criteriaBuilder, root), root.<BigDecimal>get("limitedTimePrice"))
                .otherwise(root.<BigDecimal>get("price"));
    }

    private Expression<Integer> lowStockRank(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        return criteriaBuilder.<Integer>selectCase()
                .when(criteriaBuilder.and(
                        criteriaBuilder.isNotNull(root.get("stock")),
                        criteriaBuilder.greaterThan(root.<Integer>get("stock"), 0),
                        criteriaBuilder.lessThanOrEqualTo(root.<Integer>get("stock"), 5)), 1)
                .otherwise(0);
    }

    private Expression<BigDecimal> savingsValue(CriteriaBuilder criteriaBuilder, Root<Product> root) {
        Expression<BigDecimal> basePrice = criteriaBuilder.coalesce(root.<BigDecimal>get("originalPrice"), root.<BigDecimal>get("price"));
        return criteriaBuilder.diff(basePrice, root.<BigDecimal>get("price"));
    }

    private void addCollectionPredicates(List<Predicate> predicates,
                                         CriteriaBuilder criteriaBuilder,
                                         Root<Product> root,
                                         String normalizedCollection,
                                         Set<Long> collectionCategoryIds) {
        if (!SMART_DEVICES_COLLECTION.equals(normalizedCollection)) {
            return;
        }
        List<Predicate> collectionPredicates = new ArrayList<>();
        if (collectionCategoryIds != null && !collectionCategoryIds.isEmpty()) {
            collectionPredicates.add(root.get("categoryId").in(collectionCategoryIds));
        }
        SMART_DEVICE_COLLECTION_TERMS.forEach(term -> collectionPredicates.add(criteriaBuilder.or(
                criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(root.get("name"), "")), "%" + term + "%"),
                criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(root.get("description"), "")), "%" + term + "%"),
                criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(root.get("brand"), "")), "%" + term + "%"),
                criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(root.get("tag"), "")), "%" + term + "%"),
                criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(root.get("specifications"), "")), "%" + term + "%"))));
        predicates.add(collectionPredicates.isEmpty()
                ? criteriaBuilder.disjunction()
                : criteriaBuilder.or(collectionPredicates.toArray(new Predicate[0])));
    }

    private void addSpecificationRefinementPredicates(List<Predicate> predicates,
                                                      CriteriaBuilder criteriaBuilder,
                                                      javax.persistence.criteria.Path<String> specificationsPath,
                                                      List<String> values) {
        List<String> normalizedValues = normalizeRefinementValues(values);
        if (normalizedValues.isEmpty()) {
            return;
        }
        predicates.add(criteriaBuilder.or(normalizedValues.stream()
                .map(value -> criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(specificationsPath, "")), "%" + value + "%"))
                .toArray(Predicate[]::new)));
    }

    private void addColorPredicates(List<Predicate> predicates,
                                    CriteriaBuilder criteriaBuilder,
                                    javax.persistence.criteria.Path<String> namePath,
                                    javax.persistence.criteria.Path<String> specificationsPath,
                                    List<String> values) {
        List<String> normalizedValues = normalizeRefinementValues(values);
        if (normalizedValues.isEmpty()) {
            return;
        }
        predicates.add(criteriaBuilder.or(normalizedValues.stream()
                .map(value -> criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(namePath, "")), "%" + value + "%"),
                        criteriaBuilder.like(criteriaBuilder.lower(criteriaBuilder.coalesce(specificationsPath, "")), "%" + value + "%")))
                .toArray(Predicate[]::new)));
    }

    private Set<Long> findKeywordCategoryIds(String normalizedKeyword) {
        if (normalizedKeyword == null || normalizedKeyword.isEmpty()) {
            return Set.of();
        }
        Set<Long> ids = new LinkedHashSet<>();
        recommendationSearchTerms(List.of(normalizedKeyword)).stream()
                .limit(8)
                .forEach(term -> categoryRepository.findIdsByKeyword(escapeLikeTerm(term), PageRequest.of(0, 40))
                        .forEach(id -> {
                            if (id == null || id <= 0 || ids.size() >= 120) {
                                return;
                            }
                            ids.addAll(collectCategoryIds(id));
                        }));
        return ids;
    }

    private Sort productPageSort(String sort) {
        SortSpec sortSpec = parseProductSort(sort);
        if (sortSpec.requiresCriteriaRanking()) {
            return Sort.unsorted();
        }
        String property;
        switch (sortSpec.field) {
            case "price":
                property = "price";
                break;
            case "name":
                property = "name";
                break;
            case "createdat":
            case "created":
                property = "createdAt";
                break;
            case "updatedat":
            case "updated":
                property = "updatedAt";
                break;
            case "discount":
                property = "discount";
                break;
            case "stock":
                property = "stock";
                break;
            case "featured":
                property = "isFeatured";
                break;
            case "id":
            case "rating":
            case "averagerating":
            case "reviews":
            case "reviewcount":
            default:
                property = "id";
                break;
        }
        Sort.Direction direction = sortSpec.descending ? Sort.Direction.DESC : Sort.Direction.ASC;
        Sort primary = Sort.by(direction, property);
        return "id".equals(property) ? primary : primary.and(Sort.by(Sort.Direction.ASC, "id"));
    }

    @Override
    public List<Product> findAdminProducts(ProductListQuery query) {
        return findAdminProductPage(query).getContent();
    }

    @Override
    public Page<Product> findAdminProductPage(ProductListQuery query) {
        ProductListQuery normalizedQuery = query == null ? new ProductListQuery() : query;
        String normalizedKeyword = normalizeSearchText(normalizedQuery.getKeyword());
        int normalizedPage = normalizeProductPage(normalizedQuery.getPage());
        int normalizedSize = normalizeAdminProductPageSize(normalizedQuery.getSize());
        PageRequest pageRequest = PageRequest.of(normalizedPage, normalizedSize, productPageSort(normalizedQuery.getSort()));
        BigDecimal minPrice = normalizeMinPrice(normalizedQuery.getMinPrice());
        BigDecimal maxPrice = normalizeMaxPrice(normalizedQuery.getMaxPrice());
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            return new PageImpl<>(List.of(), pageRequest, 0);
        }
        Set<Long> categoryIds = selectedCategoryIds(normalizedQuery);
        Set<Long> keywordCategoryIds = findKeywordCategoryIds(normalizedKeyword);
        String normalizedStatus = normalizePublicStatusFilter(normalizedQuery.getStatus());
        Page<Product> page = productRepository.findAll(adminProductSpecification(
                normalizedQuery,
                normalizedKeyword,
                categoryIds,
                keywordCategoryIds,
                minPrice,
                maxPrice,
                normalizedStatus), pageRequest);
        return new PageImpl<>(enrichReviewStats(page.getContent()), pageRequest, page.getTotalElements());
    }

    private Specification<Product> adminProductSpecification(ProductListQuery query,
                                                             String normalizedKeyword,
                                                             Set<Long> categoryIds,
                                                             Set<Long> keywordCategoryIds,
                                                             BigDecimal minPrice,
                                                             BigDecimal maxPrice,
                                                             String normalizedStatus) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (normalizedStatus != null) {
                Expression<String> statusExpression = criteriaBuilder.upper(criteriaBuilder.coalesce(root.<String>get("status"), "ACTIVE"));
                predicates.add(criteriaBuilder.equal(statusExpression, normalizedStatus));
            }
            if (categoryIds != null && !categoryIds.isEmpty()) {
                predicates.add(root.get("categoryId").in(categoryIds));
            }
            if (query.getFeatured() != null) {
                predicates.add(criteriaBuilder.equal(root.get("isFeatured"), query.getFeatured()));
            }
            if (Boolean.TRUE.equals(query.getDiscount())) {
                predicates.add(activeDiscountPredicate(criteriaBuilder, root));
            }
            Expression<BigDecimal> effectivePrice = effectivePriceExpression(criteriaBuilder, root);
            if (minPrice != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(effectivePrice, minPrice));
            }
            if (maxPrice != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(effectivePrice, maxPrice));
            }
            addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get("specifications"), query.getPetSizes());
            addSpecificationRefinementPredicates(predicates, criteriaBuilder, root.get("specifications"), query.getMaterials());
            addColorPredicates(predicates, criteriaBuilder, root.get("name"), root.get("specifications"), query.getColors());
            if (normalizedKeyword != null && !normalizedKeyword.isEmpty()) {
                List<Predicate> keywordPredicates = new ArrayList<>();
                recommendationSearchTerms(List.of(normalizedKeyword)).forEach(term -> keywordPredicates.add(criteriaBuilder.or(
                        containsLike(criteriaBuilder, root.get("name"), term),
                        containsLike(criteriaBuilder, root.get("description"), term),
                        containsLike(criteriaBuilder, root.get("brand"), term),
                        containsLike(criteriaBuilder, root.get("tag"), term),
                        containsLike(criteriaBuilder, root.get("specifications"), term))));
                if (keywordCategoryIds != null && !keywordCategoryIds.isEmpty()) {
                    keywordPredicates.add(root.get("categoryId").in(keywordCategoryIds));
                }
                predicates.add(keywordPredicates.isEmpty()
                        ? criteriaBuilder.disjunction()
                        : criteriaBuilder.or(keywordPredicates.toArray(new Predicate[0])));
            }
            applyProductPageRanking(criteriaQuery, criteriaBuilder, root, query.getSort());
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
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
    public Map<String, Long> countDashboardProductSummary() {
        ProductRepository.ProductDashboardCounts counts = productRepository.countDashboardProductCounts();
        Map<String, Long> summary = new LinkedHashMap<>();
        summary.put("totalProducts", dashboardCount(counts == null ? null : counts.getTotalProducts()));
        summary.put("activeProducts", dashboardCount(counts == null ? null : counts.getActiveProducts()));
        summary.put("inactiveProducts", dashboardCount(counts == null ? null : counts.getInactiveProducts()));
        summary.put("pendingProducts", dashboardCount(counts == null ? null : counts.getPendingProducts()));
        summary.put("lowStockProducts", dashboardCount(counts == null ? null : counts.getLowStockProducts()));
        return summary;
    }

    private long dashboardCount(Long value) {
        return value == null ? 0L : value;
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
    public Product mergeProduct(Product existingProduct, Product product) {
        if (existingProduct == null) {
            throw new IllegalArgumentException("Existing product is required");
        }
        if (product == null) {
            throw new IllegalArgumentException("Product payload is required");
        }
        if (product.getName() != null) existingProduct.setName(product.getName());
        if (product.getDescription() != null) existingProduct.setDescription(product.getDescription());
        if (product.getPrice() != null) existingProduct.setPrice(product.getPrice());
        if (product.getImageUrl() != null) existingProduct.setImageUrl(product.getImageUrl());
        if (product.getStock() != null) existingProduct.setStock(product.getStock());
        if (product.getCategoryId() != null) existingProduct.setCategoryId(product.getCategoryId());
        if (product.getIsFeatured() != null) existingProduct.setIsFeatured(product.getIsFeatured());
        if (product.getBrand() != null) existingProduct.setBrand(product.getBrand());
        if (product.getOriginalPrice() != null) existingProduct.setOriginalPrice(product.getOriginalPrice());
        if (product.getDiscount() != null) existingProduct.setDiscount(product.getDiscount());
        if (product.getLimitedTimePrice() != null) existingProduct.setLimitedTimePrice(product.getLimitedTimePrice());
        if (product.getLimitedTimeStartAt() != null) existingProduct.setLimitedTimeStartAt(product.getLimitedTimeStartAt());
        if (product.getLimitedTimeEndAt() != null) existingProduct.setLimitedTimeEndAt(product.getLimitedTimeEndAt());
        if (product.getTag() != null) existingProduct.setTag(product.getTag());
        if (product.getStatus() != null) existingProduct.setStatus(normalizeImportedStatus(product.getStatus()));
        if (product.getImages() != null) existingProduct.setImages(product.getImages());
        if (product.getSpecifications() != null) existingProduct.setSpecifications(product.getSpecifications());
        if (product.getDetailContent() != null) existingProduct.setDetailContent(product.getDetailContent());
        if (product.getVariants() != null) existingProduct.setVariants(product.getVariants());
        if (product.getWarranty() != null) existingProduct.setWarranty(product.getWarranty());
        if (product.getShipping() != null) existingProduct.setShipping(product.getShipping());
        if (product.getFreeShipping() != null) existingProduct.setFreeShipping(product.getFreeShipping());
        if (product.getFreeShippingThreshold() != null) existingProduct.setFreeShippingThreshold(product.getFreeShippingThreshold());
        if (product.getBestSellerRank() != null) existingProduct.setBestSellerRank(product.getBestSellerRank());
        return existingProduct;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Product save(Product product) {
        validateDirectProduct(product);
        Product saved = productRepository.save(product);
        invalidateProductSearchCacheForProduct(saved);
        evictCategoryReferenceCache();
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int updateStatusByIds(List<Long> ids, String status) {
        String normalizedStatus = ProductStatusUtils.normalizeProductStatus(status);
        if (normalizedStatus == null) {
            throw new IllegalArgumentException("status must be one of " + ProductStatusUtils.PRODUCT_STATUSES);
        }
        List<Long> normalizedIds = ids == null
                ? List.of()
                : ids.stream()
                        .filter(id -> id != null && id > 0)
                        .distinct()
                        .collect(Collectors.toList());
        if (normalizedIds.isEmpty()) {
            return 0;
        }
        int updated = productRepository.updateStatusByIdIn(normalizedIds, normalizedStatus);
        clearProductSearchCache();
        evictCategoryReferenceCache();
        return updated;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id) {
        productRepository.deleteById(id);
        invalidateProductSearchCacheForProductId(id);
        evictCategoryReferenceCache();
    }

    @Override
    public List<Product> findByIsFeaturedTrueOrderByIdAsc() {
        return enrichReviewStats(productRepository.findByIsFeaturedTrueOrderByIdAsc());
    }

    @Override
    public List<Product> findPublicFeaturedProducts() {
        return findPublicFeaturedProducts(DEFAULT_FEATURED_PRODUCT_LIMIT);
    }

    @Override
    public List<Product> findPublicFeaturedProducts(int limit) {
        int normalizedLimit = normalizeFeaturedProductLimit(limit);
        return getCachedProducts("featured:public:limit=" + normalizedLimit, () -> enrichReviewStats(productRepository.findPublicFeaturedProducts(PageRequest.of(0, normalizedLimit)).stream()
                .filter(this::isPublicCatalogProduct)
                .filter(this::hasSellableStock)
                .sorted(Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(normalizedLimit)
                .collect(Collectors.toList())));
    }

    @Override
    public List<Product> findDiscountProducts() {
        int limit = legacyProductListLimit("product.discount-list-max-rows", 100, HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT);
        ProductListQuery query = new ProductListQuery();
        query.setPage(0);
        query.setSize(limit);
        query.setDiscount(true);
        query.setSort("discount,desc");
        return getCachedProducts("discount:limit=" + limit, () -> findPublicProductPage(query).getContent());
    }

    private boolean matchesPublicListQuery(Product product,
                                           ProductListQuery query,
                                           String normalizedKeyword,
                                           Map<Long, Category> categoryLookup,
                                           Set<Long> categoryIds,
                                           String normalizedCollection,
                                           Set<Long> collectionCategoryIds,
                                           BigDecimal minPrice,
                                           BigDecimal maxPrice,
                                           String normalizedStatus) {
        if (!isPublicCatalogProduct(product)) {
            return false;
        }
        if (normalizedStatus != null && !ProductStatusUtils.isPublicProduct(product)) {
            return false;
        }
        if (normalizedStatus != null && !"ACTIVE".equals(normalizedStatus)) {
            return false;
        }
        if (!categoryIds.isEmpty() && !categoryIds.contains(product.getCategoryId())) {
            return false;
        }
        if (!matchesPublicCollection(product, normalizedCollection, collectionCategoryIds)) {
            return false;
        }
        if (query.getFeatured() != null && !query.getFeatured().equals(Boolean.TRUE.equals(product.getIsFeatured()))) {
            return false;
        }
        if (Boolean.TRUE.equals(query.getDiscount()) && !hasActiveDiscount(product)) {
            return false;
        }
        if (!matchesCatalogRefinements(product, query)) {
            return false;
        }
        BigDecimal price = effectivePrice(product);
        if (minPrice != null && (price == null || price.compareTo(minPrice) < 0)) {
            return false;
        }
        if (maxPrice != null && (price == null || price.compareTo(maxPrice) > 0)) {
            return false;
        }
        return normalizedKeyword == null || normalizedKeyword.isEmpty()
                || matchesNormalizedKeyword(product, normalizedKeyword, categoryLookup);
    }

    private boolean matchesAdminListQuery(Product product,
                                          ProductListQuery query,
                                          String normalizedKeyword,
                                          Map<Long, Category> categoryLookup,
                                          Set<Long> categoryIds,
                                          BigDecimal minPrice,
                                          BigDecimal maxPrice,
                                          String normalizedStatus) {
        if (product == null) {
            return false;
        }
        if (normalizedStatus != null) {
            String productStatus = product.getStatus() == null ? "ACTIVE" : product.getStatus().trim().toUpperCase(Locale.ROOT);
            if (!normalizedStatus.equals(productStatus)) {
                return false;
            }
        }
        if (!categoryIds.isEmpty() && !categoryIds.contains(product.getCategoryId())) {
            return false;
        }
        if (query.getFeatured() != null && !query.getFeatured().equals(Boolean.TRUE.equals(product.getIsFeatured()))) {
            return false;
        }
        if (Boolean.TRUE.equals(query.getDiscount()) && !hasActiveDiscount(product)) {
            return false;
        }
        if (!matchesCatalogRefinements(product, query)) {
            return false;
        }
        BigDecimal price = effectivePrice(product);
        if (minPrice != null && (price == null || price.compareTo(minPrice) < 0)) {
            return false;
        }
        if (maxPrice != null && (price == null || price.compareTo(maxPrice) > 0)) {
            return false;
        }
        return normalizedKeyword == null || normalizedKeyword.isEmpty()
                || matchesNormalizedKeyword(product, normalizedKeyword, categoryLookup);
    }

    private boolean hasActiveDiscount(Product product) {
        Integer effectiveDiscount = product.getEffectiveDiscountPercent();
        return effectiveDiscount != null && effectiveDiscount > 0
                || product.getDiscount() != null && product.getDiscount() > 0
                || product.isActiveLimitedTimeDiscount();
    }

    private boolean matchesCatalogRefinements(Product product, ProductListQuery query) {
        String specText = productSpecificationText(product);
        if (!matchesAnyRefinement(specText, query.getPetSizes())) {
            return false;
        }
        if (!matchesAnyRefinement(specText, query.getMaterials())) {
            return false;
        }
        String colorText = (safeLower(product == null ? null : product.getName()) + " " + specText).trim();
        return matchesAnyRefinement(colorText, query.getColors());
    }

    private String normalizePublicCollection(String collection) {
        if (collection == null || collection.isBlank()) {
            return null;
        }
        String normalized = collection.trim().toLowerCase(Locale.ROOT);
        return SMART_DEVICES_COLLECTION.equals(normalized) ? normalized : null;
    }

    private Set<Long> smartDeviceCollectionCategoryIds(String normalizedCollection) {
        return SMART_DEVICES_COLLECTION.equals(normalizedCollection)
                ? SMART_DEVICE_COLLECTION_CATEGORY_IDS
                : Set.of();
    }

    private boolean matchesPublicCollection(Product product, String normalizedCollection, Set<Long> collectionCategoryIds) {
        if (!SMART_DEVICES_COLLECTION.equals(normalizedCollection)) {
            return true;
        }
        if (product == null) {
            return false;
        }
        if (collectionCategoryIds != null && collectionCategoryIds.contains(product.getCategoryId())) {
            return true;
        }
        String text = String.join(" ",
                stringValue(safeLower(product.getName())),
                stringValue(safeLower(product.getDescription())),
                stringValue(safeLower(product.getBrand())),
                stringValue(safeLower(product.getTag())),
                productSpecificationText(product)).trim();
        return SMART_DEVICE_COLLECTION_TERMS.stream().anyMatch(text::contains);
    }

    private boolean matchesAnyRefinement(String haystack, List<String> values) {
        List<String> normalizedValues = normalizeRefinementValues(values);
        if (normalizedValues.isEmpty()) {
            return true;
        }
        String normalizedHaystack = haystack == null ? "" : haystack;
        return normalizedValues.stream().anyMatch(normalizedHaystack::contains);
    }

    private List<String> normalizeRefinementValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .map(this::safeLower)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .limit(12)
                .collect(Collectors.toList());
    }

    private String productSpecificationText(Product product) {
        if (product == null) {
            return "";
        }
        return product.getPublicSpecificationsMap().entrySet().stream()
                .flatMap(entry -> Arrays.asList(entry.getKey(), entry.getValue()).stream())
                .map(this::safeLower)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private String safeLower(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private Comparator<Product> productListComparator(String sort) {
        SortSpec sortSpec = parseProductSort(sort);
        Comparator<Product> comparator;
        switch (sortSpec.field) {
            case "conversion":
            case "personalized":
                comparator = Comparator.comparingInt(this::productConversionScore);
                break;
            case "quickadd":
                comparator = Comparator
                        .comparingInt((Product product) -> isQuickAddReady(product) ? 1 : 0)
                        .thenComparingInt(this::productConversionScore);
                break;
            case "bestvalue":
                comparator = Comparator
                        .comparingInt(this::bestValueRank)
                        .thenComparing(this::savingsAmount, Comparator.nullsLast(BigDecimal::compareTo))
                        .thenComparingInt(this::productConversionScore);
                break;
            case "lowstock":
                comparator = Comparator
                        .comparingInt(this::lowStockUrgencyScore)
                        .thenComparingInt(this::productConversionScore);
                break;
            case "price":
                comparator = Comparator.comparing(this::effectivePrice, Comparator.nullsLast(BigDecimal::compareTo));
                break;
            case "name":
                comparator = Comparator.comparing(product -> normalizeSortText(product.getName()), Comparator.nullsLast(String::compareTo));
                break;
            case "createdat":
            case "created":
                comparator = Comparator.comparing(Product::getCreatedAt, Comparator.nullsLast(LocalDateTime::compareTo));
                break;
            case "updatedat":
            case "updated":
                comparator = Comparator.comparing(Product::getUpdatedAt, Comparator.nullsLast(LocalDateTime::compareTo));
                break;
            case "discount":
                comparator = Comparator.comparing(this::productDiscountPercent, Comparator.nullsLast(Integer::compareTo));
                break;
            case "rating":
            case "averagerating":
                comparator = Comparator.comparing(Product::getAverageRating, Comparator.nullsLast(BigDecimal::compareTo));
                break;
            case "reviews":
            case "reviewcount":
                comparator = Comparator.comparing(Product::getReviewCount, Comparator.nullsLast(Long::compareTo));
                break;
            case "stock":
                comparator = Comparator.comparing(Product::getStock, Comparator.nullsLast(Integer::compareTo));
                break;
            case "featured":
                comparator = Comparator.comparing(product -> Boolean.TRUE.equals(product.getIsFeatured()));
                break;
            case "id":
            default:
                comparator = Comparator.comparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder()));
                break;
        }
        if (sortSpec.descending) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(Product::getId, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    private int productConversionScore(Product product) {
        if (product == null) {
            return Integer.MIN_VALUE;
        }
        int score = hasSellableStock(product) ? 120 : -300;
        if (Boolean.TRUE.equals(product.getIsFeatured())) score += 34;
        if (hasActiveDiscount(product)) score += 28 + Math.min(40, productDiscountPercent(product));
        if (Boolean.TRUE.equals(product.getFreeShipping())) score += 12;
        if (isQuickAddReady(product)) score += 22;
        BigDecimal savings = savingsAmount(product);
        if (savings != null && savings.compareTo(BigDecimal.ZERO) > 0) {
            score += Math.min(36, savings.divide(BigDecimal.valueOf(10), 0, RoundingMode.DOWN).intValue());
        }
        BigDecimal positiveRate = product.getPositiveRate();
        if (positiveRate != null && positiveRate.compareTo(BigDecimal.ZERO) > 0) {
            score += Math.min(24, positiveRate.divide(BigDecimal.valueOf(4), 0, RoundingMode.HALF_UP).intValue());
        }
        Long reviewCount = product.getReviewCount();
        if (reviewCount != null && reviewCount > 0) {
            score += Math.min(18, reviewCount.intValue() / 3);
        }
        return score;
    }

    private int bestValueRank(Product product) {
        if (product == null) {
            return 0;
        }
        int discount = productDiscountPercent(product);
        BigDecimal positiveRate = product.getPositiveRate() == null ? BigDecimal.ZERO : product.getPositiveRate();
        long reviewCount = product.getReviewCount() == null ? 0 : product.getReviewCount();
        return discount >= 15 && positiveRate.compareTo(BigDecimal.valueOf(88)) >= 0 && reviewCount >= 3 ? 1 : 0;
    }

    private int lowStockUrgencyScore(Product product) {
        Integer stock = product == null ? null : product.getStock();
        if (stock == null || stock <= 0 || stock > 5) {
            return 0;
        }
        return 100 - stock;
    }

    private BigDecimal savingsAmount(Product product) {
        if (product == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal price = effectivePrice(product);
        BigDecimal originalPrice = product.getOriginalPrice();
        if (price == null || originalPrice == null || originalPrice.compareTo(price) <= 0) {
            return BigDecimal.ZERO;
        }
        return originalPrice.subtract(price);
    }

    private SortSpec parseProductSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return new SortSpec("conversion", true);
        }
        String normalized = sort.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        String field = normalized;
        boolean descending = false;
        int commaIndex = normalized.indexOf(',');
        if (commaIndex >= 0) {
            field = normalized.substring(0, commaIndex).trim();
            String direction = normalized.substring(commaIndex + 1).trim();
            descending = "desc".equals(direction) || "descending".equals(direction);
        } else if (normalized.endsWith("-desc")) {
            field = normalized.substring(0, normalized.length() - 5);
            descending = true;
        } else if (normalized.endsWith("-asc")) {
            field = normalized.substring(0, normalized.length() - 4);
        }
        field = field.replace("-", "");
        if (field.isEmpty() || "default".equals(field) || "recommended".equals(field)) {
            return new SortSpec("conversion", true);
        }
        if ("newest".equals(field)) {
            return new SortSpec("createdat", true);
        }
        if ("oldest".equals(field)) {
            return new SortSpec("createdat", false);
        }
        if ("positiverate".equals(field)) {
            return new SortSpec("rating", descending);
        }
        if ("lowstock".equals(field)) {
            return new SortSpec("lowstock", true);
        }
        if ("quickadd".equals(field) || "bestvalue".equals(field) || "personalized".equals(field)) {
            return new SortSpec(field, true);
        }
        return new SortSpec(field, descending);
    }

    private int normalizeProductPage(Integer page) {
        return page == null ? 0 : Math.max(0, page);
    }

    private int normalizeProductPageSize(Integer size) {
        int normalizedSize = size == null ? runtimeConfig.getInt("product.public-default-page-size", 20) : size;
        int maxPageSize = Math.max(1, Math.min(
                runtimeConfig.getInt("product.public-max-page-size", HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT),
                HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT));
        if (normalizedSize <= 0) {
            normalizedSize = runtimeConfig.getInt("product.public-default-page-size", 20);
        }
        return Math.max(1, Math.min(normalizedSize, maxPageSize));
    }

    private int normalizeAdminProductPageSize(Integer size) {
        int defaultSize = runtimeConfig.getInt("product.admin-default-page-size", 50);
        int normalizedSize = size == null ? defaultSize : size;
        int maxPageSize = Math.max(1, Math.min(
                runtimeConfig.getInt("product.admin-max-page-size", HARD_ADMIN_PRODUCT_PAGE_SIZE_LIMIT),
                HARD_ADMIN_PRODUCT_PAGE_SIZE_LIMIT));
        if (normalizedSize <= 0) {
            normalizedSize = defaultSize;
        }
        return Math.max(1, Math.min(normalizedSize, maxPageSize));
    }

    private int normalizeFeaturedProductLimit(int limit) {
        int normalizedLimit = limit <= 0 ? DEFAULT_FEATURED_PRODUCT_LIMIT : limit;
        int maxLimit = Math.max(1, runtimeConfig.getInt("product.featured-max-limit", MAX_FEATURED_PRODUCT_LIMIT));
        return Math.max(1, Math.min(normalizedLimit, Math.min(maxLimit, MAX_FEATURED_PRODUCT_LIMIT)));
    }

    private int legacyProductListLimit(String configKey, int fallback, int hardLimit) {
        int configured = runtimeConfig.getInt(configKey, fallback);
        int rawLimit = configured <= 0 ? fallback : configured;
        return Math.max(1, Math.min(rawLimit, hardLimit));
    }

    private BigDecimal normalizeMinPrice(BigDecimal minPrice) {
        if (minPrice == null) {
            return null;
        }
        if (minPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("minPrice must be greater than or equal to 0");
        }
        return minPrice;
    }

    private BigDecimal normalizeMaxPrice(BigDecimal maxPrice) {
        if (maxPrice == null) {
            return null;
        }
        if (maxPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("maxPrice must be greater than or equal to 0");
        }
        return maxPrice;
    }

    private String normalizePublicStatusFilter(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = ProductStatusUtils.normalizeProductStatus(status);
        if (normalized == null) {
            throw new IllegalArgumentException("status must be one of " + ProductStatusUtils.PRODUCT_STATUSES);
        }
        return normalized;
    }

    private String productListCacheKey(ProductListQuery query, String normalizedKeyword) {
        return "public:list:"
                + "kw=" + normalizedKeyword
                + ":category=" + stringValue(query.getCategoryId())
                + ":includeChildren=" + stringValue(query.getIncludeChildren())
                + ":discount=" + query.getDiscount()
                + ":featured=" + query.getFeatured()
                + ":min=" + moneyKey(query.getMinPrice())
                + ":max=" + moneyKey(query.getMaxPrice())
                + ":petSizes=" + listKey(query.getPetSizes())
                + ":materials=" + listKey(query.getMaterials())
                + ":colors=" + listKey(query.getColors())
                + ":collection=" + normalizeCacheText(normalizePublicCollection(query.getCollection()))
                + ":status=" + normalizeCacheText(query.getStatus())
                + ":page=" + stringValue(query.getPage())
                + ":size=" + stringValue(query.getSize())
                + ":sort=" + normalizeCacheText(query.getSort());
    }

    private Integer productDiscountPercent(Product product) {
        Integer effectiveDiscount = product.getEffectiveDiscountPercent();
        if (effectiveDiscount != null && effectiveDiscount > 0) {
            return effectiveDiscount;
        }
        return product.getDiscount() == null ? 0 : product.getDiscount();
    }

    private String normalizeSortText(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeCacheText(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String moneyKey(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private String listKey(List<String> values) {
        return normalizeRefinementValues(values).stream().collect(Collectors.joining(","));
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
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

        int candidateWindow = recommendationCandidateWindow(normalizedLimit, 80);
        return enrichReviewStats(productRepository.findPublicAddOnCandidateWindow(
                        floor,
                        ceiling,
                        normalizedTarget,
                        PageRequest.of(0, candidateWindow))
                .stream()
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
        ProductListQuery query = new ProductListQuery();
        query.setKeyword(keyword);
        query.setCategoryId(categoryId);
        query.setPage(0);
        int legacySearchLimit = normalizeProductPageSize(
                runtimeConfig.getInt("product.search-legacy-max-results", HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT));
        query.setSize(legacySearchLimit);
        String normalizedKeyword = normalizeSearchText(query.getKeyword());
        String cacheKey = "search:" + (categoryId == null ? "all" : categoryId)
                + ":limit=" + legacySearchLimit
                + ":" + normalizedKeyword;
        return getCachedProducts(cacheKey, () -> findPublicProductPageUncached(query, normalizedKeyword).getContent());
    }

    @Override
    public List<Product> findFinderCandidates(List<String> keywords, int limit) {
        List<String> normalizedKeywords = keywords == null
                ? List.of()
                : keywords.stream()
                .map(this::normalizeSearchText)
                .filter(keyword -> !keyword.isEmpty())
                .distinct()
                .limit(12)
                .collect(Collectors.toList());
        int normalizedLimit = Math.max(1, Math.min(limit <= 0 ? 36 : limit, 60));
        String cacheKey = "finder:" + normalizedLimit + ":" + String.join(",", normalizedKeywords);
        return getCachedProducts(cacheKey, () -> findFinderCandidatesUncached(normalizedKeywords, normalizedLimit));
    }

    private List<Product> findFinderCandidatesUncached(List<String> normalizedKeywords, int normalizedLimit) {
        int candidateWindow = recommendationCandidateWindow(normalizedLimit, 180);
        List<Product> candidates = boundedRecommendationCandidates(normalizedKeywords, candidateWindow);
        Map<Long, Category> categories = loadCategoryLookupForProducts(candidates);
        enrichReviewStats(candidates);
        return candidates.stream()
                .map(product -> new ProductScore(product, scoreFinderCandidate(product, normalizedKeywords, categories)))
                .filter(entry -> normalizedKeywords.isEmpty() || entry.score > 0)
                .sorted(Comparator
                        .comparingInt((ProductScore entry) -> entry.score).reversed()
                        .thenComparing(entry -> effectivePrice(entry.product))
                        .thenComparing(entry -> entry.product.getId(), Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(normalizedLimit)
                .map(entry -> entry.product)
                .collect(Collectors.toList());
    }

    private List<Product> boundedRecommendationCandidates(List<String> normalizedKeywords, int candidateWindow) {
        Map<Long, Product> byId = new LinkedHashMap<>();
        List<String> terms = recommendationSearchTerms(normalizedKeywords);
        for (String term : terms) {
            productRepository.findPublicKeywordCandidateWindow(escapeLikeTerm(term), PageRequest.of(0, candidateWindow)).stream()
                    .filter(product -> product.getId() != null)
                    .forEach(product -> byId.putIfAbsent(product.getId(), product));
            if (byId.size() >= candidateWindow) {
                break;
            }
        }
        if (byId.size() < candidateWindow) {
            productRepository.findPublicSellableCandidateWindow(PageRequest.of(0, candidateWindow)).stream()
                    .filter(product -> product.getId() != null)
                    .forEach(product -> byId.putIfAbsent(product.getId(), product));
        }
        return byId.values().stream()
                .filter(this::isPublicCatalogProduct)
                .filter(this::hasSellableStock)
                .limit(candidateWindow)
                .collect(Collectors.toList());
    }

    private int recommendationCandidateWindow(int responseLimit, int defaultWindow) {
        int configuredWindow = runtimeConfig.getInt("product.recommendation-candidate-window", defaultWindow);
        int minimumWindow = Math.max(responseLimit, responseLimit * 4);
        int boundedWindow = configuredWindow <= 0 ? defaultWindow : configuredWindow;
        return Math.max(minimumWindow, Math.min(Math.max(boundedWindow, minimumWindow), 300));
    }

    private List<String> recommendationSearchTerms(List<String> normalizedKeywords) {
        if (normalizedKeywords == null || normalizedKeywords.isEmpty()) {
            return List.of();
        }
        Set<String> terms = new LinkedHashSet<>();
        for (String keyword : normalizedKeywords) {
            String normalized = normalizeSearchText(keyword);
            if (normalized.isEmpty()) {
                continue;
            }
            terms.add(normalized);
            Arrays.stream(normalized.split("\\s+"))
                    .filter(token -> token.length() > 1)
                    .flatMap(token -> expandSearchToken(token).stream())
                    .forEach(terms::add);
            if (terms.size() >= 12) {
                break;
            }
        }
        return terms.stream()
                .filter(term -> term != null && !term.isBlank())
                .limit(12)
                .collect(Collectors.toList());
    }

    private List<String> personalizedCandidateTerms(List<PetProfile> pets) {
        Set<String> terms = new LinkedHashSet<>();
        for (PetProfile pet : pets) {
            String petType = normalize(pet.getPetType());
            if ("DOG".equals(petType)) {
                terms.addAll(List.of("dog", "puppy"));
            } else if ("CAT".equals(petType)) {
                terms.addAll(List.of("cat", "kitten"));
            } else if ("SMALL_PET".equals(petType)) {
                terms.addAll(List.of("small pet", "rabbit", "hamster"));
            }
            String size = normalizeSearchText(pet.getSize());
            if (!size.isEmpty()) {
                terms.add(size);
            }
            String breed = normalizeSearchText(pet.getBreed());
            if (!breed.isEmpty()) {
                terms.add(breed);
            }
            if (terms.size() >= 12) {
                break;
            }
        }
        return terms.stream().limit(12).collect(Collectors.toList());
    }

    private int personalizedPetProfileLimit() {
        return legacyProductListLimit("pet-profile.max-per-user", 10, 50);
    }

    private Map<Long, Category> loadCategoryLookupForProducts(List<Product> products) {
        Map<Long, Category> lookup = new LinkedHashMap<>();
        Set<Long> pendingIds = products == null
                ? new LinkedHashSet<>()
                : products.stream()
                .map(Product::getCategoryId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        int depth = 0;
        while (!pendingIds.isEmpty() && depth < 8) {
            List<Long> ids = new ArrayList<>(pendingIds);
            pendingIds.clear();
            categoryRepository.findAllById(ids).forEach(category -> {
                if (category == null || category.getId() == null || lookup.containsKey(category.getId())) {
                    return;
                }
                lookup.put(category.getId(), category);
                Long parentId = category.getParentId();
                if (parentId != null && parentId > 0 && !lookup.containsKey(parentId)) {
                    pendingIds.add(parentId);
                }
            });
            depth++;
        }
        return lookup;
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
        List<PetProfile> pets = petProfileMapper.findByUserId(userId, personalizedPetProfileLimit());
        if (pets == null || pets.isEmpty()) {
            return List.of();
        }
        int candidateWindow = recommendationCandidateWindow(12, 160);
        List<Product> products = boundedRecommendationCandidates(personalizedCandidateTerms(pets), candidateWindow);
        Map<Long, Category> categories = loadCategoryLookupForProducts(products);

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
    @Transactional(rollbackFor = Exception.class)
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
                importRows.stream()
                        .map(this::saveImportRow)
                        .forEach(this::invalidateProductSearchCacheForProduct);
                result.setApplied(true);
                evictCategoryReferenceCache();
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
        } catch (NoTransactionException ex) {
            log.debug("No active transaction to mark rollback-only during product import; reason={}", ex.getMessage());
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

    private Product saveImportRow(ProductImportRow row) {
        if (row.existingProduct != null) {
            mergeForImport(row.existingProduct, row.importedProduct, row.updateFields);
            return productRepository.save(row.existingProduct);
        }
        row.importedProduct.setId(null);
        return productRepository.save(row.importedProduct);
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
        product.setBestSellerRank(parseInteger(importValue(values, headerIndex, "bestSellerRank", -1), false, "bestSellerRank"));
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
        requireLength(product.getName(), 200, "name");
        requireLength(product.getDescription(), 1000, "description");
        requireLength(product.getBrand(), 120, "brand");
        requireLength(product.getTag(), 80, "tag");
        requireLength(product.getWarranty(), 500, "warranty");
        requireLength(product.getShipping(), 500, "shipping");
        requireNonNegative(product.getPrice(), "price");
        requireNonNegative(product.getOriginalPrice(), "originalPrice");
        requireNonNegative(product.getLimitedTimePrice(), "limitedTimePrice");
        requireNonNegative(product.getFreeShippingThreshold(), "freeShippingThreshold");
        if (product.getBestSellerRank() != null && product.getBestSellerRank() < 0) {
            throw new IllegalArgumentException("bestSellerRank must be greater than or equal to 0");
        }
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
        product.setImageUrl(normalizeImportImageUrl(product.getImageUrl(), "imageUrl"));
        product.setImages(normalizeImportImageList(product.getImages()));
        validateImportSpecifications(product.getSpecifications());
        product.setDetailContent(normalizeImportDetailContent(product.getDetailContent()));
        product.setVariants(normalizeImportVariants(product.getVariants()));
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
        String normalizedName = normalizeImportText(name);
        Long currentId = existing == null ? null : existing.getId();
        boolean duplicate = currentId == null
                ? productRepository.existsByCategoryIdAndNameIgnoreCase(categoryId, normalizedName)
                : productRepository.existsByCategoryIdAndNameIgnoreCaseAndIdNot(categoryId, normalizedName, currentId);
        if (duplicate) {
            throw new IllegalArgumentException("name already exists in this category: " + normalizedName);
        }
    }

    private void validateDirectProduct(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Product payload is required");
        }
        product.setName(normalizeDirectText(product.getName(), "name", 200, true));
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
        requirePositive(product.getPrice(), "price");
        validateImportMoneyAmount(product.getPrice(), "price");
        validateImportMoneyAmount(product.getOriginalPrice(), "originalPrice");
        validateImportMoneyAmount(product.getLimitedTimePrice(), "limitedTimePrice");
        validateImportMoneyAmount(product.getFreeShippingThreshold(), "freeShippingThreshold");
        if (product.getBestSellerRank() != null && product.getBestSellerRank() < 0) {
            throw new IllegalArgumentException("bestSellerRank must be greater than or equal to 0");
        }
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
        product.setImageUrl(normalizeImportImageUrl(product.getImageUrl(), "imageUrl"));
        product.setImages(normalizeImportImageList(product.getImages()));
        validateImportSpecifications(product.getSpecifications());
        product.setDetailContent(normalizeImportDetailContent(product.getDetailContent()));
        product.setVariants(normalizeImportVariants(product.getVariants()));
    }

    private String normalizeDirectText(String value, String field, int maxLength, boolean required) {
        String normalized = value == null ? null : stripHtml(value)
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

    private String stripHtml(String value) {
        String stripped = HTML_COMMENT_PATTERN.matcher(value == null ? "" : value).replaceAll(" ");
        String previous;
        do {
            previous = stripped;
            stripped = HTML_BLOCK_PATTERN.matcher(stripped).replaceAll(" ");
        } while (!previous.equals(stripped));
        stripped = HTML_TAG_PATTERN.matcher(stripped).replaceAll(" ");
        return decodeCommonHtmlEntities(stripped);
    }

    private String decodeCommonHtmlEntities(String value) {
        return value
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'");
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

    private void requirePositive(BigDecimal value, String field) {
        if (value != null && value.compareTo(BigDecimal.ZERO) <= 0) {
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

    private String normalizeImportImageList(String images) {
        if (images == null || images.isBlank()) {
            return null;
        }
        try {
            List<String> urls = OBJECT_MAPPER.readValue(images, new TypeReference<List<String>>() {});
            if (urls.size() > 8) {
                throw new IllegalArgumentException("images must include 8 URLs or fewer");
            }
            List<String> normalizedUrls = new ArrayList<>();
            for (String url : urls) {
                String normalizedUrl = normalizeImportImageUrl(url, "images");
                if (normalizedUrl != null) {
                    normalizedUrls.add(normalizedUrl);
                }
            }
            return normalizedUrls.isEmpty() ? null : OBJECT_MAPPER.writeValueAsString(normalizedUrls);
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

    private String normalizeImportDetailContent(String value) {
        JsonNode blocks = validateImportJsonArray(value, "detailContent", 24);
        if (blocks == null) {
            return null;
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
            ((ObjectNode) block).put("url", normalizeImportImageUrl(url, "detailContent"));
        }
        return writeNormalizedJsonArray(blocks, "detailContent");
    }

    private String normalizeImportVariants(String value) {
        JsonNode variants = validateImportJsonArray(value, "variants", 200);
        if (variants == null) {
            return null;
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
            String normalizedImageUrl = normalizeImportImageUrl(jsonText(variant.get("imageUrl")), "variants");
            if (normalizedImageUrl == null) {
                ((ObjectNode) variant).remove("imageUrl");
            } else {
                ((ObjectNode) variant).put("imageUrl", normalizedImageUrl);
            }
        }
        return writeNormalizedJsonArray(variants, "variants");
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
        Map<String, Set<Long>> owners = new LinkedHashMap<>();
        int pageSize = legacyProductListLimit("product.import.variant-sku-scan-page-size", 500, 1_000);
        int maxRows = legacyProductListLimit(
                "product.import.variant-sku-scan-max-rows",
                HARD_PRODUCT_IMPORT_VARIANT_SCAN_ROWS,
                HARD_PRODUCT_IMPORT_VARIANT_SCAN_ROWS);
        int scannedRows = 0;
        for (int page = 0; scannedRows < maxRows; page++) {
            List<Object[]> rows = productRepository.findVariantSkuOwnerRows(PageRequest.of(page, pageSize));
            if (rows == null || rows.isEmpty()) {
                break;
            }
            for (Object[] row : rows) {
                scannedRows++;
                registerVariantSkuOwnerRow(row, owners);
                if (scannedRows >= maxRows) {
                    break;
                }
            }
            if (rows.size() < pageSize) {
                break;
            }
        }
        return owners;
    }

    private void registerVariantSkuOwnerRow(Object[] row, Map<String, Set<Long>> owners) {
        if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
            return;
        }
        Long productId = row[0] instanceof Number
                ? ((Number) row[0]).longValue()
                : parseLong(String.valueOf(row[0]), false, "id");
        String variantJson = String.valueOf(row[1]);
        if (productId == null || productId <= 0 || variantJson.isBlank()) {
            return;
        }
        try {
            JsonNode variants = OBJECT_MAPPER.readTree(variantJson);
            if (variants == null || !variants.isArray()) {
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
                owners.computeIfAbsent(normalizeImportSkuKey(sku), ignored -> new LinkedHashSet<>()).add(productId);
            }
        } catch (Exception ex) {
            log.debug("Skipping malformed variant data while collecting SKU owners for product {}; reason={}",
                    productId, ex.getMessage());
        }
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

    private String normalizeImportImageUrl(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String url = value.trim();
        if (url.length() > MAX_IMPORT_IMAGE_URL_LENGTH) {
            throw new IllegalArgumentException(field + " is too long");
        }
        return ImageUrlValidator.normalizePersistentImageUrl(url, field);
    }

    private String writeNormalizedJsonArray(JsonNode node, String field) {
        try {
            return OBJECT_MAPPER.writeValueAsString(node);
        } catch (Exception ex) {
            throw new IllegalArgumentException(field + " must be a valid JSON array");
        }
    }

    private String importFieldFromException(Exception ex) {
        String message = ex.getMessage();
        if (message == null) {
            return null;
        }
        for (String field : List.of(
                "id", "name", "description", "price", "stock", "categoryId", "categoryName", "imageUrl",
                "brand", "originalPrice", "discount", "limitedTimePrice", "limitedTimeStartAt",
                "limitedTimeEndAt", "tag", "status", "isFeatured", "freeShipping", "freeShippingThreshold", "bestSellerRank", "images",
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
        if (updateFields.contains("bestSellerRank")) {
            existing.setBestSellerRank(imported.getBestSellerRank());
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
        collectCategoryIds(id, ids, 1);
        return ids;
    }

    private Set<Long> selectedCategoryIds(ProductListQuery query) {
        if (query == null || query.getCategoryId() == null) {
            return Set.of();
        }
        if (Boolean.FALSE.equals(query.getIncludeChildren())) {
            return Set.of(query.getCategoryId());
        }
        return new LinkedHashSet<>(collectCategoryIds(query.getCategoryId()));
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

    private int scoreFinderCandidate(Product product, List<String> normalizedKeywords, Map<Long, Category> categories) {
        String searchable = productSearchText(product, categories);
        int score = 0;
        if (normalizedKeywords == null || normalizedKeywords.isEmpty()) {
            score += 20;
        } else {
            for (String keyword : normalizedKeywords) {
                if (keyword == null || keyword.isBlank()) {
                    continue;
                }
                if (searchable.contains(keyword)) {
                    score += 36;
                    continue;
                }
                List<String> tokens = Arrays.stream(keyword.split("\\s+"))
                        .filter(token -> token.length() > 1)
                        .collect(Collectors.toList());
                if (tokens.isEmpty()) {
                    continue;
                }
                long tokenHits = tokens.stream()
                        .filter(token -> matchesSearchToken(searchable, token))
                        .count();
                if (tokenHits == tokens.size()) {
                    score += 24;
                } else if (tokenHits > 0) {
                    score += (int) tokenHits * 10;
                }
            }
        }
        if (score <= 0 && normalizedKeywords != null && !normalizedKeywords.isEmpty()) {
            return 0;
        }

        BigDecimal price = effectivePrice(product);
        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
            score += price.compareTo(BigDecimal.valueOf(80)) <= 0 ? 8 : 4;
        }
        if (Boolean.TRUE.equals(product.getIsFeatured())) {
            score += 12;
        }
        Integer discount = product.getEffectiveDiscountPercent();
        if (discount != null && discount > 0) {
            score += Math.min(18, discount / 2);
        } else if (product.getDiscount() != null && product.getDiscount() > 0) {
            score += Math.min(12, product.getDiscount() / 2);
        }
        BigDecimal averageRating = product.getAverageRating();
        if (averageRating != null && averageRating.compareTo(BigDecimal.ZERO) > 0) {
            score += Math.min(20, averageRating.multiply(BigDecimal.valueOf(3)).setScale(0, RoundingMode.HALF_UP).intValue());
        }
        Long reviewCount = product.getReviewCount();
        if (reviewCount != null && reviewCount > 0) {
            score += Math.min(10, reviewCount.intValue() / 20);
        }
        return score;
    }

    private boolean isPublicCatalogProduct(Product product) {
        if (!ProductStatusUtils.isPublicProduct(product)) {
            return false;
        }
        if (isBlank(product.getName()) || product.getPrice() == null || product.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
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

    private static class SortSpec {
        private final String field;
        private final boolean descending;

        private SortSpec(String field, boolean descending) {
            this.field = field;
            this.descending = descending;
        }

        private boolean requiresCriteriaRanking() {
            return "conversion".equals(field)
                    || "quickadd".equals(field)
                    || "bestvalue".equals(field)
                    || "lowstock".equals(field)
                    || "personalized".equals(field);
        }
    }

    private void collectCategoryIds(Long id, List<Long> ids, int depth) {
        if (id == null || depth > MAX_CATEGORY_TREE_DEPTH) {
            return;
        }
        ids.add(id);
        if (depth == MAX_CATEGORY_TREE_DEPTH) {
            return;
        }
        categoryRepository.findByParentId(id).forEach(child -> collectCategoryIds(child.getId(), ids, depth + 1));
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

    private String escapeLikeTerm(String term) {
        if (term == null || term.isEmpty()) {
            return "";
        }
        return term
                .replace(String.valueOf(LIKE_ESCAPE_CHAR), String.valueOf(LIKE_ESCAPE_CHAR) + LIKE_ESCAPE_CHAR)
                .replace("%", LIKE_ESCAPE_CHAR + "%")
                .replace("_", LIKE_ESCAPE_CHAR + "_");
    }

    private String containsLikePattern(String term) {
        return "%" + escapeLikeTerm(term) + "%";
    }

    private Predicate containsLike(CriteriaBuilder criteriaBuilder, Expression<String> expression, String term) {
        return criteriaBuilder.like(
                criteriaBuilder.lower(criteriaBuilder.coalesce(expression, "")),
                containsLikePattern(term),
                LIKE_ESCAPE_CHAR);
    }

    private List<Product> getCachedProducts(String cacheKey, ProductSearchLoader loader) {
        long searchCacheTtlMs = runtimeConfig.getLong("product.search-cache-ttl-ms", 30000);
        long normalizedTtlMs = Math.max(0, searchCacheTtlMs);
        if (normalizedTtlMs <= 0) {
            return loader.load();
        }
        synchronized (productSearchCacheLock) {
            long now = System.currentTimeMillis();
            ProductSearchCacheEntry cached = productSearchCache.get(cacheKey);
            if (cached != null && now - cached.createdAt <= normalizedTtlMs) {
                return new ArrayList<>(cached.products);
            }
            List<Product> products = loader.load();
            if (productSearchCache.size() >= Math.max(1, runtimeConfig.getInt("product.search-cache-max-entries", 80))) {
                evictOldestProductSearchCacheEntry();
            }
            productSearchCache.put(cacheKey, new ProductSearchCacheEntry(now, new ArrayList<>(products)));
            return products;
        }
    }

    private void invalidateProductSearchCacheForProduct(Product product) {
        if (product == null) {
            return;
        }
        invalidateProductSearchCache(product.getId(), product.getCategoryId(),
                Boolean.TRUE.equals(product.getIsFeatured()), hasActiveDiscount(product), isPublicCatalogProduct(product));
    }

    private void invalidateProductSearchCacheForProductId(Long productId) {
        invalidateProductSearchCache(productId, null, false, false, false);
    }

    private void invalidateProductSearchCache(Long productId,
                                              Long categoryId,
                                              boolean featuredCandidate,
                                              boolean discountCandidate,
                                              boolean publicCandidate) {
        if (productId == null && categoryId == null && !featuredCandidate && !discountCandidate && !publicCandidate) {
            return;
        }
        synchronized (productSearchCacheLock) {
            productSearchCache.entrySet().removeIf(entry -> shouldInvalidateProductSearchCacheEntry(
                    entry.getKey(), entry.getValue(), productId, categoryId, featuredCandidate, discountCandidate,
                    publicCandidate));
        }
    }

    private boolean shouldInvalidateProductSearchCacheEntry(String cacheKey,
                                                            ProductSearchCacheEntry entry,
                                                            Long productId,
                                                            Long categoryId,
                                                            boolean featuredCandidate,
                                                            boolean discountCandidate,
                                                            boolean publicCandidate) {
        if (productId != null && (entry.containsProductId(productId) || cacheKey.startsWith("related:" + productId + ":"))) {
            return true;
        }
        if (categoryId != null && cacheKey.startsWith("related:") && cacheKey.endsWith(":" + categoryId)) {
            return true;
        }
        if (featuredCandidate && cacheKey.startsWith("featured:")) {
            return true;
        }
        if (discountCandidate && (cacheKey.startsWith("discount:") || cacheKey.contains(":discount=true"))) {
            return true;
        }
        return publicCandidate && cacheKey.startsWith("add-on:");
    }

    private void clearProductSearchCache() {
        synchronized (productSearchCacheLock) {
            productSearchCache.clear();
        }
    }

    private void evictOldestProductSearchCacheEntry() {
        productSearchCache.entrySet().stream()
                .min(Comparator.comparingLong(entry -> entry.getValue().createdAt))
                .ifPresent(entry -> productSearchCache.remove(entry.getKey(), entry.getValue()));
    }

    private void evictCategoryReferenceCache() {
        if (cacheManager == null) {
            return;
        }
        Cache cache = cacheManager.getCache("categoryReferenceData");
        if (cache != null) {
            cache.clear();
        }
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

        private boolean containsProductId(Long productId) {
            return productId != null && products.stream().anyMatch(product -> productId.equals(product.getId()));
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
                                    reviewStatDecimal(row[3])
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
                            reviewStatDecimal(row[3])
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
        BigDecimal positiveRate = reviewCount == 0
                ? ZERO_REVIEW_STAT
                : BigDecimal.valueOf(positiveCount)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(reviewCount), 1, RoundingMode.HALF_UP);
        product.setReviewCount(reviewCount);
        product.setPositiveRate(positiveRate);
        product.setAverageRating(stats == null ? ZERO_REVIEW_STAT : stats.averageRating);
    }

    private BigDecimal reviewStatDecimal(Object value) {
        if (value == null) {
            return ZERO_REVIEW_STAT;
        }
        if (value instanceof BigDecimal) {
            return ((BigDecimal) value).setScale(1, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(((Number) value).doubleValue()).setScale(1, RoundingMode.HALF_UP);
    }

    private static class ProductReviewStats {
        private final long reviewCount;
        private final long positiveCount;
        private final BigDecimal averageRating;

        private ProductReviewStats(long reviewCount, long positiveCount, BigDecimal averageRating) {
            this.reviewCount = reviewCount;
            this.positiveCount = positiveCount;
            this.averageRating = averageRating;
        }
    }
}
