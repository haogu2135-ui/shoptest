type ScrollListener = EventListenerOrEventListenerObject;

const isNativeRuntime = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const capacitor = window.Capacitor;
  return Boolean(document.body?.classList.contains('shop-mobile-app'))
    || document.documentElement.classList.contains('shop-mobile-app-root')
    || window.location.protocol === 'capacitor:'
    || capacitor?.isNativePlatform?.() === true;
};

const getNativeShellElement = (): HTMLElement | null => {
  if (!isNativeRuntime()) return null;
  return document.querySelector<HTMLElement>('.shop-app-shell');
};

const canElementScroll = (element: HTMLElement): boolean => {
  const overflowY = window.getComputedStyle(element).overflowY;
  const isScrollableOverflow = ['auto', 'scroll', 'overlay'].includes(overflowY);
  return isScrollableOverflow && element.scrollHeight > element.clientHeight + 1;
};

const getNativeScrollCandidates = (): HTMLElement[] => {
  const shell = getNativeShellElement();
  if (!shell) return [];

  const candidates = [
    shell.querySelector<HTMLElement>('.ant-layout-content'),
    shell,
  ].filter((element): element is HTMLElement => Boolean(element));

  return Array.from(new Set(candidates));
};

export const getNativeScrollHost = (): HTMLElement | null => {
  return getNativeScrollCandidates().find(canElementScroll) || null;
};

export const scrollAppToTop = (behavior: ScrollBehavior = 'auto') => {
  const host = getNativeScrollHost();
  const shell = getNativeShellElement();
  const effectiveBehavior = isNativeRuntime() && behavior === 'smooth' ? 'auto' : behavior;
  if (host) {
    host.scrollTo({ top: 0, left: 0, behavior: effectiveBehavior });
  } else if (shell) {
    shell.scrollTo({ top: 0, left: 0, behavior: effectiveBehavior });
  }
  getNativeScrollCandidates().forEach((candidate) => {
    if (candidate !== host) {
      candidate.scrollTo({ top: 0, left: 0, behavior: effectiveBehavior });
    }
  });
  window.scrollTo({ top: 0, left: 0, behavior: effectiveBehavior });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

export const getAppScrollMetrics = () => {
  const host = getNativeScrollHost();
  if (host) {
    return {
      scrollTop: host.scrollTop,
      scrollHeight: host.scrollHeight,
      viewportHeight: host.clientHeight,
    };
  }
  return {
    scrollTop: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  };
};

export const addAppScrollListener = (listener: ScrollListener, options?: AddEventListenerOptions) => {
  const nativeHosts = getNativeScrollCandidates();
  window.addEventListener('scroll', listener, options);
  nativeHosts.forEach((host) => host.addEventListener('scroll', listener, options));
  return () => {
    window.removeEventListener('scroll', listener, options);
    nativeHosts.forEach((host) => host.removeEventListener('scroll', listener, options));
  };
};
