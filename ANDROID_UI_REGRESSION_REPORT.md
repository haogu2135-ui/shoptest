# Android UI 回归测试报告

> 测试日期: 2026-06-05
> 测试环境: 当前工作区代码（已修改文件验证）
> 测试依据: ANDROID_UI_ISSUES.md + ANDROID_UI_REGRESSION_PLAN.md

---

## 2026-06-05 开发修复更新（源码层）

> 状态: ✅ 已完成源码修复，⏳ 待 Android 真机/WebView/截图回归复测
> 校验: `git diff --check` 通过；未执行构建、未发布 APK、未跑截图/真机测试
> 归档: 已关闭/源码闭合项已先归档到 `ANDROID_UI_CLOSED_ARCHIVE.md`；本报告继续保留待复测入口。

### 本轮已覆盖

| 范围 | 处理结果 |
|------|----------|
| T09-T21 历史回归失败项 | `ProductReview.css`、`OrderManagement.css`、`Cart.css`、`PetGallery.css`、`PetFinder.css`、`Login.css`、`CustomerSupportWidget.css`、`CouponCenter.css`、`Register.css`、`ProductCompare.css`、`Notifications.css`、`Wishlist.css`、`AdminDashboard.css` 已追加 Android 触控闭合规则；关键按钮/输入实际目标收口到 ≥44px，购物车数量步进器为 48px |
| 第二轮后台/辅助页 | `UserManagement.css`、`ReviewManagement.css`、`CouponManagement.css`、`ProductManagement.css`、`BrowsingHistory.css` 补齐表格操作按钮、筛选按钮、Modal footer、变体行和小字号保护 |
| 核心商城补充项 | `ProductDetail.css`、`Checkout.css`、`Profile.css`、`CartDrawer.css` 补齐购买栏、详情 Tab、空购物车按钮、订单操作、抽屉信任徽章等触控/字号/输入框保护 |
| TSX 无障碍与状态 | `CustomerSupportWidget.tsx` 增加 Escape 关闭、session 创建加载状态、订单加载失败 Alert；`Profile.tsx` 加载态改为 `Spin` + `role=status` + `aria-live`，移动入口增加 `tablist/tab` |
| 原生返回键 | `nativeBack.ts` 增加防抖，移除 `(0,0)` 合成点击，`useNativeBackHandler` 改为稳定注册 |
| PWA/Android meta | `manifest.json` 增加 maskable 图标 purpose、scope、orientation、categories、description，主题色改为绿色；`index.html` 增加 Android 全屏和电话识别 meta |
| 全局守卫 | `index.css` 全局按钮默认从 34px 提到 44px，并对 860px 以下输入框设置 16px；`mobile-page-contrast.css` 恢复链接可区分颜色；`SkeletonLoader.css` 限制 shimmer 背景尺寸 |
| 22:34 最终兜底 | `mobile-app.css` 追加靠后 Android/App 闭合层，防止 lazy 页面后加载把触控目标压回 30/34/38px；底部导航恢复 12px 文案、绿色激活态和 10% 图标放大；商品详情 SKU 最终选中态恢复绿色。`index.css` 补齐非原生移动端 44px/16px 与 `overflow-x: clip` 兼容回退 |
| 23:17 精修闭合 | `Navbar.tsx` 徽标/登出失败不再静默；`Cart.tsx/css` 去掉错误态和空态图标硬编码尺寸；`ProductDetail.tsx/css` 图片 Modal 视口约束，移动图片轮播改为 proximity snap |
| 23:36 运行时最终闭合 | `androidUiFinalGuard.ts` + `App.tsx` 注入并刷新移动端最终 guard，保证它在懒加载页面 CSS 之后生效；统一补住 Android WebView/App 的 44px 触控、16px 输入、>=12px 小字、Modal/Drawer 视口、商品详情图片/缩略图/SKU、首页商品卡和管理页溢出网格风险 |
| 00:16 购物车/结算状态闭合 | `Cart.tsx/css` 缺货或不可买行显示本地化状态 chip，不再显示禁用数量 `1` 或可购买小计；`Checkout.tsx/css` 登录态运费 quote 未完成/失败时显示计算或不可用状态，禁用并阻断提交，避免未知运费被展示为包邮 |
| 01:35 访客订单链路闭合 | 后端新访客订单使用 `guest_order` 标记，`shippingAddress` 只保存收货地址，姓名/电话/邮箱进入专用字段；查单、客服、支付返回路径兼容新标记和旧 `[Guest]` 历史订单。该项影响 Android App/WebView 访客结账、查单、客服入口和支付返回 |
| 02:18 客服消息安全显示闭合 | `SupportService` 在客服消息入库前解码常见/数字 HTML 实体并中和 `<`/`>`；客户客服浮窗和后台客服页当前以 React 文本渲染消息内容。该项影响 Android App/WebView 客服消息气泡显示 |

### 待复测重点

1. Android 360/380/428/768 宽度下，T09-T21 是否全部达到 ≥44px。
2. 客服面板打开时按 Escape、原生返回键、订单下拉失败提示是否符合预期。
3. Profile 加载态和移动 tab 的可访问性属性是否可见。
4. ProductDetail/Checkout/Profile/CartDrawer 的新增闭合规则是否造成布局挤压。
5. PWA 安装后的状态栏主题色、maskable 图标显示是否正常。
6. 评价晒单图片上传/预览/删除在 Android WebView 下是否保持 ≥44px 触控目标、1:1 图片预览、无横向溢出，并确认后台评价管理表格缩略图不挤压操作按钮。
7. 第四轮剩余管理页/组件在 Android WebView 下的最终 computed 样式：Brand/Category/Notification/Alert/IpBlacklist/Log/StockAlerts/AddOn/SearchBar/PetPersonalized/Payment/SocialProofToast/ProductManagement import tooltip/Coupon grant modal 是否满足 44px 触控、16px 输入、>=12px 小字、长文案换行和无横向溢出。
8. 22:34 最终兜底后的 App 全局 computed 样式：所有点名按钮/选择器/关闭按钮不低于 44px，底部导航文字不再是 10px，SKU 选中态保持绿色。
9. 23:17 精修后的失败态/预览态：Navbar 接口失败轻提示、登出撤销失败提示、Cart 错误/空态高度、商品图片 Modal 宽度和移动轮播最后一张对齐。
10. 23:36 最终 guard 后的 cascade 顺序：打开任意懒加载页面后确认 `<head>` 最后存在 `shop-android-ui-final-guard`，并读取 computed size，确认后加载页面 CSS 没有覆盖 44px/16px/12px 规则。
11. 00:16 购物车/结算状态：Android WebView 下构造 stock=0、下架、数量大于库存的购物车行，确认数量区显示缺货/暂不可买而不是 `1`；登录态 checkout 模拟 quote 慢/失败/成功，确认运费不会短暂显示包邮，提交按钮在 quote 未 ready 时不可用。
12. 01:35 访客订单链路：Android WebView 下完成新访客结账，确认订单详情/查单/客服/支付返回均识别为访客订单且不依赖 `shippingAddress` 中的 `[Guest]` 前缀；同时用旧前缀订单做兼容回归。
13. 02:18 客服消息安全显示：客户客服、访客订单客服、后台客服和 WebSocket 客服消息中发送 raw/encoded/nested HTML payload 后，应只显示安全文本，无脚本执行、无消息气泡溢出，普通文本发送不回归。

> 说明: 下方 “部分修复/未触及” 表格是本报告早前回归失败的历史快照；22:34 已做源码补修，保留这些条目作为真机/WebView 复测清单，不再表示仍未开发处理。

## 一、回归测试结果

### ✅ 已修复 (8项)

| # | 文件 | 问题 | 修复前 | 修复后 | 验证 |
|---|------|------|--------|--------|------|
| T01 | Navbar.css | 底部导航栏按钮 | 34-38px | **44-50px** | ✅ 通过 |
| T02 | mobile-app.css | 全局按钮保护 | 无 | **44px !important** | ✅ 通过 |
| T03 | Home.css | 产品卡片快速操作 | 36px | **44px** | ✅ 通过 |
| T04 | Home.css | 多处字号 | 10-12px | **13-29px** | ✅ 通过 |
| T05 | ProductReview.css | 字号 | 12px | **13-15px** | ✅ 通过 |
| T06 | OrderManagement.css | 部分按钮 | 34px | **44px** | ✅ 通过 |
| T07 | BugManagement.css | 按钮触摸目标 | 32px | **44px** | ✅ 通过 |
| T08 | SystemMonitor.css | 按钮触摸目标 | 32px | **44px** | ✅ 通过 |

### ⏳ 历史部分修复项（已源码补修，待复测）

| # | 文件 | 问题 | 修复前 | 源码补修 | 状态 |
|---|------|------|--------|--------|------|
| T09 | ProductReview.css | 提交按钮高度 | 38-42px | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T10 | OrderManagement.css | 表单输入框高度 | 34px | ≥44px 闭合规则 | ⏳ 待 Android 复测 |

### ⏳ 历史未触及项（已源码补修，待复测）

| # | 文件 | 关键问题 | 修复前 | 源码补修 | 状态 |
|---|------|---------|--------|--------|---------|
| T11 | Cart.css | 数量步进器按钮 | **30px** | 48px 闭合规则 | ⏳ 待 Android 复测 |
| T12 | PetGallery.css | 删除/相机按钮 | **30px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T13 | PetFinder.css | 商品卡片操作按钮 | **30px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T14 | Login.css | 链接按钮 | **34px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T15 | CustomerSupportWidget.css | 链接按钮 | **26px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T16 | CouponCenter.css | Hero计划按钮 | **32px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T17 | Register.css | 验证码发送按钮 | **32px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T18 | ProductCompare.css | 表格操作按钮 | **32px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T19 | Notifications.css | 列表操作按钮 | **36px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T20 | Wishlist.css | 删除按钮(360px) | **38px** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |
| T21 | AdminDashboard.css | 全局按钮 | **无保护** | ≥44px 闭合规则 | ⏳ 待 Android 复测 |

---

## 二、修复质量评估

### 正面发现
1. **mobile-app.css 全局保护**: 添加了 `min-height: 44px !important` 全局规则，覆盖原生App中所有按钮
2. **Navbar.css 底部导航**: 底部导航栏按钮从34-38px提升至44-50px，符合Android触摸标准
3. **Home.css 产品卡片**: 快速操作按钮统一提升至44px，字号从10px提升至13-29px
4. **管理后台页面**: BugManagement、SystemMonitor等页面按钮已修复至44px

### 待改进
1. **真机/WebView 复测**: 需要在 Android 360/380/428/768 宽度下读取 computed size，确认页面级闭合规则和 `mobile-app.css` 最终闭合层没有被运行时样式覆盖。
2. **视觉压缩检查**: ProductDetail、Checkout、Profile、CartDrawer 需要确认 44px 控件提升后没有挤压商品图片、价格区、表单和底部购买栏。
3. **长期清理**: 源码中仍保留历史小尺寸规则，当前依赖靠后的闭合层覆盖；后续应按页面模块逐步删除旧规则，降低 CSS 维护成本。

---

## 三、下一步行动

### 给回归工程师
以下文件需要继续复测 computed 样式（按优先级排序）：

**P0 - 优先复测:**
1. `Cart.css` - 数量步进器 30px → 48px
2. `PetGallery.css` - 删除/相机按钮 30px → ≥44px
3. `PetFinder.css` - 商品卡片按钮 30px → ≥44px
4. `CustomerSupportWidget.css` - 链接按钮 26px → ≥44px
5. `Login.css` - 链接按钮 34px → ≥44px
6. `Register.css` - 验证码按钮 32px → ≥44px
7. `CouponCenter.css` - Hero按钮 32px → ≥44px
8. `AdminDashboard.css` - 全局按钮保护 → ≥44px

**P1 - 后续复测:**
9. `ProductCompare.css` - 表格按钮 32px → ≥44px
10. `Notifications.css` - 操作按钮 36px → ≥44px
11. `Wishlist.css` - 删除按钮 38px → ≥44px
12. `ProductReview.css` - 提交按钮 38px → ≥44px
13. `OrderManagement.css` - 表单输入框 34px → ≥44px

---

## 四、测试统计

| 类别 | 总数 | 源码已补修 | 真机待复测 | 当前失败 |
|------|------|------|---------|------|
| 已修改文件验证 | 10 | 10 | 2 | 0 |
| 历史未触及项 | 11 | 11 | 11 | 0 |
| **总计** | **21** | **21** | **13** | **0** |

**源码处理率: 100%** (21/21)
**需真机/WebView复测: 13项**

## 2026-06-06 01:52 UTC Static Cart/Guest-Cart UI Addendum

No automated UI test, Android device/WebView run, screenshot, Playwright run, build, service restart, APK publish, curl, Maven/Jest run, or code commit was performed in this pass.

| Area | Status | Evidence | UI follow-up |
|---|---|---|---|
| Cart suggested/add-on add-to-cart id guard | SOURCE FIXED / UI REGRESSION PENDING | `Cart.tsx` validates suggested-product ids before cart API or guest-cart mutation and uses the guarded numeric id for selection matching. | Verify Cart add-on/suggested product add in App/WebView for guest and authenticated sessions; invalid ids should show a readable failure without adding a malformed row. |
| Guest cart flat migration | SOURCE FIXED / UI REGRESSION PENDING | `guestCart.ts` now strips nested `product` from normalized return/persisted rows while still using legacy snapshots to recover name/image/price/stock. | Verify old localStorage rows render in Cart, Checkout, and CartDrawer, then confirm add/update/remove keeps rows flat and titles readable. |

## 2026-06-06 02:18 UTC Static Support Message UI Addendum

No automated UI test, Playwright run, Android device/WebView run, screenshot, build, service restart, APK publish, curl, Maven/Jest run, or code commit was performed in this pass.

| Area | Status | Evidence | UI follow-up |
|---|---|---|---|
| Support message HTML payload display | BACKEND SOURCE_FIXED / UI REGRESSION PENDING | `SupportService.normalizeContent()` decodes common/numeric HTML entities and neutralizes `<`/`>` before support messages are persisted; `CustomerSupportWidget.tsx` and `SupportManagement.tsx` render message content as React text. | Verify Android WebView/App customer support, guest-order support, admin reply, and WebSocket support messages with raw `<script>`, encoded `&lt;img ...&gt;`, and nested `&amp;lt;script&amp;gt;` payloads. Expected: safe readable text, no script execution, no bubble overflow, and ordinary text still sends. |
| Profile raw key fallback report | CURRENT_SOURCE_COVERED / ARCHIVED | Current `Profile.tsx` lacks the reported arbitrary fallback and shared i18n has humanized final fallback. | No old-path UI retest unless a current Profile screenshot shows raw translation keys. |
