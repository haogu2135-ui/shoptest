const DEFAULT_GATEWAY_PREFIX = '/gateway';

const routeServices = [
  { service: 'admin', prefixes: ['/admin'] },
  { service: 'identity', prefixes: ['/auth', '/users'] },
  { service: 'catalog', prefixes: ['/products', '/categories', '/brands', '/reviews', '/product-questions', '/pet-gallery'] },
  { service: 'customer', prefixes: ['/addresses', '/wishlist', '/pet-profiles'] },
  { service: 'commerce', prefixes: ['/cart', '/coupons'] },
  { service: 'order', prefixes: ['/orders'] },
  { service: 'payment', prefixes: ['/payments'] },
  { service: 'support', prefixes: ['/support'] },
  { service: 'notification', prefixes: ['/notifications', '/announcements'] },
  { service: 'logistics', prefixes: ['/logistics'] },
  { service: 'app', prefixes: ['/app'] },
];

const normalizeGatewayPrefix = (value: string | undefined) => {
  const prefix = (value || DEFAULT_GATEWAY_PREFIX).trim() || DEFAULT_GATEWAY_PREFIX;
  const withSlash = prefix.startsWith('/') ? prefix : `/${prefix}`;
  return withSlash.endsWith('/') && withSlash.length > 1 ? withSlash.slice(0, -1) : withSlash;
};

export const apiGatewayPrefix = normalizeGatewayPrefix(process.env.REACT_APP_API_GATEWAY_PREFIX);
export const apiGatewayEnabled = process.env.REACT_APP_API_GATEWAY_ENABLED !== 'false';

export const resolveApiServiceId = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const matchedRoute = routeServices.find((route) =>
    route.prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)),
  );
  return matchedRoute?.service || null;
};

export const resolveApiDispatcherUrl = (url: string | undefined) => {
  if (!apiGatewayEnabled || !url || !url.startsWith('/') || url.startsWith('//')) {
    return url;
  }
  if (url === apiGatewayPrefix || url.startsWith(`${apiGatewayPrefix}/`)) {
    return url;
  }

  const match = url.match(/^([^?#]*)([?#].*)?$/);
  const path = match?.[1] || url;
  const suffix = match?.[2] || '';
  const serviceId = resolveApiServiceId(path);
  if (!serviceId) {
    return url;
  }
  return `${apiGatewayPrefix}/${serviceId}${path}${suffix}`;
};
