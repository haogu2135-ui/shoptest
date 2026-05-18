export type CouponUiText = {
  searchPlaceholder: string;
  sortRecommended: string;
  sortValue: string;
  sortEnding: string;
  sortThreshold: string;
  visibleResults: string;
  resetSearch: string;
  noSearchResults: string;
  claimSummary: string;
  bestMatch: string;
  cartReady: string;
  activeControls: string;
  resetControls: string;
  walletNext: string;
  listMatched: string;
  alreadySaved: string;
  walletGuide: string;
  nextExpiry: string;
  strongestSaved: string;
  noExpiry: string;
  noSavedValue: string;
  daysShort: string;
  unlimitedStock: string;
  today: string;
  walletAll: string;
  walletFilteredEmpty: string;
  walletThreshold: string;
  remainingLabel: string;
};

const couponUiTexts: Record<'en' | 'es' | 'zh', CouponUiText> = {
  zh: {
    searchPlaceholder: '搜索优惠券名称或说明',
    sortRecommended: '推荐优先',
    sortValue: '优惠力度',
    sortEnding: '即将过期',
    sortThreshold: '低门槛',
    visibleResults: '当前显示',
    resetSearch: '清空搜索',
    noSearchResults: '没有匹配当前条件的优惠券',
    claimSummary: '本次已领取 {claimed}/{total} 张优惠券',
    bestMatch: '优先领取',
    cartReady: '购物车已达标',
    activeControls: '当前条件',
    resetControls: '重置条件',
    walletNext: '优先使用',
    listMatched: '匹配到',
    alreadySaved: '已在券包',
    walletGuide: '券包提醒',
    nextExpiry: '最近到期',
    strongestSaved: '最大优惠',
    noExpiry: '暂无到期提醒',
    noSavedValue: '暂无可用优惠',
    daysShort: '{count}天',
    unlimitedStock: '不限量',
    today: '今天',
    walletAll: '全部',
    walletFilteredEmpty: '当前状态下暂无优惠券',
    walletThreshold: '门槛',
    remainingLabel: '剩余',
  },
  es: {
    searchPlaceholder: 'Buscar cupón por nombre o beneficio',
    sortRecommended: 'Recomendado',
    sortValue: 'Mayor ahorro',
    sortEnding: 'Vence pronto',
    sortThreshold: 'Menor mínimo',
    visibleResults: 'Mostrando',
    resetSearch: 'Limpiar búsqueda',
    noSearchResults: 'No hay cupones que coincidan',
    claimSummary: 'Se tomaron {claimed}/{total} cupones',
    bestMatch: 'Mejor opción',
    cartReady: 'Carrito listo',
    activeControls: 'Controles activos',
    resetControls: 'Restablecer',
    walletNext: 'Usar primero',
    listMatched: 'Coincidencias',
    alreadySaved: 'En cartera',
    walletGuide: 'Guía de cartera',
    nextExpiry: 'Vence primero',
    strongestSaved: 'Mayor ahorro',
    noExpiry: 'Sin vencimiento cercano',
    noSavedValue: 'Sin ahorro disponible',
    daysShort: '{count}d',
    unlimitedStock: 'Sin límite',
    today: 'Hoy',
    walletAll: 'Todos',
    walletFilteredEmpty: 'No hay cupones con este estado',
    walletThreshold: 'Mínimo',
    remainingLabel: 'Restantes',
  },
  en: {
    searchPlaceholder: 'Search coupon name or details',
    sortRecommended: 'Recommended',
    sortValue: 'Highest value',
    sortEnding: 'Ending soon',
    sortThreshold: 'Lowest threshold',
    visibleResults: 'Showing',
    resetSearch: 'Clear search',
    noSearchResults: 'No coupons match these controls',
    claimSummary: 'Claimed {claimed}/{total} coupons this time',
    bestMatch: 'Best pick',
    cartReady: 'Cart ready',
    activeControls: 'Active controls',
    resetControls: 'Reset controls',
    walletNext: 'Use first',
    listMatched: 'Matched',
    alreadySaved: 'In wallet',
    walletGuide: 'Wallet guide',
    nextExpiry: 'Next expiry',
    strongestSaved: 'Strongest saved',
    noExpiry: 'No expiry reminder',
    noSavedValue: 'No usable value yet',
    daysShort: '{count}d',
    unlimitedStock: 'Unlimited',
    today: 'Today',
    walletAll: 'All',
    walletFilteredEmpty: 'No coupons in this status',
    walletThreshold: 'Threshold',
    remainingLabel: 'Remaining',
  },
};

export const getCouponUiText = (language: string): CouponUiText =>
  language === 'zh' || language === 'es' ? couponUiTexts[language] : couponUiTexts.en;
