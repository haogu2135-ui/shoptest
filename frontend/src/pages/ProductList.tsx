import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Row, Col, Button, Input, Select, Pagination, Tag, message, Empty, Spin, Typography, Slider, Checkbox, Modal, Space, Drawer } from 'antd';
import { BarChartOutlined, BellOutlined, CheckCircleOutlined, FireOutlined, FilterOutlined, ReloadOutlined, ShoppingCartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiBaseUrl, productApi, cartApi, categoryApi } from '../api';
import type { Product, Category } from '../types';
import { buildCategoryTree, flattenCategoryTree, getLocalizedCategoryValue } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { localizeProduct } from '../utils/localizedProduct';
import { addGuestCartItem } from '../utils/guestCart';
import { buildBundleSpecs, getBundleInfo } from '../utils/bundle';
import { addCompareProduct, isProductCompared, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { addStockAlert, readStockAlerts, removeStockAlert } from '../utils/stockAlerts';
import { conversionConfig, getLowStockCount } from '../utils/conversionConfig';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { getProductOptionGroups, getProductVariants, optionValueHasVariant, selectCompatibleProductOption } from '../utils/productOptions';
import './ProductList.css';

const { Text } = Typography;
const SEARCH_HISTORY_KEY = 'shop-product-search-history';
const MAX_SEARCH_HISTORY = 6;
const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];
const SMART_DEVICE_CATEGORY_IDS = new Set([10, 11]);
const SMART_DEVICE_TERMS = ['smart', 'automatic', 'feeder', 'feeders', 'fountain', 'waterer', 'waterers', 'camera', 'tracker', 'sensor', 'device', 'connected'];
const productImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveProductListImage = (imageUrl?: string) => {
  if (!imageUrl) return productImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const readSearchHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, MAX_SEARCH_HISTORY) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
};

const productSearchText = (product: Product) => [
  product.name,
  product.description,
  product.brand,
  ...Object.values(product.specifications || {}),
].join(' ').toLowerCase();

const matchesSmartDeviceCollection = (product: Product) => {
  if (SMART_DEVICE_CATEGORY_IDS.has(Number(product.categoryId))) {
    return true;
  }
  const text = productSearchText(product);
  return SMART_DEVICE_TERMS.some((term) => text.includes(term));
};

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined
  );
  const [discount, setDiscount] = useState(searchParams.get('discount') === 'true');
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sort') || 'default');
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [petSizes, setPetSizes] = useState<string[]>(
    searchParams.get('petSize') ? [searchParams.get('petSize') as string] : [],
  );
  const [materials, setMaterials] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [quickAddOptions, setQuickAddOptions] = useState<Record<string, string>>({});
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory());
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [alertedStockProductIds, setAlertedStockProductIds] = useState<Set<number>>(
    () => new Set(readStockAlerts().map((alert) => alert.productId)),
  );
  const priceRangeMaxRef = useRef(DEFAULT_PRICE_RANGE[1]);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const collection = searchParams.get('collection') || '';
  const pageSize = 12;
  const getPrice = (product: Product) => product.effectivePrice ?? product.price;
  const getDiscountPercent = (product: Product) => product.effectiveDiscountPercent || product.discount || 0;
  const getPositiveRate = (product: Product) => product.positiveRate ?? 0;
  const hasReviewSignal = (product: Product) => Number(product.reviewCount || 0) > 0;
  const getSavingsAmount = (product: Product) => Math.max(0, Number(product.originalPrice || 0) - getPrice(product));
  const isProductSoldOut = (product: Product) => product.stock !== undefined && product.stock <= 0;
  const isQuickAddReady = (product: Product) =>
    !isProductSoldOut(product) && getProductOptionGroups(product).length === 0 && getProductVariants(product).length === 0;
  const isBestValueProduct = (product: Product) => {
    const config = conversionConfig.productValueBadge;
    if (!config.enabled) return false;
    return getDiscountPercent(product) >= config.minDiscountPercent
      && getPositiveRate(product) >= config.minPositiveRate
      && Number(product.reviewCount || 0) >= config.minReviewCount;
  };
  const petSizeOptions = useMemo(() => [
    { label: t('pages.profile.petSizeSmall'), value: 'Small' },
    { label: t('pages.profile.petSizeMedium'), value: 'Medium' },
    { label: t('pages.profile.petSizeLarge'), value: 'Large' },
  ], [t]);
  const materialOptions = useMemo(() => [
    { label: t('pages.productList.materialCotton'), value: 'Cotton' },
    { label: t('pages.productList.materialNylon'), value: 'Nylon' },
    { label: t('pages.productList.materialSilicone'), value: 'Silicone' },
    { label: t('pages.productList.materialWood'), value: 'Wood' },
  ], [t]);
  const colorOptions = useMemo(() => [
    { label: t('pages.productList.colorBlack'), value: 'Black' },
    { label: t('pages.productList.colorBlue'), value: 'Blue' },
    { label: t('pages.productList.colorGreen'), value: 'Green' },
    { label: t('pages.productList.colorPink'), value: 'Pink' },
  ], [t]);
  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const refreshStockAlerts = () => {
      setAlertedStockProductIds(new Set(readStockAlerts().map((alert) => alert.productId)));
    };
    const refreshPreferences = () => {
      setViewPreferences(loadProductViewPreferences());
    };
    window.addEventListener('shop:stock-alerts-updated', refreshStockAlerts);
    window.addEventListener('shop:product-view-preferences-updated', refreshPreferences);
    window.addEventListener('storage', refreshStockAlerts);
    window.addEventListener('storage', refreshPreferences);
    return () => {
      window.removeEventListener('shop:stock-alerts-updated', refreshStockAlerts);
      window.removeEventListener('shop:product-view-preferences-updated', refreshPreferences);
      window.removeEventListener('storage', refreshStockAlerts);
      window.removeEventListener('storage', refreshPreferences);
    };
  }, []);

  useEffect(() => {
    const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
    if (!isAuthenticated) {
      setPersonalizedProducts([]);
      return;
    }
    productApi.getPersonalizedRecommendations()
      .then((response) => setPersonalizedProducts(response.data.map((product) => localizeProduct(product, language))))
      .catch(() => setPersonalizedProducts([]));
  }, [language]);

  const collectionProducts = useMemo(() => {
    let result = products;
    if (collection === 'smart-devices') {
      result = result.filter(matchesSmartDeviceCollection);
    }
    if (collection && keyword.trim()) {
      const normalizedKeyword = keyword.trim().toLowerCase();
      result = result.filter((product) => productSearchText(product).includes(normalizedKeyword));
    }
    return result;
  }, [collection, keyword, products]);

  const maxCatalogPrice = useMemo(() => {
    const highestPrice = collectionProducts.reduce((max, product) => Math.max(max, Number(getPrice(product) || 0)), 0);
    if (highestPrice <= 0) return 50;
    const roundTo = highestPrice > 1000 ? 100 : highestPrice > 200 ? 50 : 10;
    return Math.max(50, Math.ceil(highestPrice / roundTo) * roundTo);
  }, [collectionProducts]);

  const priceStep = maxCatalogPrice > 1000 ? 50 : maxCatalogPrice > 200 ? 10 : 5;

  const displayedPriceRange = useMemo<[number, number]>(() => {
    const min = Math.min(priceRange[0], maxCatalogPrice);
    const max = Math.min(Math.max(priceRange[1], min), maxCatalogPrice);
    return [min, max];
  }, [maxCatalogPrice, priceRange]);

  const priceFilterActive = displayedPriceRange[0] > 0 || displayedPriceRange[1] < maxCatalogPrice;
  const activeFilterCount = [
    priceFilterActive,
    petSizes.length > 0,
    materials.length > 0,
    colors.length > 0,
  ].filter(Boolean).length;
  const activeRefinementCount = activeFilterCount + (categoryId ? 1 : 0);

  useEffect(() => {
    setPriceRange((currentRange) => {
      const previousMax = priceRangeMaxRef.current;
      const followsCatalogMax = currentRange[1] === previousMax || currentRange[1] >= previousMax;
      const nextMin = Math.min(currentRange[0], maxCatalogPrice);
      const nextMax = followsCatalogMax ? maxCatalogPrice : Math.min(currentRange[1], maxCatalogPrice);
      const normalizedRange: [number, number] = [nextMin, Math.max(nextMin, nextMax)];
      return normalizedRange[0] === currentRange[0] && normalizedRange[1] === currentRange[1]
        ? currentRange
        : normalizedRange;
    });
    priceRangeMaxRef.current = maxCatalogPrice;
  }, [maxCatalogPrice]);

  const visibleCategories = useMemo(() => {
    const hasActiveCatalogNarrowing = Boolean(collection || keyword.trim() || categoryId);
    if (collectionProducts.length === 0) {
      return hasActiveCatalogNarrowing ? [] : categories;
    }
    const sourceProducts = collectionProducts;
    if (sourceProducts.length === 0) {
      return categories;
    }
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const visibleIds = new Set<number>();
    sourceProducts.forEach((product) => {
      let currentId: number | undefined | null = product.categoryId;
      while (currentId) {
        const category = categoryById.get(currentId);
        if (!category || visibleIds.has(category.id)) {
          break;
        }
        visibleIds.add(category.id);
        currentId = category.parentId;
      }
    });
    return categories.filter((category) => visibleIds.has(category.id));
  }, [categories, categoryId, collection, collectionProducts, keyword]);
  const categoryTree = useMemo(() => buildCategoryTree(visibleCategories), [visibleCategories]);
  const categoryRows = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const selectedCategory = useMemo(
    () => categoryRows.find((category) => category.id === categoryId),
    [categoryId, categoryRows],
  );
  const activeRefinementTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onClose: () => void }> = [];
    if (selectedCategory) {
      tags.push({
        key: `category-${selectedCategory.id}`,
        label: getLocalizedCategoryValue(selectedCategory, language, 'name'),
        onClose: () => {
          setCategoryId(undefined);
          setCurrentPage(1);
          const params = new URLSearchParams();
          if (collection) params.set('collection', collection);
          if (keyword) params.set('keyword', keyword);
          if (discount) params.set('discount', 'true');
          navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
          setFilterDrawerOpen(false);
        },
      });
    }
    if (priceFilterActive) {
      tags.push({
        key: 'price',
        label: `${t('pages.productList.price')}: ${formatMoney(displayedPriceRange[0])} - ${formatMoney(displayedPriceRange[1])}`,
        onClose: () => {
          setPriceRange([0, maxCatalogPrice]);
          setCurrentPage(1);
        },
      });
    }
    const optionLabels = new Map([...petSizeOptions, ...materialOptions, ...colorOptions].map((option) => [option.value, option.label]));
    petSizes.forEach((value) => tags.push({
      key: `size-${value}`,
      label: `${t('pages.productList.filterSize')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        setPetSizes((current) => current.filter((item) => item !== value));
        setCurrentPage(1);
      },
    }));
    materials.forEach((value) => tags.push({
      key: `material-${value}`,
      label: `${t('pages.productList.filterMaterial')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        setMaterials((current) => current.filter((item) => item !== value));
        setCurrentPage(1);
      },
    }));
    colors.forEach((value) => tags.push({
      key: `color-${value}`,
      label: `${t('pages.productList.filterColor')}: ${optionLabels.get(value) || value}`,
      onClose: () => {
        setColors((current) => current.filter((item) => item !== value));
        setCurrentPage(1);
      },
    }));
    return tags;
  }, [
    colorOptions,
    colors,
    collection,
    discount,
    displayedPriceRange,
    formatMoney,
    keyword,
    language,
    materialOptions,
    materials,
    maxCatalogPrice,
    navigate,
    petSizeOptions,
    petSizes,
    priceFilterActive,
    selectedCategory,
    t,
  ]);
  const clearCatalogContext = () => {
    setKeyword('');
    setCategoryId(undefined);
    setSortBy('default');
    setCurrentPage(1);
    navigate('/products');
    setFilterDrawerOpen(false);
  };
  const applySort = (nextSort: string) => {
    setSortBy(nextSort);
    setCurrentPage(1);
  };
  const resultContextTags = [
    collection ? { key: 'collection', color: 'geekblue', label: collection.replace(/-/g, ' ') } : null,
    keyword.trim() ? { key: 'keyword', color: 'purple', label: keyword.trim() } : null,
    selectedCategory ? { key: 'category', color: 'green', label: getLocalizedCategoryValue(selectedCategory, language, 'name') } : null,
    discount ? { key: 'discount', color: 'red', label: t('home.flashOffers') } : null,
  ].filter(Boolean) as Array<{ key: string; color: string; label: string }>;
  const quickAddOptionGroups = useMemo(() => getProductOptionGroups(quickAddProduct), [quickAddProduct]);
  const quickAddVariants = useMemo(() => getProductVariants(quickAddProduct), [quickAddProduct]);
  const quickAddBundleInfo = useMemo(() => getBundleInfo(quickAddProduct), [quickAddProduct]);
  const quickAddVariant = useMemo(() => {
    if (!quickAddVariants.length) return undefined;
    return quickAddVariants.find((variant) =>
      Object.entries(variant.options || {}).every(([key, value]) => quickAddOptions[key] === value),
    );
  }, [quickAddOptions, quickAddVariants]);
  const quickAddPrice = useMemo(
    () => quickAddBundleInfo?.price ?? quickAddVariant?.price ?? (quickAddProduct ? getPrice(quickAddProduct) : 0),
    [quickAddBundleInfo, quickAddProduct, quickAddVariant],
  );
  const buildQuickAddCartSnapshot = () => quickAddProduct ? ({
    ...quickAddProduct,
    stock: quickAddVariant?.stock ?? quickAddProduct.stock,
    price: quickAddPrice,
    effectivePrice: quickAddPrice,
    imageUrl: quickAddVariant?.imageUrl || quickAddProduct.imageUrl,
  }) : null;

  const fetchProducts = useCallback(async (kw?: string, cid?: number, disc?: boolean) => {
    try {
      setLoading(true);
      const res = await productApi.getAll(kw || undefined, cid, disc);
      setProducts(res.data.map((product) => localizeProduct(product, language)));
      setLoadFailed(false);
      setCurrentPage(1);
    } catch {
      setProducts([]);
      setLoadFailed(true);
      message.error(t('pages.productList.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    const kw = searchParams.get('keyword') || '';
    const cid = searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined;
    const disc = searchParams.get('discount') === 'true';
    const activeCollection = searchParams.get('collection') || '';
    const requestedSort = searchParams.get('sort') || 'default';
    const requestedPetSize = searchParams.get('petSize');
    setKeyword(kw);
    setCategoryId(cid);
    setDiscount(disc);
    setSortBy(requestedSort);
    setPetSizes(requestedPetSize ? [requestedPetSize] : []);
    fetchProducts(activeCollection ? undefined : kw, cid, disc);
  }, [fetchProducts, searchParams, language]);

  const handleSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      const nextHistory = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      setSearchHistory(nextHistory);
      writeSearchHistory(nextHistory);
    }
    const params = new URLSearchParams();
    if (collection) params.set('collection', collection);
    if (trimmed) params.set('keyword', trimmed);
    if (categoryId) params.set('categoryId', categoryId.toString());
    if (discount) params.set('discount', 'true');
    if (sortBy !== 'default') params.set('sort', sortBy);
    if (petSizes.length === 1) params.set('petSize', petSizes[0]);
    navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    writeSearchHistory([]);
  };

  const handleCompare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const result = addCompareProduct(product);
    if (result.status === 'full') {
      message.warning(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }));
      return;
    }
    message.success(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'));
    navigate('/compare');
  };

  const openProductDetail = (productId: number) => {
    navigate(`/products/${productId}`);
  };

  const resetFilters = () => {
    setPriceRange([0, maxCatalogPrice]);
    setPetSizes([]);
    setMaterials([]);
    setColors([]);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cid: number | undefined) => {
    setCategoryId(cid);
    const params = new URLSearchParams();
    if (collection) params.set('collection', collection);
    if (keyword) params.set('keyword', keyword);
    if (cid) params.set('categoryId', cid.toString());
    if (discount) params.set('discount', 'true');
    if (sortBy !== 'default') params.set('sort', sortBy);
    if (petSizes.length === 1) params.set('petSize', petSizes[0]);
    navigate(`/products${params.toString() ? '?' + params.toString() : ''}`);
    setFilterDrawerOpen(false);
  };

  const openQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQuickAddProduct(product);
    setQuickAddOptions({});
  };

  const selectQuickAddOption = (groupName: string, value: string) => {
    setQuickAddOptions((current) =>
      selectCompatibleProductOption(quickAddOptionGroups, quickAddVariants, current, groupName, value),
    );
  };

  const renderQuickAddOptions = () => (
    <>
      <Text type="secondary">{t('pages.productList.quickAddHint')}</Text>
      {quickAddOptionGroups.map((group) => (
        <Select
          key={group.name}
          placeholder={group.name}
          value={quickAddOptions[group.name] || undefined}
          onChange={(value) => selectQuickAddOption(group.name, value)}
          options={group.values.map((value) => ({
            value,
            label: value,
            disabled: !optionValueHasVariant(quickAddVariants, group.name, value),
          }))}
          style={{ width: '100%' }}
        />
      ))}
      {Object.keys(quickAddOptions).length > 0 && (
        <Button type="link" onClick={() => setQuickAddOptions({})} style={{ padding: 0, alignSelf: 'flex-start' }}>
          {t('common.reset')}
        </Button>
      )}
    </>
  );

  const handleStockAlert = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (alertedStockProductIds.has(product.id)) {
      removeStockAlert(product.id);
      message.success(t('pages.stockAlerts.removed'));
      return;
    }
    const result = addStockAlert(product);
    message.success(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'));
  };

  const submitQuickAdd = async () => {
    if (!quickAddProduct) return;
    const missingOption = quickAddOptionGroups.find((group) => !quickAddOptions[group.name]);
    if (missingOption) {
      message.warning(t('pages.productDetail.selectOption', { option: missingOption.name }));
      return;
    }
    if (quickAddVariants.length > 0 && !quickAddVariant) {
      message.warning(t('pages.productDetail.variantUnavailable'));
      return;
    }
    const selectedStock = quickAddVariant?.stock ?? quickAddProduct.stock;
    if (selectedStock !== undefined && selectedStock <= 0) {
      message.error(t('pages.productDetail.insufficientStock'));
      return;
    }
    const bundleInfo = getBundleInfo(quickAddProduct);
    if (bundleInfo) {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const selectedSpecs = buildBundleSpecs(quickAddProduct, quickAddOptions, quickAddVariant?.sku);
      const snapshot = buildQuickAddCartSnapshot();
      try {
        if (token && userId) {
          await cartApi.addItem(Number(userId), quickAddProduct.id, 1, selectedSpecs);
          window.dispatchEvent(new Event('shop:cart-updated'));
        } else if (snapshot) {
          addGuestCartItem(snapshot, 1, selectedSpecs, bundleInfo.price);
        }
        message.success(t('messages.addCartSuccess'));
        setQuickAddProduct(null);
        window.dispatchEvent(new Event('shop:open-cart'));
      } catch {
        message.error(t('messages.addFailed'));
      }
      return;
    }
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const selectedSpecs = quickAddOptionGroups.length
      ? JSON.stringify({
        ...quickAddOptions,
        ...(quickAddVariant?.sku ? { _variantSku: quickAddVariant.sku } : {}),
      })
      : undefined;
    const selectedPrice = quickAddPrice;
    const snapshot = buildQuickAddCartSnapshot();
    try {
      if (token && userId) {
        await cartApi.addItem(Number(userId), quickAddProduct.id, 1, selectedSpecs);
        window.dispatchEvent(new Event('shop:cart-updated'));
      } else if (snapshot) {
        addGuestCartItem(snapshot, 1, selectedSpecs, selectedPrice);
      }
      message.success(t('messages.addCartSuccess'));
      setQuickAddProduct(null);
      window.dispatchEvent(new Event('shop:open-cart'));
    } catch {
      message.error(t('messages.addFailed'));
    }
  };

  const filteredProducts = collectionProducts.filter((product) => {
    const price = getPrice(product);
    const specs = product.specifications || {};
    const specText = Object.values(specs).join(' ').toLowerCase();
    const matchPrice = !priceFilterActive || (price >= displayedPriceRange[0] && price <= displayedPriceRange[1]);
    const matchSize = petSizes.length === 0 || petSizes.some((size) => specText.includes(size.toLowerCase()));
    const matchMaterial = materials.length === 0 || materials.some((material) => specText.includes(material.toLowerCase()));
    const matchColor = colors.length === 0 || colors.some((color) => specText.includes(color.toLowerCase()) || product.name.toLowerCase().includes(color.toLowerCase()));
    return matchPrice && matchSize && matchMaterial && matchColor;
  });

  const personalizedProductIds = useMemo(
    () => new Set(personalizedProducts.map((product) => product.id)),
    [personalizedProducts],
  );
  const topPreferenceCategory = useMemo(() => {
    const [categoryIdValue] = Object.entries(viewPreferences.categories || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0] || [];
    return categoryIdValue;
  }, [viewPreferences.categories]);
  const topPreferenceBrand = useMemo(() => {
    const [brand] = Object.entries(viewPreferences.brands || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0] || [];
    return brand;
  }, [viewPreferences.brands]);
  const getPersonalizedSortScore = (product: Product) =>
    (personalizedProductIds.has(product.id) ? 42 : 0) +
    (String(product.categoryId) === topPreferenceCategory ? 14 : 0) +
    (topPreferenceBrand && product.brand === topPreferenceBrand ? 12 : 0) +
    (viewPreferences.recent.includes(product.id) ? 6 : 0) +
    (isBestValueProduct(product) ? 34 : 0) +
    (isQuickAddReady(product) ? 18 : 0) +
    Math.min(18, getDiscountPercent(product)) +
    Math.min(14, getPositiveRate(product) / 8) +
    Math.min(10, Number(product.reviewCount || 0) / 2) +
    (getLowStockCount(product.stock) !== null ? 4 : 0);

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'personalized-desc') {
      return getPersonalizedSortScore(b) - getPersonalizedSortScore(a);
    }
    if (sortBy === 'price-asc') return getPrice(a) - getPrice(b);
    if (sortBy === 'price-desc') return getPrice(b) - getPrice(a);
    if (sortBy === 'discount-desc') return getDiscountPercent(b) - getDiscountPercent(a);
    if (sortBy === 'positive-rate-desc') {
      const rateDiff = getPositiveRate(b) - getPositiveRate(a);
      if (rateDiff !== 0) return rateDiff;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const productListInsights = {
    bestValueCount: filteredProducts.filter(isBestValueProduct).length,
    lowStockCount: filteredProducts.filter((product) => getLowStockCount(product.stock) !== null && !isProductSoldOut(product)).length,
    quickAddReadyCount: filteredProducts.filter(isQuickAddReady).length,
  };
  const recommendedProduct = filteredProducts
    .filter((product) => !isProductSoldOut(product))
    .map((product, index) => ({
      product,
      index,
      score: getPersonalizedSortScore(product),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.product || null;
  const personalGuideAction = personalizedProducts.length > 0
    ? { label: t('pages.productList.viewPersonalPicks'), action: () => applySort('personalized-desc') }
    : { label: t('pages.productList.managePetProfile'), action: () => navigate('/profile?tab=pets') };
  const quickFilterActions = [
    {
      key: 'ready',
      label: t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount }),
      onClick: () => applySort('discount-desc'),
      disabled: productListInsights.quickAddReadyCount === 0,
    },
    {
      key: 'value',
      label: t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount }),
      onClick: () => applySort('positive-rate-desc'),
      disabled: productListInsights.bestValueCount === 0,
    },
    {
      key: 'stock',
      label: t('pages.productList.lowStockCount', { count: productListInsights.lowStockCount }),
      onClick: () => applySort('default'),
      disabled: productListInsights.lowStockCount === 0,
    },
  ];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, sortedProducts.length]);

  const paginatedProducts = sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderBadges = (product: Product) => {
    const badges: Array<{ label: string; color: string }> = [];
    if (isBestValueProduct(product)) badges.push({ label: t('pages.productList.bestValue'), color: 'green' });
    if (getDiscountPercent(product) > 0) badges.push({ label: t('pages.productList.sale'), color: 'volcano' });
    if (product.tag === 'new') badges.push({ label: t('pages.productList.new'), color: 'blue' });
    if (product.isFeatured) badges.push({ label: t('pages.productList.bestSeller'), color: 'gold' });
    if (getLowStockCount(product.stock) !== null && (product.stock || 0) > 0) badges.push({ label: t('pages.productList.runningLow'), color: 'red' });
    return badges;
  };

  const renderPrimaryAction = (product: Product) => {
    const soldOut = product.stock !== undefined && product.stock <= 0;
    if (soldOut) {
      const alerted = alertedStockProductIds.has(product.id);
      return (
        <Button
          key="stock-alert"
          icon={<BellOutlined />}
          size="small"
          className="product-list__actionButton product-list__alertButton"
          onClick={(e) => handleStockAlert(e, product)}
        >
          <span className="product-list__actionLabel">
            {alerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
          </span>
        </Button>
      );
    }
    return (
      <Button
        key="quick-add"
        type="primary"
        icon={<ShoppingCartOutlined />}
        size="small"
        className="product-list__actionButton"
        onClick={(e) => openQuickAdd(e, product)}
      >
        <span className="product-list__actionLabel">
          {isQuickAddReady(product) ? t('pages.productList.quickAdd') : t('pages.wishlist.selectOptions')}
        </span>
      </Button>
    );
  };
  const renderConfidenceStrip = (product: Product) => {
    const quickReady = isQuickAddReady(product);
    const lowStock = getLowStockCount(product.stock);
    if (quickReady && lowStock === null) return null;
    return (
      <div className="product-list__confidenceStrip">
        {!quickReady && (
          <span className="product-list__confidencePill">
            <CheckCircleOutlined />
            {t('pages.productList.cardOptionsNeeded')}
          </span>
        )}
        {lowStock !== null && (
          <span className="product-list__confidencePill product-list__confidencePill--alert">
            <FireOutlined />
            {t('pages.productList.cardLowStock', { count: lowStock })}
          </span>
        )}
      </div>
    );
  };

  const renderCategoryPanel = () => (
    <div className="product-list__categoryStack">
      <Button type={!categoryId ? 'primary' : 'text'} block onClick={() => handleCategoryChange(undefined)} className="product-list__categoryButton">
        {t('pages.productList.allCategories')}
      </Button>
      {categoryRows.map(cat => (
        <Button
          key={cat.id}
          type={categoryId === cat.id ? 'primary' : 'text'}
          block
          onClick={() => handleCategoryChange(cat.id)}
          className="product-list__categoryButton"
          style={{ paddingLeft: 12 + ((cat.level || 1) - 1) * 14 }}
        >
          {getLocalizedCategoryValue(cat, language, 'name')}
        </Button>
      ))}
    </div>
  );

  const renderFilterPanel = () => (
    <Space direction="vertical" className="product-list__filterStack" size="middle">
      <div>
        <Text strong>{t('pages.productList.price')}</Text>
        <Slider
          range
          min={0}
          max={maxCatalogPrice}
          step={priceStep}
          value={displayedPriceRange}
          onChange={(value) => {
            setPriceRange(value as [number, number]);
            setCurrentPage(1);
          }}
        />
        <Text type="secondary">{formatMoney(displayedPriceRange[0])} - {formatMoney(displayedPriceRange[1])}</Text>
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterSize')}</Text>
        <Checkbox.Group
          value={petSizes}
          onChange={(value) => {
            setPetSizes(value.map(String));
            setCurrentPage(1);
          }}
          options={petSizeOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterMaterial')}</Text>
        <Checkbox.Group
          value={materials}
          onChange={(value) => {
            setMaterials(value.map(String));
            setCurrentPage(1);
          }}
          options={materialOptions}
        />
      </div>
      <div>
        <Text strong className="product-list__filterLabel">{t('pages.productList.filterColor')}</Text>
        <Checkbox.Group
          value={colors}
          onChange={(value) => {
            setColors(value.map(String));
            setCurrentPage(1);
          }}
          options={colorOptions}
        />
      </div>
    </Space>
  );

  return (
    <div className="product-list">
      <Row gutter={24}>
        <Col xs={0} sm={0} md={5} lg={4}>
          <Card title={t('pages.productList.title')} size="small" style={{ marginBottom: 16 }}>
            {renderCategoryPanel()}
          </Card>
          <Card
            title={
              <Space>
                <span>{t('pages.productList.filters')}</span>
                {activeFilterCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</Tag> : null}
              </Space>
            }
            size="small"
            extra={
              <Button type="link" size="small" disabled={activeFilterCount === 0} onClick={resetFilters}>
                {t('pages.productList.resetFilters')}
              </Button>
            }
          >
            {renderFilterPanel()}
          </Card>
        </Col>
        <Col xs={24} sm={24} md={19} lg={20}>
          <div className="product-list__focusBar">
            <div className="product-list__focusIntro">
              <Text strong>{t('pages.productList.title')}</Text>
              <Space wrap size={[8, 8]}>
                <Tag color="cyan">{t('pages.productList.count', { count: filteredProducts.length })}</Tag>
                {resultContextTags.map((tag) => (
                  <Tag key={tag.key} color={tag.color}>{tag.label}</Tag>
                ))}
              </Space>
            </div>
            <Space wrap size={[8, 8]} className="product-list__focusActions">
              {quickFilterActions.map((item) => (
                <Button key={item.key} size="small" disabled={item.disabled} onClick={item.onClick}>
                  {item.label}
                </Button>
              ))}
              {resultContextTags.length > 0 ? (
                <Button size="small" onClick={clearCatalogContext}>
                  {t('pages.productList.allCategories')}
                </Button>
              ) : null}
            </Space>
          </div>
          <Card className="product-list__toolbar">
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={14} flex="auto">
                <Input.Search placeholder={t('pages.productList.searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} className="product-list__search" />
              </Col>
              <Col xs={12} sm={5} md={6}>
                <Select value={sortBy} onChange={applySort} style={{ width: '100%' }}
                  options={[
                    { value: 'default', label: t('pages.productList.defaultSort') },
                    { value: 'personalized-desc', label: t('pages.productList.personalizedSort') },
                    { value: 'price-asc', label: t('pages.productList.priceAsc') },
                    { value: 'price-desc', label: t('pages.productList.priceDesc') },
                    { value: 'discount-desc', label: t('pages.productList.discountDesc') },
                    { value: 'positive-rate-desc', label: t('pages.productList.positiveRateDesc') },
                    { value: 'name', label: t('pages.productList.byName') },
                  ]}
                />
              </Col>
              <Col xs={12} sm={7} md={4}>
                <div className="product-list__toolbarMeta">
                  <Text type="secondary">{t('pages.productList.count', { count: filteredProducts.length })}</Text>
                  <Badge count={activeRefinementCount} size="small" overflowCount={99}>
                    <Button className="product-list__filterButton" icon={<FilterOutlined />} onClick={() => setFilterDrawerOpen(true)}>
                      {t('pages.productList.filters')}
                    </Button>
                  </Badge>
                </div>
              </Col>
            </Row>
            {activeRefinementTags.length > 0 ? (
              <div className="product-list__refinementChips">
                {activeRefinementTags.map((tag) => (
                  <Tag
                    key={tag.key}
                    closable
                    onClose={(event) => {
                      event.preventDefault();
                      tag.onClose();
                    }}
                  >
                    {tag.label}
                  </Tag>
                ))}
                <Button type="link" size="small" onClick={resetFilters}>
                  {t('pages.productList.resetFilters')}
                </Button>
              </div>
            ) : null}
            {searchHistory.length > 0 && (
              <Space wrap size={[8, 8]} style={{ marginTop: 12 }}>
                <Text type="secondary">{t('pages.productList.recentSearches')}</Text>
                {searchHistory.map((term) => (
                  <Tag key={term} style={{ cursor: 'pointer' }} onClick={() => handleSearch(term)}>
                    {term}
                  </Tag>
                ))}
                <Button type="link" size="small" onClick={clearSearchHistory}>
                  {t('pages.productList.clearSearches')}
                </Button>
              </Space>
            )}
          </Card>
          <div className="product-list__smartBar">
            <div className="product-list__smartBarLeft">
              <ThunderboltOutlined />
              <Space wrap size={[6, 4]}>
                <Tag color="green">{t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}</Tag>
                <Tag color="gold">{t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount })}</Tag>
                {productListInsights.lowStockCount > 0 && <Tag color="red">{t('pages.productList.lowStockCount', { count: productListInsights.lowStockCount })}</Tag>}
              </Space>
            </div>
            <Space wrap size={[6, 4]}>
              {recommendedProduct && (
                <Button size="small" type="link" onClick={() => openProductDetail(recommendedProduct.id)}>
                  {t('pages.productList.viewPick')}: {recommendedProduct.name}
                </Button>
              )}
              <Button size="small" icon={<FireOutlined />} onClick={() => applySort('positive-rate-desc')}>
                {t('pages.productList.shopTopRated')}
              </Button>
              <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => applySort('discount-desc')}>
                {t('pages.productList.shopBestDeals')}
              </Button>
              {personalizedProducts.length > 0 && (
                <Button size="small" type="primary" onClick={personalGuideAction.action}>
                  {personalGuideAction.label}
                </Button>
              )}
            </Space>
          </div>
          {loading ? (
            <div className="product-list__loading"><Spin size="large" /></div>
          ) : loadFailed ? (
            <div className="product-list__loadFailed" role="alert">
              <Empty description={t('pages.productList.fetchFailed')}>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={() => fetchProducts(collection ? undefined : keyword, categoryId, discount)}
                  >
                    {t('common.refresh')}
                  </Button>
                  <Button onClick={() => navigate('/products')}>
                    {t('pages.productList.allCategories')}
                  </Button>
                </Space>
              </Empty>
            </div>
          ) : paginatedProducts.length === 0 ? (
            <Empty description={t('pages.productList.empty')} className="product-list__empty">
              <Space wrap>
                {activeFilterCount > 0 ? (
                  <Button onClick={resetFilters}>{t('pages.productList.resetFilters')}</Button>
                ) : null}
                {(keyword || categoryId || collection) ? (
                  <Button type="primary" onClick={() => navigate('/products')}>
                    {t('pages.productList.allCategories')}
                  </Button>
                ) : null}
              </Space>
            </Empty>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {paginatedProducts.map(product => (
                  <Col key={product.id} xs={12} sm={12} md={8} lg={6}>
                    <Card
                      className="product-list__card"
                      hoverable
                      role="button"
                      tabIndex={0}
                      onClick={() => openProductDetail(product.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openProductDetail(product.id);
                        }
                      }}
                      cover={
                        <div className="product-list__imageWrap">
                          <img
                            alt={product.name}
                            src={resolveProductListImage(product.imageUrl)}
                            className="product-list__image"
                            onError={(event) => {
                              if (event.currentTarget.src !== productImageFallback) {
                                event.currentTarget.src = productImageFallback;
                              }
                            }}
                          />
                          <div className="product-list__badges">
                            {renderBadges(product).map((badge) => <Tag key={badge.label} color={badge.color}>{badge.label}</Tag>)}
                          </div>
                          {product.stock !== undefined && product.stock <= 0 && (
                            <div className="product-list__soldOut">
                              {t('pages.productList.soldOut')}
                            </div>
                          )}
                        </div>
                      }
                      actions={[
                        renderPrimaryAction(product),
                        <Button
                          key="compare"
                          icon={<BarChartOutlined />}
                          size="small"
                          className="product-list__actionButton product-list__actionButton--compact"
                          aria-label={isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          title={isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          onClick={(e) => handleCompare(e, product)}
                        >
                          <span className="product-list__actionLabel">
                            {isProductCompared(product.id) ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                          </span>
                        </Button>,
                      ]}
                    >
                      <Card.Meta
                        title={<Text ellipsis={{ tooltip: product.name }}>{product.name}</Text>}
                        description={
                          <div>
                            <div className="product-list__priceLine">
                              {formatMoney(getPrice(product))}
                              {product.originalPrice && product.originalPrice > getPrice(product) && (
                                <Text delete type="secondary" className="product-list__originalPrice">{formatMoney(product.originalPrice)}</Text>
                              )}
                              {product.activeLimitedTimeDiscount && <Tag color="red" className="product-list__priceTag">{t('pages.productList.limitedTime')}</Tag>}
                            </div>
                            {isBestValueProduct(product) && getSavingsAmount(product) > 0 ? (
                              <div className="product-list__valueLine">
                                <Text type="success">
                                  {t('pages.productList.bestValueSavings', { amount: formatMoney(getSavingsAmount(product)) })}
                                </Text>
                              </div>
                            ) : null}
                            <div className="product-list__ratingLine">
                              <Text type={hasReviewSignal(product) ? 'secondary' : undefined} className={hasReviewSignal(product) ? undefined : 'product-list__newReviewSignal'}>
                                {hasReviewSignal(product)
                                  ? t('pages.productList.positiveRate', { rate: (product.positiveRate || 0).toFixed(1), count: product.reviewCount || 0 })
                                  : t('pages.productList.noReviewsYet')}
                              </Text>
                            </div>
                            {product.brand && <Text type="secondary" className="product-list__brand">{product.brand}</Text>}
                            {renderConfidenceStrip(product)}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
              {sortedProducts.length > pageSize && (
                <div className="product-list__pagination">
                  <Pagination current={currentPage} total={sortedProducts.length} pageSize={pageSize} onChange={setCurrentPage} showTotal={(total) => t('pages.productList.count', { count: total })} />
                </div>
              )}
            </>
          )}
        </Col>
      </Row>
      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>{t('pages.productList.filters')}</span>
            {activeFilterCount > 0 ? <Tag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</Tag> : null}
          </Space>
        }
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        placement="bottom"
        height="82vh"
        className="product-list__mobileDrawer"
        extra={
          <Button type="link" disabled={activeFilterCount === 0} onClick={resetFilters}>
            {t('pages.productList.resetFilters')}
          </Button>
        }
      >
        <div className="product-list__drawerContent">
          <Card title={t('pages.productList.title')} size="small">
            {renderCategoryPanel()}
          </Card>
          <Card title={t('pages.productList.filters')} size="small">
            {renderFilterPanel()}
          </Card>
          <Button type="primary" block size="large" onClick={() => setFilterDrawerOpen(false)}>
            {t('common.confirm')}
          </Button>
        </div>
      </Drawer>
      <Modal
        title={quickAddProduct ? t('pages.productList.quickAddTitle', { name: quickAddProduct.name }) : t('pages.productList.quickAdd')}
        open={!!quickAddProduct}
        onCancel={() => setQuickAddProduct(null)}
        onOk={submitQuickAdd}
        okText={t('pages.productList.addToCart')}
        cancelText={t('common.cancel')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {quickAddBundleInfo ? (
            <>
              {quickAddOptionGroups.length > 0 ? renderQuickAddOptions() : null}
              <Text type="secondary">{t('bundle.includes')}</Text>
              <Space wrap size={[6, 6]}>
                {quickAddBundleInfo.items.map((item) => (
                  <Tag key={item.name}>{item.name} x{item.quantity || 1}</Tag>
                ))}
              </Space>
              <Text>{t('pages.productList.quickAddPrice')}: {formatMoney(quickAddBundleInfo.price)}</Text>
            </>
          ) : quickAddOptionGroups.length > 0 ? (
            <>
              {renderQuickAddOptions()}
              <Text>
                {t('pages.productList.quickAddPrice')}: {formatMoney(quickAddPrice)}
              </Text>
              {quickAddVariant?.stock !== undefined && (
                <Text type="secondary">{t('pages.productDetail.stock')}: {quickAddVariant.stock}</Text>
              )}
            </>
          ) : (
            <Text type="secondary">{t('pages.productList.quickAddNoOptions')}</Text>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default ProductList;

