import { resolveApiGatewayEnabled, resolveApiGatewayPrefix } from './runtimeConfig';

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

export const apiGatewayPrefix = resolveApiGatewayPrefix();
export const apiGatewayEnabled = resolveApiGatewayEnabled();

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
