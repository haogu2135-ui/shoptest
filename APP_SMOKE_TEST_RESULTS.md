# App Smoke Test Results

## 2026-06-05 19:19 UTC - Android App 1.0.32 storefront release verification

- Scope: Native App storefront cleanup release verification after the home/product-detail APP UI fixes and Android APK publish.
- APK: `shoptest-1.0.32.apk`, versionCode `10032`, size `3121762`, SHA256 `c526af68c2bf5d5879e8967e4eaedbe5e6421914db9f77cf356e9ce66f894acf`.
- PASS: `frontend/public/downloads`, `frontend/build/downloads`, and `/var/www/shoptest/downloads` all contain matching `shoptest-1.0.32.apk` and stable `shoptest.apk` artifacts.
- PASS: Live `https://pet.686888666.xyz/downloads/mobile-version.json` reports `1.0.32` / `10032`, `releaseSigned:true`, `/downloads/shoptest-1.0.32.apk`, and the expected SHA256.
- PASS: Downloaded live versioned and cache-busted stable APK URLs both returned size `3121762` and SHA256 `c526af68c2bf5d5879e8967e4eaedbe5e6421914db9f77cf356e9ce66f894acf`.
- PASS: Release certificate SHA256 is `99:62:28:98:90:D7:4A:1F:E9:DA:3E:4D:64:71:D2:C0:0B:21:C7:6F:C9:C0:62:2F:B9:33:48:CF:82:5D:88:0A`.
- PASS: APK artifact inspection found `cleartext:false`, HTTPS/WSS runtime endpoints, zero bundled `.map` files, zero `sourceMappingURL` references, zero manifest `.map` paths, and zero bundled `assets/public/downloads/` entries.
- PASS: `CI=true npm test -- --runTestsByPath src/utils/mobileUpdate.test.ts --watchAll=false` passed 6/6.
- PASS: Local `frontend/build` App WebView smoke at `390x844` verified no horizontal overflow on home and product detail, home hero CTAs at `128x44`, bottom nav items at `74x59`, product detail image at `372x388`, SKU chips at `157x44`, detail tabs at `44px` height, and mobile buybar actions at `100x44`.
- PASS: SKU selected state verified green in App mode: selected chip background `rgb(234, 244, 239)`, border `rgb(18, 71, 52)`, height `44px`.
- Pending: Real device/emulator install, launch, visual smoke, and upgrade validation for `1.0.32`.

## 2026-05-31 18:52 UTC - F407 native App bottom bar rhythm check

- Scope: Continued App regression rhythm focused on **F407** bottom navigation. Covered Android WebView-like `/`, `/products`, `/coupons`, `/cart`, authenticated `/profile`, and logged-out `/profile` login intercept.
- Environment: Reused existing CRA dev server `http://127.0.0.1:3000`; did not start, stop, or kill services. Playwright Chromium used Android WebView-like user agent, injected Capacitor/native runtime, and checked `390x844` DPR 3 plus `360x800` DPR 3.
- Data mode: `/api/*` was route-fulfilled with minimal deterministic fixtures to keep storefront/profile routes stable; this was a UI layout regression, not a backend data-chain validation.
- Media policy: **未截图、未录屏、未生成 trace/图片**. No screenshot, video, trace, recording, or image-capture API was invoked.

### F407 Result

- PASS: Native App class injection was active on every checked route: `bodyClass="shop-mobile-app shop-mobile-app--android"`.
- PASS: No CRA overlay, no `pageerror` events, and no failed network requests were observed.
- PASS: No horizontal overflow. All 12 route/viewport combinations reported `scrollWidth == clientWidth`, `bodyScrollWidth == clientWidth`, and `overflowDelta=0`.
- PASS: On `/`, `/products`, `/coupons`, `/cart`, and authenticated `/profile`, the native bottom bar had exactly 5 bottom-item DOM nodes and 5 visible buttons. No `.shop-nav__bottomItem--support` DOM node was rendered.
- PASS: Visible order remained Home, Products, Coupons, Cart, Account; Account was visible and to the right of Cart on every bottom-bar route.
- PASS: At `390x844`, bottom columns stayed equal at `74px`; Account measured `left=310 right=384 width=74 height=59`, leaving only `6px` to the viewport edge.
- PASS: At `360x800`, bottom columns stayed equal at about `68.8px`; Account measured `left=287.2 right=356 width=68.8 height=59`, leaving only `4px` to the viewport edge.
- PASS: Logged-out `/profile` redirected to `/login`; auth-flow bottom items were hidden (`visibleCount=0`) and had no horizontal overflow.
- Notes: Console showed only existing non-blocking Ant Design deprecation warnings, React Router future-flag warnings, and one existing React unknown-prop warning.
- Conclusion: **F407 remains FIXED** in the current App smoke rhythm. No new App bottom-nav issue was found.

## 2026-05-31 18:26 UTC - F407 native App bottom bar re-regression

- Scope: Re-regression for user-reported **F407** native App footer blank-space issue after the latest bottom-rail hardening. Covered Android WebView-like `/`, `/products`, `/coupons`, `/cart`, and authenticated `/profile`.
- Environment: Reused existing CRA dev server `http://127.0.0.1:3000`; did not start, stop, or kill services. Playwright Chromium used Android WebView-like user agent, injected Capacitor/native runtime, and checked `390x844` DPR 3 plus `360x800` DPR 3.
- Data mode: `/api/*` was route-fulfilled with minimal deterministic fixtures to keep storefront/profile routes stable; this was a UI layout regression, not a backend data-chain validation.
- Media policy: **未截图、未录屏、未生成 trace/图片**. No screenshot, video, trace, recording, or image-capture API was invoked.

### F407 Result

- PASS: Native App class injection was active on every checked route: `bodyClass="shop-mobile-app shop-mobile-app--android"`.
- PASS: No CRA overlay, no `pageerror` events, and no failed network requests were observed.
- PASS: No horizontal overflow. All 10 route/viewport combinations reported `scrollWidth == clientWidth`, `bodyScrollWidth == clientWidth`, and `overflowDelta=0`.
- PASS: Bottom bar consistently had `shop-nav__bottomBar--native`, `gridTemplateAreas="home products coupons cart account"`, exactly 5 bottom-item DOM nodes, and exactly 5 visible buttons. No `.shop-nav__bottomItem--support` DOM node was rendered in native App mode.
- PASS: Visible order was Home, Products, Coupons, Cart, Account. Account was visible and to the right of Cart on `/`, `/products`, `/coupons`, `/cart`, and authenticated `/profile`.
- PASS: At `390x844`, all checked routes measured five equal `74px` columns with Account `left=310 right=384 width=74 height=59`; right remainder was `6px`, so no large blank area remained.
- PASS: At `360x800`, all checked routes measured five equal columns around `68.8px` with Account `left=287.2 right=356 width=68.8 height=59`; right remainder was `4px`, so no large blank area remained.
- Notes: Console showed only existing non-blocking Ant Design deprecation warnings, React Router future-flag warnings, and one existing React unknown-prop warning.
- Conclusion: **F407 remains FIXED** after the latest native App bottom-rail hardening. No new App bottom-bar issue was found.

## 2026-05-31 18:04 UTC - F407 native App bottom bar regression

- Scope: Regression for developer-reported **F407 FIXED** bottom rail change. Checked Android WebView-like native App class injection on Home, `/products`, `/coupons`, `/cart`, `/profile` login intercept, and `/login`.
- Environment: Reused existing CRA dev server `http://127.0.0.1:3000`; did not start or stop services. Playwright Chromium used Android WebView-like user agent, injected Capacitor runtime, and two viewports: `390x844` DPR 3 and `360x800` DPR 3.
- Data mode: `/api/*` was route-fulfilled with minimal deterministic fixtures only to keep UI routes stable; this was not a backend data-chain validation.
- Media policy: **未截图、未录屏、未生成 trace/图片**. No screenshot, video, trace, recording, or image-capture API was invoked.

### F407 Result

- PASS: Native App class injection was active on every checked route: `bodyClass="shop-mobile-app shop-mobile-app--android"`.
- PASS: No CRA overlay and no `pageerror` events were observed.
- PASS: No horizontal overflow. Both viewports reported `scrollWidth == clientWidth` and `bodyScrollWidth == clientWidth` on Home, `/products`, `/coupons`, `/cart`, `/profile` redirect, and `/login`.
- PASS: On Home, `/products`, `/coupons`, and `/cart`, the bottom bar had 6 DOM items but exactly 5 visible items. The hidden item was `.shop-nav__bottomItem--support` with `display=none`, `width=0`, `height=0`.
- PASS: Visible item order was stable and semantic: Home, Products, Coupons, Cart, Account.
- PASS: Account occupied the far-right visible column on all checked commerce routes. At `390px`, visible item rects were Home `left=6 right=80 width=74`, Products `82-156`, Coupons `158-232`, Cart `234-308`, Account `310-384`; gaps were `2px`, widths were equal, and the remaining right edge was only a 6px safe inset, not a large blank column. At `360px`, visible item rects were Home `4-72.8 width=68.8`, Products `74.8-143.6`, Coupons `145.6-214.4`, Cart `216.4-285.2`, Account `287.2-356`; gaps were `2px`, widths were equal, and the remaining right edge was 4px.
- PASS: `/profile` while logged out redirected to `/login`; `/login` and the redirected auth-flow shell hid the bottom bar (`display=none`, visible item count `0`), with no horizontal overflow.
- Notes: Console showed only existing non-blocking Ant Design deprecation warnings and React Router v7 future-flag warnings.
- Conclusion: **F407 remains FIXED** in Android WebView-like regression. No new App bottom-bar issue was found.

## 2026-05-31 17:55-17:58 UTC - Android WebView-like App smoke round #1

- Scope: Home, product list, search/filter URL, product detail, quick-add, cart, checkout entry, login, register, forgot password, coupons, order tracking, Profile login intercept, Pet Finder, Pet Gallery, support entry, top/bottom navigation, language switch, mobile update prompt, APK signing.
- Environment: Reused existing CRA dev server `http://127.0.0.1:3000`; did not start or stop services. Playwright Chromium used a `390x844`, DPR 3, Android WebView-like user agent with injected Capacitor runtime.
- Data mode: `/api/*` responses were route-fulfilled with deterministic fixture data to avoid the known local CRA `/api` proxy/CORS limitation. This limits backend/live-data validation and is recorded as an environment limitation, not a product bug.
- Media policy: **未截图、未录屏、未生成 trace/图片**. No screenshot, video, trace, recording, or image-capture API was invoked.

### Results

- PASS: Native App class injection worked on all checked App routes: body class included `shop-mobile-app shop-mobile-app--android`.
- PASS: No CRA compile overlay and no `pageerror` events on checked routes.
- PASS: No horizontal overflow on checked routes. `clientWidth=390`, `scrollWidth=390`, and `bodyScrollWidth=390` across Home, `/products`, filtered product list, `/products/1`, `/cart`, `/checkout`, auth pages, `/coupons`, `/track-order`, `/profile` redirect, `/pet-finder`, and `/pet-gallery`.
- PASS: F403 remains fixed. Home hero measured inside viewport: `.shopee-hero left=12 right=378`, hero title/copy/actions/buttons `left=29 right=361`; hero buttons were `332x44`.
- PASS: F402 remains fixed for Home and ProductList product actions. Home quick actions measured repeated `View all/Add to cart/Favorite = 44x44`; ProductList actions measured `Quick preview = 44x44`, `Quick add = 91x44`, `Favorite = 44x44`, `Compare = 44x44`.
- PASS: F404 zero-price default filter did not reproduce. Default `/products` requested `/products?sort=default&page=0&size=12` with no `minPrice=0` or `maxPrice=0`, rendered 4 product cards, and quick-add opened the modal and produced guest cart count `1`.
- PASS: Filter/search smoke opened `/products?keyword=harness&discount=true&petSize=medium&material=nylon&color=blue`; the product list rendered a matching fixture card and no overflow.
- PASS: Cart and checkout entry were reachable after quick-add. `/cart` and `/checkout` rendered in App mode with no bottom-nav overlap or horizontal overflow.
- PASS: Login, register, and forgot-password App auth flows rendered with nav/bottom bar hidden and no horizontal overflow.
- PASS: Coupons, order tracking, Pet Finder, and Pet Gallery rendered with fixture API responses. Order tracking showed fixture order `SO20260531001` and tracking number `1Z999AA10123456784`.
- PASS: Profile login intercept worked while logged out: `/profile` navigated to `/login`.
- PASS: Support entry worked in focused retest. Clicking `.app-support-launcher` opened `.customer-support-widget__panel`, visible at `left=8 top=177.5 width=374 height=658.5`; launcher measured `48x48`.
- PASS: Bottom navigation targets measured `74x59` and stayed within viewport.
- PASS: Language switch worked through the native App top locale menu; nav class changed to `shop-nav--es`.
- PASS: Mobile update prompt displayed when the manifest fixture reported `1.0.24 > installed 1.0.23`; clicking the modal download action called Capacitor Browser.open with `http://127.0.0.1:3000/downloads/shoptest-1.0.24.apk`.
- FAIL: Added **F408 OPEN**. Native App top navigation language/more/cart controls measured `44x36` on Home, `/products`, filtered list, product detail, cart, checkout, coupons, order tracking, Pet Finder, Pet Gallery, support-entry route, and language-switch route. Width improved to 44px, but actual clickable height remains below the 44px target.
- OPEN: F334 remains open. `frontend/public/downloads/shoptest.apk` and `frontend/build/downloads/shoptest.apk` share SHA256 `e178c75aac460cb5b9f36b879e489aacf20cdc00133ce5e2fa3e3702b79ecfea`; `keytool -printcert -jarfile frontend/public/downloads/shoptest.apk` still reports owner/issuer `C=US, O=Android, CN=Android Debug`.

### Console / Network Notes

- Console had no page errors. Non-blocking warnings observed: Ant Design `popupClassName` / `destroyOnClose` deprecations, React Router v7 future-flag warnings, and one React unknown-prop warning.
- Route-fulfilled network evidence included `/products?sort=default&page=0&size=12`, `/products/1`, `/products/finder-candidates?...`, `/coupons/public`, `/orders/track?orderNo=SO20260531001&email=guest%40example.com`, `/pet-gallery`, `/pet-gallery/quota`, and `/downloads/mobile-version.json`.
