# Android UI 问题报告

> 审查日期: 2026-06-05
> 审查范围: 前端所有页面和组件的移动端CSS + React TSX组件逻辑 + Android原生App适配
> 审查标准: Android Material Design 触摸目标最小48px、WCAG AA对比度4.5:1、移动端最小字号12px、WAI-ARIA无障碍规范
> 说明: 下方问题表保留 UI 工程师原始审查快照；当前处理状态以“2026-06-05 开发处理记录”和回归报告顶部为准。
> 已归档: 源码层已关闭或已有 PASS 证据的问题已先归档到 `ANDROID_UI_CLOSED_ARCHIVE.md`；当前主线只继续跟踪 Android WebView/真机/截图回归。

---

## 2026-06-05 开发处理记录

> 状态: ✅ 源码已修复，✅ Android WebView 模拟截图/计算审计通过，⏳ 真机/Appium 待连接设备；本地 APK 已构建到 `1.0.38`

- 2026-06-11 00:20 UTC 补充: 已按当前 HEAD 重新处理宠物工具/商品对比移动端 UI-20260608-02、UI-20260608-03 的源码风险。`PetFinder.css`、`PetGallery.css`、`ProductCompare.css` 中点名 eyebrow 移动端字号保持 12px，不再回落到 11px；390/430px 对比页头部操作按钮改为单列完整文案、44px 命中区并取消 ellipsis 裁剪。新增 `PetCompareMobileUiGuard.test.ts` 源码守卫覆盖这两项；本轮因 `frontend/node_modules` 缺失未跑 Jest/tsc/Playwright，需 Android WebView/真机复测宠物查找、宠物图库和商品对比页。
- 2026-06-06 08:47 UTC 补充: 测试环境账号恢复已完成，`users` 表 173 个用户密码已统一重置为 `84813378`，`password_changed_at` 均为 `2026-06-06 08:31:45.608`；已用 `test / 84813378` 调 `/auth/login` 验证成功并拿到 USER token，后端健康检查为 UP。
- 2026-06-06 08:47 UTC 补充: APP 端 UI 做了本轮全页收口。`Checkout.tsx` 修复空/加载结账页 AntD form 未连接警告；`mobile-app.css` 最终兜住原生 App 顶部导航搜索输入和按钮 44px 命中区；同时保留前序全局 guard 清理、商品列表分页/按钮、详情页 Tab/画廊、视频 iframe warning 等修复。`npm run build` 已通过，仅剩 Browserslist/caniuse-lite 过期提示。
- 2026-06-06 08:47 UTC 补充: 已用 Android App WebView 条件在 390x844 视口跑截图审计。目标 7 页报告 `app-ui-audit-20260606-targeted/report.json`，覆盖 `/`、`/products`、`/products/9210`、`/checkout`、`/coupons`、`/history`、`/pet-gallery`，结果 7/7 PASS：HTTP 200、console error/warning 0、横向溢出 0、小于 44px 可见触控目标 0、`scrollWidth=clientWidth=390`。
- 2026-06-06 08:47 UTC 补充: 已跑全量 17 页报告 `app-ui-audit-20260606-fullpass/report.json`，覆盖首页、商品、详情、购物车、结账、登录、注册、个人页、优惠券、收藏、历史、库存提醒、通知、查单、宠物查找、宠物图库、对比页，结果 17/17 PASS；对应截图在 `app-ui-audit-20260606-fullpass/*.png`。本轮未重新打 APK，仍建议后续用真机/正式 APK 做最后烟测。
- 2026-06-06 09:30 UTC 补充: APP 端继续做全页/残留问题精修并完成三档 Android WebView 审计。最终报告 `/root/shoptest/app-ui-audit-20260606-polish-rerun3/summary.json` 覆盖 360/390/430px 下首页、商品列表、购物车、结账、个人页、收藏、通知、优惠券、宠物图库、浏览历史、库存提醒，共 33 项检查，结果 33/33 PASS、失败 0；未再发现小于 44px 的可见触控目标、未命名图标按钮、页面横向溢出或固定/粘性区域遮挡问题。
- 2026-06-06 09:30 UTC 补充: 本轮 APP 端重点修复原生/WebView 观感问题：`Navbar.tsx` 中原生 App 顶部徽标刷新失败不再弹出大面积顶部 toast，通知/更多/购物车命中区稳定为 44x44；`mobile-app.css` 把商品列表、优惠券中心、宠物图库、浏览历史、库存提醒、通知等页面原本压住内容的 fixed/sticky 工具条收回正常内容流，并把 Ant toast 收敛为单条紧凑提示，避免半屏提示堆叠。
- 2026-06-06 09:30 UTC 补充: `npm run build` 已通过，仅剩 Browserslist/caniuse-lite 过期提示。构建生成的本地 APP 版本为 `1.0.38` / `10038`，`frontend/public/downloads/mobile-version.json` 指向 `shoptest-1.0.38.apk`，SHA256 `633421d29f9ed06f305fc30dc83f1e8d5fbfebe5921d0d88db76d59f19def632`。
- 2026-06-06 09:30 UTC 补充: Appium 自动化基础问题已源码闭合：`mobile-tests/appium` 可解析到 `app-launch.test.js`、`navigation.test.js`、`webview.test.js` 三个 spec，`npm ls chai --depth=0` 返回 `chai@4.5.0`。当前阻塞已推进到设备层，`PATH=/opt/android-sdk/platform-tools:... adb devices -l` 只有表头、无已连接设备，因此真机安装、Appium 会话、真实触摸/滚动视频仍待连接 Android 设备或启动模拟器后执行。
- 触控目标: 已对 `Cart.css`、`PetGallery.css`、`PetFinder.css`、`CustomerSupportWidget.css`、`Login.css`、`Register.css`、`CouponCenter.css`、`AdminDashboard.css`、`ProductCompare.css`、`Notifications.css`、`Wishlist.css`、`ProductReview.css`、`OrderManagement.css` 等追加高优先级 Android 闭合规则，所有明确点名的按钮/输入控件收口到 ≥44px，购物车数量步进器为 48px。
- 字号/输入框: 已补充移动端小字号不低于 12px、输入框 16px 的页面级和全局守卫，覆盖客服、登录、注册、购物车、结账、详情、Profile、后台表格等点名页面。
- 对比度: 已强化 Coupon/Wishlist/Notifications/ProductCompare 点名低对比文本，并修复 `mobile-page-contrast.css` 中链接与正文不可区分的问题。
- TSX 无障碍/状态: `CustomerSupportWidget.tsx` 已支持 Escape 关闭、session 加载状态、订单加载失败显式 Alert；`Profile.tsx` 加载态已加入 Spin/`role=status`/`aria-live`，移动 Tab 已补 `tablist/tab`。
- 原生返回键: `nativeBack.ts` 已增加防抖、移除 `(0,0)` 合成点击并稳定注册 handler。
- PWA/Android 配置: `index.html` 与 `manifest.json` 已修复主题色、Android 全屏 meta、电话识别、maskable 图标、scope、orientation、categories、description。
- 2026-06-05 22:09 UTC 补充: `ProductReview` 评价晒单图片上传/预览/删除和后台评价图片展示样式已补齐，移动端上传/删除按钮保持 ≥44px，图片统一 1:1 预览，三语文案已补齐；该源码变更仍待 Android WebView/截图回归。
- 2026-06-05 22:20 UTC 补充: 第四轮点名的剩余管理页/组件源码闭合已补齐或确认已有后续 guard 覆盖。`SearchBar.css` 输入框提升到 44px/16px；`AddOnAssistant.css`、`PetPersonalizedAssistant.css`、`Payment.css`、`SocialProofToast.css` 补齐移动端字号/对比度/触控闭合；`ProductManagement` 导入说明 Tooltip 和 `CouponManagement` 发券说明补齐长文案换行/宽度保护；Brand/Category/Notification/Alert/IpBlacklist/Log/StockAlerts 的 44px 后续 guard 已存在，需截图验证最终 computed size。
- 2026-06-05 22:34 UTC 补充: 已追加最终 Android/App 闭合层。`mobile-app.css` 在靠后位置用 `body.shop-mobile-app.shop-mobile-app` 兜住 lazy 页面后加载导致的 30/34/38px 回退，统一原生 App 控件 ≥44px、输入 16px、小标签 ≥12px；底部导航文字恢复到 12px、激活态绿色高亮且图标放大；商品详情 SKU 最终选中态恢复绿色边框/浅绿背景。`index.css` 同步补齐非原生移动端基础 44px/16px 和 `overflow-x: clip` 兼容回退。仍未构建/未发布 APK，需 Android WebView/真机截图回归确认。
- 2026-06-05 23:17 UTC 补充: 精修回归清单里仍可静态命中的 UI/交互风险。`Navbar.tsx` 对购物车/通知/收藏/优惠券/库存提醒徽标加载失败增加一次性可见提示和控制台上下文，登出撤销失败不再静默；`Cart.tsx` 的错误态空白区和空态图标从内联固定像素改为响应式 CSS；`ProductDetail.tsx` 图片预览 Modal 从固定 800px 改为视口约束，`ProductDetail.css` 移动图片轮播从强制吸附改为 proximity，降低 Android WebView 最后一张对齐风险。仍未构建/未发布 APK，需按回归计划复测。
- 2026-06-05 23:36 UTC 补充: 已新增最终运行时 Android UI guard。`frontend/src/utils/androidUiFinalGuard.ts` 会注入移动端最终 CSS，并通过 head observer 保持在懒加载页面 CSS 之后；`App.tsx` 在路由切换后刷新 guard，防止 Android WebView/App 中按钮、输入框、小字、Modal/Drawer、商品详情图片/SKU、首页商品卡和管理页网格被后加载 CSS 压回旧的小尺寸。已关闭/源码闭合项先归档到 `ANDROID_UI_CLOSED_ARCHIVE.md`，本轮未构建/未发布 APK，仍需真机/截图复测。
- 2026-06-06 00:16 UTC 补充: 继续按 Android UI/购物车结算回归清单收口。`Cart.tsx`/`Cart.css` 对缺货或不可买行不再展示禁用数量输入和值 `1`，改为本地化缺货/暂不可买状态 chip，小计也不再显示为可购买金额；`Checkout.tsx`/`Checkout.css`/三语文案对登录态运费 quote 增加 loading/ready/error 状态，运费未确认时显示计算中或不可用并禁用/阻断提交，避免未知运费显示为包邮。`CartPageMemo.tsx` 相关报告在当前源码中不存在，已作为 stale/current-source-covered 归档。未构建/未发布 APK，需 Android WebView/真机复测。
- 2026-06-06 00:34 UTC 补充: 已同步本轮关闭归档。`Checkout.tsx`/`Checkout.css`/三语文案对常用地址加载失败增加地址卡内警告、说明和重试，并保持新地址下单路径可用；`ErrorBoundary.tsx` 改为通过 `reportNonBlockingError` 记录错误和组件栈。F1516 已由现有付款重试路径覆盖，F1519-F1525 所指旧文件/函数在当前源码中不存在或已被替代，均先归档为 current-source-covered/stale。未构建/未发布 APK，需后续 Android WebView/真机复测地址失败、错误兜底和常规结账流。
- 2026-06-06 00:36 UTC 补充: 购物车回归 F1556/F1557 已源码修复并先归档。`guestCart.ts` 兼容旧版/测试里的嵌套 `product` 访客购物车快照，读取时统一归一化为扁平 `CartItem` 字段；缺少商品名但 productId 有效的行继续交给购物车、结账页和抽屉的 `Product #{id}` 兜底文案，避免标题空白。已补 `guestCart.test.ts` 覆盖该数据形态，但本轮未运行 Jest/构建/APK，需后续 Android WebView/真机复测访客购物车、结账和抽屉展示。
- 2026-06-06 01:35 UTC 补充: 本轮未继续叠加首页/详情页全局 UI 覆盖，避免扩大样式回归；已把当前 `ANDROID*.md` 中源码闭合项同步归档到 `ANDROID_UI_CLOSED_ARCHIVE.md`。同时修复影响 App 订单链路的访客订单后端问题：新访客订单使用 `guest_order` 标记，收货地址不再拼接姓名/电话/邮箱，客服/支付/查单路径兼容新标记和旧 `[Guest]` 历史订单。未构建/未发布 APK，需 Android WebView/真机复测访客结账、查单、客服、支付返回与订单详情。
- 2026-06-06 02:18 UTC 补充: 已同步支持消息存储 XSS 源码闭合项。`SupportService` 在客服消息入库前解码常见/数字 HTML 实体并中和 `<`/`>`，客服浮窗和后台客服页当前以 React 文本方式渲染内容；已归档为源码关闭、Android/App 客服显示回归待测。未构建/未发布 APK，需 Android WebView/真机复测客户/访客/后台客服消息中包含 raw/encoded HTML 时只显示安全文本且无布局异常。
- 2026-06-06 05:55 UTC 补充: 本轮登录恢复、防复发和发布链路修复后，当前 Android 回归目标已切到 release-signed `1.0.35` / `10035`。公网 manifest 指向 `shoptest-1.0.35.apk`，版本化 APK SHA256 为 `a7753de4e5d535230025ee502ed041223307e5cc950dcc1b616b9cb21769373a`；登录误封根因是 QA/生产出口 IP `129.146.180.88` 被登录失败保护封禁，现已 RELEASED，active LOGIN blocks 为 0，坏密码登录返回后端 400 而非黑名单 403。首页/详情页/底部导航等 Android UI 源码闭合项已经随当前 APK 进入回归范围，仍需 Android WebView/真机截图验证。
- 2026-06-08 09:31 UTC 补充: 已用 Android App WebView 模拟条件补跑宠物查找、宠物图库和商品对比页交互审查，报告 `app-ui-audit-20260608T-pet-compare-app-codex/REPORT.md`，原始数据 `app-ui-audit-20260608T-pet-compare-app-codex/report.json`。覆盖 320x568、390x844 两档视口，24 张截图，未发现网络失败或脚本运行错误；仍复现 3 组 UI 问题，详见下方“2026-06-08 Android App WebView 宠物工具/对比页回归发现”。
- 2026-06-08 16:15 UTC 补充: 已按当前 worktree 复跑手机 App UI 脚本。`audit-mobile-app-checkout-flow-ui.js`、`audit-mobile-app-auth-order-ui.js`、`audit-mobile-app-profile-support-ui.js` 仍复现 A-15/A-16、A-17/A-19、A-20；`audit-mobile-app-account-utilities-ui.js` 中 A-21 已回归通过、A-22 仍复现；`audit-mobile-app-pet-compare-ui.js` 当前 24 个状态 0 issue，历史 UI-20260608-01~03 已在脚本覆盖下通过；商品详情购买条小范围复跑见 `app-ui-audit-20260608T-product-detail-buybar-current-codex/`，未新增待修问题。
- 2026-06-08 23:35 UTC 补充: 已完成 A-15、A-16、A-17、A-18、A-19、A-20、A-22 源码修复并用 Android App WebView 模拟脚本复跑通过；A-21 保持 PASS。验证命令: `npm test -- --runTestsByPath src/api/index.test.ts src/pages/Checkout.test.tsx src/components/CustomerSupportWidget.test.tsx src/pages/OrderTracking.test.tsx src/pages/StockAlerts.test.ts src/pages/BrowsingHistory.test.ts --watchAll=false --runInBand`、`npx tsc --noEmit --pretty false`、`node audit-mobile-app-checkout-flow-ui.js`、`node audit-mobile-app-profile-support-ui.js`、`node audit-mobile-app-auth-order-ui.js`、`node audit-mobile-app-account-utilities-ui.js`。证据目录: `app-ui-audit-20260608T-checkout-flow-codex/report.json`、`app-ui-audit-20260608T-profile-support-app-codex/report.json`、`app-ui-audit-20260608T-auth-order-codex/report.json`、`app-ui-audit-20260608T-account-utilities-app-codex/report.json`；4 个审计报告均为 issueCount 0、network/run errors 0。真机/Appium 仍待连接 Android 设备后最终确认。
- 2026-06-09 00:13 UTC 补充: 已完成 A-09、A-10、A-11、A-12、A-13、A-14 源码修复并通过 Android App WebView 模拟复跑。`node audit-mobile-app-storefront-ui.js` 最新报告 `app-ui-audit-20260608T-mobile-storefront-codex/report.json` 覆盖 69 个 route state，`issueStateCount: 0`、`issueCounts: {}`、network failures 0、route errors 0、`useFormWarningCount: 0`、Cascader deprecated warning 0。验证命令: `npx tsc --noEmit --pretty false`、`npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand`、`node audit-mobile-app-storefront-ui.js`。A-14 专项复跑 `node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js` 中 `add to cart opens drawer and full cart entry` PASS；该 smoke 总体 6/7，剩余 checkout readiness 场景仍记录为 A-15 脚本后续问题，证据显示支付方式已渲染但 region best-effort 选择为 0 次。
- 未在本轮引入 Capacitor 依赖或 android 平台目录；当前仓库未发现 Capacitor 依赖，APK 构建路径应按现有发布脚本继续维护。

## 2026-06-08 Android App WebView 宠物工具/对比页回归发现

> 状态: 2026-06-08 16:13 UTC 当前脚本复跑 PASS；本节保留 09:31 UTC 历史发现与修复验收标准，不代表真机已关闭。
> 覆盖: `/pet-finder`、`/pet-gallery`、`/compare`；页面顶部、底部、下拉/Popconfirm、图库预览 Modal、对比表横向滚动状态。
> 证据目录: `app-ui-audit-20260608T-pet-compare-app-codex/`

| ID | 严重程度 | 页面/状态 | 证据 | 问题与影响 | 建议修复方向 |
|----|----------|-----------|------|------------|--------------|
| UI-20260608-01 | 高 | 宠物图库预览 Modal，320x568 App WebView | `small-320-app-pet-gallery-preview-open.png`; `report.json` 中 `pet-gallery-preview-controls-conflict-with-app-chrome` | 预览 Modal 底部内容与原生 App 底部导航冲突：底部导航 top=496/bottom=568，Modal content bottom=526，caption bottom=539。预览里的作者、Shop the feed、likes 等操作区被底部导航覆盖或抢点击。 | Modal 打开时隐藏/压低 App 底部导航，或让预览 Modal 的 max-height/bottom inset 明确避开底部导航和 safe-area；Modal 内容需要内部滚动且关键操作不应落在导航遮挡区。 |
| UI-20260608-02 | 中 | 宠物查找、宠物图库、商品对比页，320/390 App WebView | `phone-390-app-pet-finder-top.png`, `phone-390-app-pet-gallery-top.png`, `small-320-app-compare-top.png`; `report.json` 中 `pet-compare-labels-too-small` x11 | 多个 eyebrow/辅助标签 computed font-size 为 11px，低于移动端最小可读字号 12px；复现选择器包括 `.pet-finder-page__eyebrow`、`.pet-gallery-insights__eyebrow`、`.product-compare__eyebrow`。 | 在 App 移动端最终 guard 或对应页面 CSS 中统一把这些辅助标签提升到 >=12px，并复查行高/字重/对比度，避免继续依赖 11px uppercase 标签。 |
| UI-20260608-03 | 中 | 商品对比页头部操作区，390x844 App WebView | `phone-390-app-compare-top.png`, `phone-390-app-compare-clear-popconfirm.png`, `phone-390-app-compare-differences-only.png`, `phone-390-app-compare-table-scrolled.png`; `report.json` 中 `product-compare-header-actions-text-clipped` | 头部三个操作按钮文案被省略截断：`Add all to cart` clientWidth=80/scrollWidth=93，`Add more products` 96/129，`Clear comparison` 96/118。用户只能看到不完整操作名，且清空/加购属于高意图操作。 | 390px App 宽度下让 action group 换行成两行/纵向堆叠，或改为图标按钮 + 可访问名称/tooltip；不要用固定 80/96px 截断完整命令文案。 |

补充结论: 09:31 UTC 复跑时 24 个状态未发现页面级横向溢出、网络失败或运行错误；问题集中在 App 底部导航与固定弹层的层级/安全区，以及宠物/对比页面局部小字号和对比页 action group 宽度策略。16:13 UTC 当前 worktree 复跑 `audit-mobile-app-pet-compare-ui.js` 后 `report.json` 显示 Issues 0、network failures 0、run errors 0，UI-20260608-01~03 暂按脚本覆盖回归通过处理，仍需真机/Appium 最终确认。

## 一、严重问题 (High Severity)

### 1. 触摸目标尺寸不达标 (Touch Target < 48px)

Android要求触摸目标最小48x48dp，以下元素严重不达标：

| 文件 | 元素 | 当前尺寸 | 问题描述 |
|------|------|---------|---------|
| `Cart.css:528-530` | 数量步进器按钮 | **30px** | 最严重的违规，仅62.5%的最低要求 |
| `Cart.css:536` | 数量输入框 | **30px** | 高度远低于最小触摸区域 |
| `ProductDetail.css:3168` | 商品详情购买栏工具按钮(360px) | **34px** | 宽度和高度均不达标 |
| `ProductDetail.css:3037` | 购买栏工具按钮(380px) | **36px** | 5列布局在360px屏幕上过于拥挤 |
| `ProductDetail.css:3152` | 购买栏按钮(420px) | **42px** | 主要操作按钮高度不足 |
| `ProductDetail.css:3310` | 商品详情Tab按钮(360px) | **32px** | 严重不达标 |
| `ProductDetail.css:3504` | 套装商品按钮(360px) | **36px** | 宽度仅36px |
| `Login.css:1120` | 登录面板按钮(430px) | **38px** | 主要操作区域按钮过小 |
| `Login.css:1496` | 快捷链接按钮(430px) | **38px** | 登录页快捷链接过小 |
| `Login.css:1667` | 登录链接按钮(430px) | **34px** | 严重不达标 |
| `CustomerSupportWidget.css:768` | 客服链接按钮 | **28px** | 仅58%的最低要求 |
| `CustomerSupportWidget.css:1716` | 链接按钮(430px) | **26px** | 最小的触摸目标之一 |
| `CustomerSupportWidget.css:1798` | 快速回复按钮(430px) | **32px** | 常用操作按钮过小 |
| `Cart.css:1997-2000` | 购物车删除按钮(420px) | **38px** | 危险操作按钮难以点击 |
| `Cart.css:2390-2392` | 购物车删除按钮(360px) | **36px** | 最窄屏幕上删除按钮最小 |
| `Checkout.css:2745` | 空购物车操作按钮(360px) | **40px** | 结账页操作按钮不足 |
| `Profile.css:1372` | 订单操作按钮(900px) | **34px** | 平板设备上订单操作困难 |
| `ProductReview.css:147` | 提交评价按钮(430px) | **38px** | 主要操作按钮过小 |
| `OrderManagement.css:381` | 表单输入框 | **34px** | 管理页面表单元素过小 |
| `CartDrawer.css:537` | 信任徽章 | **32px** | 非交互元素但视觉密集 |
| `CartDrawer.css:1887` | 信任徽章(360px) | **28px** | 最窄屏幕上最小 |

### 2. 字号过小 (Font Size < 12px)

移动端最小推荐字号为12px，以下元素在小屏幕上难以阅读：

| 文件 | 元素 | 当前字号 | 问题描述 |
|------|------|---------|---------|
| `ProductDetail.css:4418` | 购买栏工具标签(430px) | **9px** | 整个项目最小的文字 |
| `ProductDetail.css:3052` | 购买栏工具标签(380px) | **9px** | 几乎无法辨认 |
| `CartDrawer.css:1904` | 购物车统计数字(360px) | **9px** | 极小字号 |
| `ProductDetail.css:100` | 西班牙语购买栏文字(720px) | **9.5px** | 国际化文本过小 |
| `CustomerSupportWidget.css:1789` | 工作流标签(430px) | **10px** | 客服界面文字过小 |
| `CustomerSupportWidget.css:1712` | 订单标签(430px) | **10px** | 信息标签难以阅读 |
| `CustomerSupportWidget.css:1600` | 移动状态文字(430px) | **10px** | 状态指示文字过小 |
| `CustomerSupportWidget.css:730` | 消息元数据(720px) | **10px** | 消息时间等信息过小 |
| `Login.css:1160` | 统计数据文字(430px) | **10px** | 登录页统计数据过小 |
| `Login.css:1757` | 重置指南文字(430px) | **10px** | 帮助指引文字过小 |
| `Cart.css:1820` | 西班牙语统计数字(420px) | **10px** | 国际化数字过小 |
| `Checkout.css:2117-2118` | 西班牙语统计数字(420px) | **10px** | 结账页国际化文字过小 |
| `ProductDetail.css:2015` | 购买栏工具文字 | **10px** | 默认状态已过小 |
| `ProductDetail.css:3183` | 购买/加购按钮文字(360px) | **10px** | 主要CTA按钮文字过小 |
| `ProductDetail.css:3145` | 购买栏元数据(420px) | **10px** | 商品信息文字过小 |
| `CartDrawer.css:798` | 购物车统计(520px) | **10px** | 购物车摘要信息过小 |
| `CartDrawer.css:899` | 信任徽章文字(520px) | **10px** | 信任标识文字过小 |
| `Login.css:1322` | 验证码按钮(360px) | **10px** | 验证码按钮文字过小 |
| `Login.css:1683` | 快捷链接(360px) | **11px** | 快捷操作链接偏小 |
| `CustomerSupportWidget.css:1798` | 快速回复按钮文字(430px) | **11px** | 快速回复文字偏小 |
| `CartDrawer.css:1152` | 底部提示文字(520px) | **11px** | 结账提示文字偏小 |
| `ProductDetail.css:2335` | 购买就绪信息 | **11px** | 辅助信息文字偏小 |
| `ProductDetail.css:2936` | 紧凑信号标签(768px) | **11px** | 商品信号标签偏小 |

### 3. 输入框字号不足导致自动缩放

iOS和部分Android浏览器在输入框字号小于16px时会自动缩放页面：

| 文件 | 元素 | 问题描述 |
|------|------|---------|
| `Cart.css` | 购物车页面表单输入框 | **缺少 `font-size: 16px`**，会导致iOS自动缩放 |
| `CustomerSupportWidget.css:1816` | 客服消息输入框(430px) | 字号从16px降为12px，触发缩放 |
| `Checkout.css:3283` | 结账表单输入框 | 仅在780px以下设置16px，780-860px区间缺失 |
| `Profile.css` | 个人资料页搜索输入框 | 主页表单缺少16px字号设置 |

---

## 二、中等问题 (Medium Severity)

### 4. 对比度不足 (Contrast Ratio < 4.5:1)

| 文件 | 元素 | 颜色组合 | 对比度 | 标准 |
|------|------|---------|--------|------|
| `ProductDetail.css:269` | 移动端促销文字 | #627064 on #f6f8f6 | ~3.4:1 | WCAG AA 4.5:1 |
| `ProductDetail.css:277-278` | 售罄按钮文字 | #4f5d52 on #f2f7f3 | ~3.9:1 | WCAG AA 4.5:1 |
| `Login.css:267` | 统计数据文字 | #6b766f on white | ~4.1:1 | 勉强通过AA |
| `CustomerSupportWidget.css:730` | 消息元数据 | 10px + opacity 0.78 | 极低 | 小字号需要更高对比度 |
| `Profile.css:199` | 邮箱验证码警告 | #704b0b on #fff7e6 | ~4.1:1 | 勉强通过AA |
| `Checkout.css:2496` | 支付方式描述 | #627064 at 12px | 边界 | 小字号需要更高对比度 |

### 5. CSS规则冲突和维护性问题

**问题描述**: 多个CSS文件存在大量 `!important` 声明和相互覆盖的规则，导致样式行为不可预测。

**具体表现**:

- **mobile-app.css**: 约2800行CSS中有多个"pass"注释（如 "Native app visual refresh", "Native app depth pass", "Native App final pass"），表明经过多次迭代修复但未清理旧规则
- **Navbar.css**: 约2870行中存在多个覆盖同一属性的规则，如底部导航栏的 `z-index` 在不同位置分别设置为 900、1250、1400
- **ProductDetail.css**: 存在6+个不同的断点（720px、768px、380px、360px、420px、430px），部分规则相互矛盾
- **CustomerSupportWidget.css**: `z-index` 在2600、1900、2600之间反复变化
- **Cart.css**: 同一按钮在不同断点有6个不同的 `min-height` 值
- **Checkout.css**: 提交按钮在不同断点有6个不同的 `min-height` 值

### 6. 滚动行为问题

| 文件 | 元素 | 问题描述 |
|------|------|---------|
| `mobile-app.css` | 页面根元素 | 存在矛盾的 `overflow` 规则：部分设置 `overflow: hidden`，部分设置 `overflow-y: auto/visible` |
| `ProductDetail.css:1587` | 商品图片轮播 | `scroll-snap-type: x mandatory` 在Android WebView中可能导致最后一张图片对齐异常 |
| `ProductDetail.css:2862` | 购买旅程轮播 | 隐藏滚动条但无渐变遮罩提示可滚动内容 |
| `ProductDetail.css:1862` | 购买模式单选组 | 隐藏滚动条无视觉提示，用户可能不知道有更多选项 |
| `Cart.css:2331` | 购物车页面 | `overflow-x: clip` 可能裁剪下拉菜单、工具提示等弹出内容 |
| `Checkout.css:2340` | 结账页面 | 同上，`overflow-x: clip` 问题 |
| `Profile.css:2260` | 个人资料页 | 同上，`overflow-x: clip` 问题 |
| `Login.css:1524` | 登录页根元素 | `overflow-x: clip` 在旧版Android WebView中不支持 |
| `CartDrawer.css:1013` | 购物车抽屉列表 | `overscroll-behavior: contain` 仅在520px以下生效，平板设备存在滚动链 |
| `Profile.css:1688-1760` | 个人资料页 | 6个独立的水平滚动区域，用户体验混乱 |

### 7. `100vw` 使用问题

| 文件 | 元素 | 问题描述 |
|------|------|---------|
| `CartDrawer.css:758` | 购物车抽屉 | `width: 100vw !important` 可能包含滚动条宽度，导致水平溢出 |
| `mobile-app.css` | 多个页面容器 | 使用 `100vw` 可能在有可见滚动条的设备上产生水平滚动 |

---

## 三、一般问题 (Low Severity)

### 8. 断点不一致

项目中使用了大量不一致的断点值：

- `340px`, `360px`, `380px`, `420px`, `430px`, `520px`, `600px`, `640px`, `720px`, `760px`, `768px`, `780px`, `900px`

建议统一为标准断点：`360px`, `428px`, `768px`, `1024px`

### 9. 硬编码值应使用响应式单位

| 文件 | 行号 | 元素 | 问题 |
|------|------|------|------|
| `ProductDetail.css:14` | 西班牙语标题 | `font-size: 34px` | 应使用 `clamp()` |
| `ProductDetail.css:292` | Hero网格 | `minmax(220px, 320px)` | 220px最小值在360px屏幕上溢出 |
| `ProductDetail.css:458` | 价格行 | `font-size: 36px` | 应使用 `clamp()` |

### 10. 横屏适配不足

- `mobile-app.css:773` 有基本的横屏适配，但大部分页面未考虑横屏场景
- 商品详情页购买栏在横屏模式下可能过高，占用过多垂直空间

### 11. 安全区域适配

- 部分页面使用了 `env(safe-area-inset-*)` 但不一致
- 购物车抽屉底部、客服面板底部的安全区域适配需要验证

---

## 四、建议修复优先级

### P0 - 立即修复
1. 购物车数量步进器按钮从30px增大到48px
2. 所有主要操作按钮（提交、购买、加购）确保最小48px
3. 所有字号确保最小12px，表单输入框确保16px
4. 修复对比度不足的文字颜色

### P1 - 尽快修复
5. 统一触摸目标最小值为44px（考虑`!important`覆盖后的实际值）
6. 修复 `overflow-x: clip` 兼容性问题
7. 为隐藏滚动条的容器添加渐变遮罩提示
8. 修复CSS规则冲突，减少 `!important` 使用

### P2 - 计划修复
9. 统一断点值
10. 清理重复的CSS规则
11. 将硬编码的像素值改为 `clamp()` 或 `min()`/`max()`
12. 完善横屏适配

---

## 五、涉及文件清单

| 文件 | 问题数量 | 严重程度 |
|------|---------|---------|
| `frontend/src/mobile-app.css` | 5 | 中 |
| `frontend/src/components/Navbar.css` | 3 | 中 |
| `frontend/src/pages/ProductDetail.css` | 15+ | 高 |
| `frontend/src/pages/Cart.css` | 10+ | 高 |
| `frontend/src/pages/Checkout.css` | 8+ | 高 |
| `frontend/src/pages/Login.css` | 10+ | 高 |
| `frontend/src/pages/Profile.css` | 8+ | 高 |
| `frontend/src/pages/OrderManagement.css` | 5 | 中 |
| `frontend/src/components/CustomerSupportWidget.css` | 12+ | 高 |
| `frontend/src/components/CartDrawer.css` | 8 | 中 |
| `frontend/src/components/ProductReview.css` | 3 | 中 |
| `frontend/src/pages/Home.css` | 3 | 低 |

---

## 六、React TSX 组件逻辑问题

> 以下问题来自TSX组件代码审查，非CSS层面问题

### 6.1 无障碍 (Accessibility)

| 优先级 | 文件 | 行号 | 问题描述 |
|--------|------|------|---------|
| 🔴 高 | CustomerSupportWidget.tsx | 891-904 | 客服对话框缺少Escape键关闭处理，不符合WAI-ARIA dialog模式 |
| 🔴 高 | 全部6个TSX文件 | — | 无任何`prefers-reduced-motion`处理，动画对敏感用户不友好 |
| 🟡 中 | Profile.tsx | 1222-1258 | 移动端Tab栏缺少`role="tablist"`和`role="tab"`属性 |
| 🟡 中 | Profile.tsx | 1098-1099 | 加载状态仅有纯文本，无Spin组件、无`role="status"`、无`aria-live` |
| 🟢 低 | CustomerSupportWidget.tsx | 866-884 | 可拖拽按钮无键盘拖拽替代方案 |
| 🟢 低 | Login.tsx | 431, 445 | 表单项缺少`label`属性，仅依赖`aria-label`和`placeholder` |

### 6.2 硬编码尺寸 (Inline Styles)

| 文件 | 行号 | 问题描述 |
|------|------|---------|
| Cart.tsx | 756 | `padding: '80px 24px'` 硬编码内联样式 |
| Cart.tsx | 762 | `maxWidth: 480` 硬编码 |
| Cart.tsx | 1192 | `fontSize: 54` 硬编码空状态图标大小 |
| Cart.tsx | 625-699 | 桌面表格列宽全部硬编码(px)，窄屏溢出 |
| ProductDetail.tsx | 1710 | `fontSize: 16, padding: '4px 12px'` 硬编码 |
| ProductDetail.tsx | 2102 | Modal `width={800}` 硬编码，不适配小屏 |
| CustomerSupportWidget.tsx | 875-883 | 浮动按钮使用大量硬编码像素值 |

### 6.3 加载与错误状态

| 文件 | 行号 | 问题描述 |
|------|------|---------|
| Profile.tsx | 1098-1099 | 加载状态无Spinner，仅显示纯文本"loading" |
| CustomerSupportWidget.tsx | — | 打开客服面板时无加载指示器(session创建期间) |
| CustomerSupportWidget.tsx | 338 | 订单获取失败时静默清空列表，无可见错误提示 |

### 6.4 触摸交互

| 文件 | 问题描述 |
|------|---------|
| Cart.tsx | 无`touch-action`设置，Table组件可能有滚动冲突 |
| Login.tsx | 无触摸优化处理 |
| Checkout.tsx | 无触摸优化处理 |
| Profile.tsx | 无触摸优化处理 |

---

## 七、更新后的修复优先级

### P0 - 立即修复（含TSX新增）
1. 购物车数量步进器按钮从30px增大到48px
2. 所有主要操作按钮确保最小48px
3. 所有字号确保最小12px，表单输入框确保16px
4. 修复对比度不足的文字颜色
5. 客服对话框添加Escape键关闭支持
6. 添加`prefers-reduced-motion`媒体查询支持

### P1 - 尽快修复（含TSX新增）
7. Profile.tsx加载状态添加Spin组件和aria-live
8. Profile.tsx移动端Tab栏添加ARIA角色属性
9. Cart.tsx桌面表格列宽改为响应式
10. 硬编码内联样式改为CSS类或响应式值
11. CustomerSupportWidget.tsx打开时添加加载指示器

---

## 八、第二轮测试：管理后台 + 剩余页面 + 全局文件

> 覆盖范围: 管理后台5个页面、商城9个页面、全局App文件5个

### 8.1 管理后台触摸目标问题 (Admin Pages)

| 严重程度 | 文件 | 行号 | 元素 | 当前值 | 问题 |
|---------|------|------|------|--------|------|
| 🔴 高 | AdminDashboard.css | — | `.admin-dashboard .ant-btn` | 无min-height | **完全没有触摸目标保护**，按钮默认32px |
| 🔴 高 | UserManagement.css | 229-232 | `.ant-table-cell .ant-btn` | 30px | 430px断点覆盖了44px保护规则 |
| 🔴 高 | ReviewManagement.css | 258-261 | `.ant-table-cell .ant-btn` | 30px | 同上，430px断点覆盖问题 |
| 🔴 高 | CouponManagement.css | 371-375 | `.ant-table-cell .ant-btn` | 30px | 同上，430px断点覆盖问题 |
| 🟡 中 | UserManagement.css | 163-167 | 筛选区按钮 | 38px | 430px断点下低于44px |
| 🟡 中 | ProductManagement.css | 626-629 | Modal底部按钮 | 40px | 640px断点下低于44px |

### 8.2 商城页面触摸目标问题 (Storefront Pages)

| 严重程度 | 文件 | 行号 | 元素 | 当前值 | 问题 |
|---------|------|------|------|--------|------|
| 🔴 高 | PetGallery.css | 385-393 | 删除/相机按钮 | **30px** | 最严重违规之一 |
| 🔴 高 | PetFinder.css | 657-660 | 商品卡片操作按钮(430px) | **30px** | 触摸目标严重不足 |
| 🔴 高 | CouponCenter.css | 289-293 | Hero计划按钮 | **32px** | 主要操作按钮过小 |
| 🔴 高 | Register.css | 405-408 | 验证码发送按钮 | **32px** | 表单操作按钮过小 |
| 🟡 中 | Wishlist.css | 1199-1203 | 删除按钮(360px) | 38px | 最窄屏幕下偏小 |
| 🟡 中 | Wishlist.css | 925-928 | 信息标签/药丸 | 26px | 交互元素过小 |
| 🟡 中 | Notifications.css | 677-678 | 列表操作按钮 | 36px | 低于44px标准 |
| 🟡 中 | Notifications.css | 855-858 | 删除按钮(360px) | 36px | 危险操作按钮过小 |
| 🟡 中 | PetFinder.css | 448-451 | 商品卡片按钮 | 34px | 低于44px标准 |
| 🟡 中 | ProductCompare.css | 885-891 | 表格按钮(430px) | 32px | 表格操作按钮过小 |
| 🟡 中 | ProductCompare.css | 657-660 | 头部操作按钮(430px) | 36px | 低于44px标准 |

### 8.3 字号问题 (新增)

| 文件 | 行号 | 元素 | 当前字号 |
|------|------|------|---------|
| AdminDashboard.css | 87, 134, 239 | 统计/就绪分数/项目文字 | 11px |
| UserManagement.css | 217 | 健康项文字(430px) | 11px |
| ReviewManagement.css | 234 | 指标文字(430px) | 11px |
| Wishlist.css | 950 | 最佳选择标签(640px) | 10px |
| Notifications.css | 659 | 列表标签 | 10.5px |
| BrowsingHistory.css | 1350 | 空状态标签 | 10px |
| BrowsingHistory.css | 999 | 助手操作文字 | 10.5px |
| PetFinder.css | 673, 1083 | 信号文字(360px) | 10.5px |
| PetGallery.css | 884 | 统计标题(430px) | 10px |
| ProductCompare.css | 896 | 表格标签(430px) | 10px |
| CouponCenter.css | 149-157 | 静音徽章文字/图标 | 11px |
| Register.css | 631 | 表单验证消息(430px) | 11px |
| App.css | 1524 | 页脚文字(720px) | 11px |

### 8.4 对比度问题 (新增)

| 文件 | 行号 | 元素 | 颜色组合 | 对比度 |
|------|------|------|---------|--------|
| CouponCenter.css | 149-151 | 静音徽章文字 | #7d877f on #fbfcfb | ~3.4:1 ❌ |
| CouponCenter.css | 155-157 | 静音徽章图标 | #9aa49d on #fbfcfb | ~2.6:1 ❌ |
| CouponCenter.css | 609 | 微信息文字 | #627064 on white | ~4.3:1 ❌ |
| Wishlist.css | 354 | 就绪药丸 | #4f5d52 on #f2f7f3 | ~4.3:1 ❌ |
| Notifications.css | 117-119 | 信号文字 | #627064 on white | ~4.3:1 ❌ |
| ProductCompare.css | 329 | 缺失规格值 | #8c8c8c on white | ~3.5:1 ❌ |
| mobile-page-contrast.css | 218-348 | 所有链接文字 | 强制为#102f22 | 链接不可辨识 ❌ |

### 8.5 布局溢出问题 (新增)

| 文件 | 行号 | 元素 | 问题 |
|------|------|------|------|
| AdminDashboard.css | 95 | 就绪区域网格 | minmax(360px)在<400px屏幕溢出 |
| AdminDashboard.css | — | 表格 | 无horizontal scroll处理 |
| ProductManagement.css | 436 | 变体行网格 | 6列最小宽度766px，640-800px溢出 |
| Notifications.css | 46 | 助手区域 | minmax(340px)在560-600px溢出 |
| OrderTracking.css | 45 | 旅程区域 | minmax(360px)在560-640px溢出 |
| ProductCompare.css | 87 | 决策区域 | minmax(360px)在<640px溢出 |

### 8.6 全局/框架级问题

| 严重程度 | 文件 | 行号 | 问题 |
|---------|------|------|------|
| 🟡 中 | mobile-page-contrast.css | 218-348 | 链接文字强制为深色，与正文不可区分 |
| 🟡 中 | mobile-page-contrast.css | 15-216 | 所有组件状态(成功/警告/错误)失去颜色区分 |
| 🟡 中 | App.css | 3037-3116 | 客服按钮visibility存在3组矛盾的!important规则 |
| 🟡 中 | App.css | 2143-2146 | 输入框font-size:16px仅在780px以下生效 |
| 🟢 低 | index.css | 232 | 全局按钮min-height:34px低于48dp标准 |
| 🟢 低 | SkeletonLoader.css | 29 | shimmer背景1200px在窄屏浪费GPU |
| 🟢 低 | App.tsx | 175-179 | 加载Spinner未检查prefers-reduced-motion |
| ✅ 好 | index.css | 482-490 | 全局prefers-reduced-motion规则完善 |
| ✅ 好 | SkeletonLoader.css | 353-364 | 骨架屏有降级动画处理 |

---

## 九、全项目问题统计

| 审查维度 | 文件数 | 问题总数 |
|---------|--------|---------|
| CSS样式 - 商城核心页面 | 6 | 40+ |
| CSS样式 - 商城辅助页面 | 9 | 50+ |
| CSS样式 - 管理后台 | 5 | 15+ |
| CSS样式 - 全局/框架 | 5 | 8 |
| TSX组件逻辑 | 6 | 16 |
| **合计** | **31个文件** | **129+** |

### 按严重程度分布

| 级别 | 数量 | 占比 |
|------|------|------|
| 🔴 P0 严重 | 45 | 35% |
| 🟡 P1 中等 | 52 | 40% |
| 🟢 P2 一般 | 32 | 25% |

---

## 十、第三轮测试：移动应用配置 + 基础设施

> 覆盖范围: Capacitor配置、PWA manifest、HTML meta、原生返回键、对比度守卫

### 10.1 Capacitor/原生App配置

| 严重程度 | 文件 | 问题 |
|---------|------|------|
| 🔴 高 | capacitor.config.ts | **文件缺失**，无Capacitor配置，无android/平台目录 |
| 🔴 高 | package.json | Capacitor未在依赖中，无法构建原生App |
| 🟡 中 | index.html:7 | `theme-color`为#000000(黑色)，与白色UI不匹配，启动时状态栏闪黑 |
| 🟡 中 | manifest.json | `theme_color`为#000000，与`background_color`#ffffff不一致 |

### 10.2 PWA Manifest问题

| 严重程度 | 文件 | 问题 |
|---------|------|------|
| 🟡 中 | manifest.json | 图标缺少`purpose`字段，Android自适应图标形状异常 |
| 🟡 中 | manifest.json | 512x512图标缺少`purpose: "maskable"`，Play商店安装提示异常 |
| 🟡 中 | manifest.json | favicon.ico条目使用非标准多尺寸格式 |
| 🟢 低 | manifest.json | 缺少`orientation`字段，应指定portrait |
| 🟢 低 | manifest.json | 缺少`scope`、`categories`、`description`字段 |

### 10.3 HTML Meta标签

| 严重程度 | 文件 | 行号 | 问题 |
|---------|------|------|------|
| 🟡 中 | index.html | — | 缺少`mobile-web-app-capable`标签(Android全屏) |
| 🟡 中 | index.html | — | 缺少`format-detection=telephone=no`标签(防止误触电话链接) |
| 🟢 低 | index.html | 7 | theme-color无dark mode媒体查询变体 |

### 10.4 原生返回键处理 (nativeBack.ts)

| 严重程度 | 行号 | 问题 |
|---------|------|------|
| 🟡 中 | — | 无防抖机制，快速连按返回键可能双重关闭弹窗 |
| 🟡 中 | 109-136 | 在坐标(0,0)发送合成点击事件，可能误触页面元素 |
| 🟡 中 | 180-185 | `useNativeBackHandler` hook未memo化handler，导致频繁重新注册 |
| 🟢 低 | 177 | 无内置历史回退/退出App逻辑，依赖调用方处理 |

### 10.5 对比度守卫 (mobileContrastGuard.ts)

| 严重程度 | 行号 | 问题 |
|---------|------|------|
| 🟡 中 | 全文 | 全局`!important`覆盖+双类选择器特异性军备竞赛，维护困难 |
| 🟡 中 | — | 无`prefers-color-scheme`暗色模式适配 |
| 🟡 中 | 2446-2458 | 图片色调提取仅处理渐变中的颜色，不处理实际图片URL |
| 🟢 低 | 2323 | 扫描6000节点的`getComputedStyle()`在低端设备可能卡顿 |
| 🟢 低 | 2615-2616 | 样式缓存每次扫描重建，跨扫描无持久化 |

### 10.6 更新后的全项目统计

| 审查维度 | 文件数 | 问题数 |
|---------|--------|--------|
| CSS样式 - 商城核心页面 | 6 | 40+ |
| CSS样式 - 商城辅助页面 | 9 | 50+ |
| CSS样式 - 管理后台 | 5 | 15+ |
| CSS样式 - 全局/框架 | 5 | 8 |
| TSX组件逻辑 | 6 | 16 |
| 移动应用配置 | 5 | 15 |
| **合计** | **36个文件** | **144+** |

---

## 十一、回归测试状态

> 说明: 下表“回归测试 38%通过”是早前测试快照；当前源码已完成闭合，仍需按 `ANDROID_UI_REGRESSION_REPORT.md` 的待复测清单重新跑 Android WebView/真机/截图回归。

| 阶段 | 状态 | 成果 |
|------|------|------|
| 问题发现 | ✅ 完成 | 144+问题，36个文件，3轮测试 |
| 问题记录 | ✅ 完成 | ANDROID_UI_ISSUES.md |
| 回归计划 | ✅ 完成 | ANDROID_UI_REGRESSION_PLAN.md (117项) |
| 回归测试 | ✅ 执行 | ANDROID_UI_REGRESSION_REPORT.md (38%通过) |
| 开发修复 | ✅ 源码已修复 | 点名触控/字号/对比度/无障碍/PWA 项已做源码闭合；22:09 UTC 追加评价晒单图片移动端样式闭合 |
| 最终验证 | ⏳ 待执行 | 需按回归计划做 Android WebView/真机/截图复测；本轮未构建或发布 APK |

---

## 十二、第四轮测试：剩余管理页面 + 组件 + i18n

> 覆盖范围: 9个管理页面、6个组件、3个i18n文件、3个辅助页面

### 12.1 管理后台触摸目标问题 (新增)

| 严重程度 | 文件 | 行号 | 元素 | 当前值 |
|---------|------|------|------|--------|
| 🔴 高 | BrandManagement.css | 367 | 表格按钮(430px) | **30px** |
| 🔴 高 | CategoryManagement.css | 351 | 表格按钮(430px) | **30px** |
| 🔴 高 | NotificationManagement.css | 384 | 全局按钮最大值 | **42px** |
| 🟡 中 | BrandManagement.css | 289 | 工具栏按钮(720px) | 38px |
| 🟡 中 | BrandManagement.css | 430 | Modal底部按钮(560px) | 38px |
| 🟡 中 | CategoryManagement.css | 275 | 工具栏按钮(720px) | 38px |
| 🟡 中 | AlertManagement.css | 221 | 通用按钮回退(720px) | 38px |
| 🟡 中 | IpBlacklistManagement.css | 182 | 通用按钮回退(720px) | 38px |
| 🟡 中 | LogManagement.css | 192 | 通用按钮回退(720px) | 38px |
| 🟡 中 | StockAlerts.css | 143, 191 | 恢复/下一步按钮 | 40px |

### 12.2 组件触摸目标问题 (新增)

| 严重程度 | 文件 | 行号 | 元素 | 当前值 |
|---------|------|------|------|--------|
| 🔴 高 | AddOnAssistant.css | 256-263 | 添加按钮(430px) | **34px** |
| 🔴 高 | AddOnAssistant.css | 281-285 | 添加按钮(360px) | **32px** |
| 🔴 高 | SearchBar.css | 41-43 | 搜索输入框(430px) | **38px** |
| 🟡 中 | PetPersonalizedAssistant.css | 337-343 | 操作按钮(430px) | 36px |
| 🟡 中 | PetPersonalizedAssistant.css | 428-433 | 底部按钮(430px) | 34px |
| 🟡 中 | Payment.css | 156-158 | 支付方式单选(560px) | 40px |
| 🟡 中 | Payment.css | 332-336 | 关闭按钮 | 36px |

### 12.3 字号问题 (新增)

| 文件 | 行号 | 元素 | 当前字号 |
|------|------|------|---------|
| AddOnAssistant.css | 218, 253 | 徽章/适配标签(430px) | **10px** |
| AddOnAssistant.css | 59, 129 | 徽章/适配标签(桌面) | 11px |
| SocialProofToast.css | 77, 143 | 辅助文字(640px/360px) | **10.5px** |
| PetPersonalizedAssistant.css | 313, 414 | 标签/元数据(430px) | **10px** |
| Payment.css | 134, 152 | 标签/徽章(移动端) | **10px** |
| StockAlerts.css | 269, 403 | 信号标签/操作文字 | 11px |

### 12.4 对比度问题 (新增)

| 文件 | 行号 | 元素 | 颜色组合 | 对比度 |
|------|------|------|---------|--------|
| SocialProofToast.css | 43 | 辅助文字 | #627064 on white | ~3.5:1 ❌ |
| PetPersonalizedAssistant.css | 162 | 洞察描述 | #5f7869 on white | ~3.4:1 ❌ |
| PetPersonalizedAssistant.css | 69 | 统计文字 | #426856 on white | ~4.0:1 ❌ |

### 12.5 i18n长字符串溢出风险

| 文件 | 键名 | 字符数 | 风险 |
|------|------|--------|------|
| es.json | importCsvHint | **536** | 工具提示/模态框溢出 |
| en.json | importCsvHint | **489** | 同上 |
| zh.json | importCsvHint | **203** | CJK等效~350-400拉丁字符 |
| es.json | grantHelpDescription | 250 | 段落溢出 |
| es.json | templateHtml | 253 | 含HTML标签，可能破坏布局 |
| zh.json | templateHtml | 153 | 同上 |

### 12.6 布局溢出 (新增)

| 文件 | 行号 | 元素 | 问题 |
|------|------|------|------|
| BrandManagement.css | 234 | 关键词输入框 | width:260px无移动端覆盖 |
| CategoryManagement.css | 230 | 关键词输入框 | width:280px无移动端覆盖 |
| AddOnAssistant.css | 447 | 操作按钮列(340px) | grid列宽仅30px |

---

## 十三、全项目最终统计

> 2026-06-05 22:20 UTC 开发补充: 第四轮 12.1-12.6 已完成源码级闭合或确认后续 guard 覆盖，状态转为 `SOURCE_FIXED / 待 Android WebView 真机或截图回归`。重点复测 Brand/Category/Notification/Alert/IpBlacklist/Log/StockAlerts/AddOn/SearchBar/PetPersonalized/Payment/SocialProofToast/ProductManagement import tooltip/Coupon grant modal 在 360/380/428/768px 下的 computed 触控高度、字号、对比度、长文案换行和横向溢出。

| 轮次 | 审查内容 | 文件数 | 新增问题 |
|------|---------|--------|---------|
| 第一轮 | 商城核心CSS + TSX | 18 | 76+ |
| 第二轮 | 管理后台(5) + 辅助页面(9) + 全局(5) | 19 | 53+ |
| 第三轮 | Capacitor/PWA/原生配置 | 5 | 15 |
| 第四轮 | 剩余管理(9) + 组件(6) + i18n(3) + 辅助(3) | 21 | 35+ |
| **合计** | | **63个文件** | **179+** |

### 按严重程度分布

| 级别 | 数量 | 占比 |
|------|------|------|
| 🔴 P0 严重 | 58 | 32% |
| 🟡 P1 中等 | 72 | 40% |
| 🟢 P2 一般 | 49 | 28% |

### 按问题类型分布

| 类型 | 数量 |
|------|------|
| 触摸目标<44px | 55+ |
| 字号<12px | 45+ |
| 对比度不足 | 15+ |
| 布局溢出 | 12+ |
| 配置/基础设施 | 15 |
| i18n溢出风险 | 8 |
| 无障碍/ARIA | 10+ |
| 其他 | 19+ |

## 2026-06-06 01:52 UTC 源码归档同步

本轮未执行 Android 真机/WebView、截图、Playwright、构建或 APK 发布。以下为 `TEST_ISSUES.md` 前端 F1558-F1560 的源码闭合状态，运行时仍需后续 APK/WebView 回归。

| 问题 | 状态 | 源码证据 | Android/WebView 复测 |
|---|---|---|---|
| Cart 推荐/加购商品 ID 安全 | SOURCE_CLOSED / REGRESSION_PENDING | `Cart.tsx` 在推荐商品加购前校验 `product.id` 为正 safe integer，非法 ID 走现有加入失败路径，不写入购物车。 | 在 Android App/WebView 购物车页验证推荐/凑单商品加购，覆盖登录、游客、非法 ID mock。 |
| Profile 缺失翻译 raw key | CURRENT_SOURCE_COVERED / ARCHIVED | 当前 `Profile.tsx` 已无审计中任意 key fallback；`i18n.tsx` 有英文和 humanized key 兜底。 | 无旧路径专项复测；常规 Profile 多语言截图即可。 |
| Guest cart 扁平化契约 | SOURCE_CLOSED / REGRESSION_PENDING | `guestCart.ts` 返回 `NormalizedGuestCartItem[]`，旧 nested `product` 只作为迁移输入，不再返回或持久化。 | 在 Android App/WebView 写入旧 localStorage nested 商品行，验证 Cart/Checkout/CartDrawer 显示与迁移。 |

## 2026-06-08 UI 设计师回归与新发现

> 范围: 对照 `ANDROID_UI_REGRESSION_PLAN.md` 117 项 + 23:36 / 00:16 / 01:35 / 02:18 / 05:55 UTC 追加复测项做静态代码/Audit 检查。
> 当前 APK: `shoptest-1.0.77.apk` / versionCode `10077`, SHA256 `cf97a44008930d0f29ab617212f0d6b281f7ae56480ff2e47d768c03cfdcfcb5`。
> 运行环境: 静态源码审计 (未跑 APK/真机/Playwright)。

### 回归确认 (已闭合 / 已运行) ✅

| 区域 | 状态 | 证据 |
|---|---|---|
| 运行时 Android UI 终局 guard | ✅ 接入 | `frontend/src/App.tsx` 导入并安装 `installAndroidUiFinalGuard`;`refreshAndroidUiFinalGuard` 在路由切换时由 `useEffect` 触发;`utils/androidUiFinalGuard.ts` 通过 `MutationObserver` 持续将 `<style id="shop-android-ui-final-guard">` 推为 `document.head` 最后一个子元素,保证 cascade 末尾胜出。`textContent` 与常量相等时跳过重写,避免无谓回流。 |
| `<head>` 末尾 guard 元素 | ✅ 设计正确 | `refreshAndroidUiFinalGuard()` 中 `if (style.parentElement !== document.head || document.head.lastElementChild !== style) document.head.appendChild(style);` 是显式 last-write。 |
| PWA `manifest.json` | ✅ 完整 | 含 `purpose: "any maskable"` 192/512 图标、`scope: "."`、`orientation: "portrait"`、`categories: ["shopping","lifestyle"]`、`description`、`theme_color: #124734` 与 `background_color: #ffffff` 一致(非黑色);`short_name: "ShopMX"`。 |
| `index.html` Android meta | ✅ 完整 | `mobile-web-app-capable=yes`、`format-detection=telephone=no`、`viewport-fit=cover`、含 `prefers-color-scheme: dark` 的 `theme-color` 变体 `#0b2017`,与 manifest 主题色区分。 |
| `index.css` 全局按钮/输入 | ✅ 44px / 16px | `.ant-btn` 默认 `min-height: 44px`;`@media (max-width: 860px)` 内 `:where(button, .ant-input, …)` 命中 44px 与 16px 输入,并补 `overflow-x: clip` 兼容回退。 |
| `mobile-app.css` 底部导航文字 | ✅ 12px | 当前 line ~257/313/319 已含 12–13px;不再是 10px。 |
| Cart 数量步进器 30→48px | ✅ 由 guard 兜住 | `androidUiFinalGuard.ts:145-156` 强制 `.cart-page__quantityStepper` 及子按钮/输入 48×48。 |
| `runtime final guard` Modal/Drawer | ✅ 已收口 | `androidUiFinalGuard.ts:111-143` 限制 `.ant-modal` 宽 ≤ `100vw - 16px`,Modal/Drawer body/footer flex-wrap + `safe-area-inset` 适配。 |
| ProductDetail 移动端图片轮播 | ✅ proximity snap | guard line 158-168 强制 `scroll-snap-type: x proximity !important`,thumbs 64×64,避免最后一张强制对齐异常。 |
| Admin/Compare/Notifications 网格溢出 | ✅ grid 1fr | guard line 170-176 把 `.admin-dashboard__readiness`/`.notifications-page__assistant`/`.product-compare__decision`/`.order-tracking-page__journey`/`.shopify-variant-row` 全部回落到 `minmax(0, 1fr)`,避免 360/428px 横向溢出。 |
| 客服 Support 消息 HTML payload | ✅ React 文本渲染 | `SupportService.normalizeContent()` 解码实体并中和 `<`/`>`;`CustomerSupportWidget.tsx` / `SupportManagement.tsx` 以 React 文本方式渲染,无 dangerouslySetInnerHTML。 |
| 访客订单链路 | ✅ 后端 + 前端 | `guest_order` 标记 + 专用联系人字段;`shippingAddress` 不再拼接 `[Guest]`;查单/客服/支付返回路径兼容新旧订单。 |

### 静态审计新发现 🔴🟡🟢

> 编号延续原表 T-series,新发现以 A-series 单列。

#### A-01 🟡 商品列表徽标字号仍 9px (非交互标签可读性)

- 文件: `frontend/src/mobile-app.css:1630-1638`
- 元素: `.product-list__badges .ant-tag` (产品卡 "新品/热卖/限时" 角标)
- 当前值: `font-size: 9px !important; min-height: 20px !important; padding-inline: 6px`
- 风险: 标签是纯展示元素,无 onClick,但 9px 文字在 360px 屏上几乎无法阅读,违背移动端 12px 字号下限;Android WebView 1× DPR 下尤其糊。
- 已有的 guard 覆盖: ❌ `androidUiFinalGuard.ts` 只覆盖 button/input/select/picker 等交互元素,未覆盖展示类 `.ant-tag`。
- 复测建议: 在 Android WebView 360/428px 打开首页/分类/搜索结果,读 product card badge computed `font-size`。
- 期望修复: 把 `font-size` 提到 11–12px 或 10px + 加粗 + 更高对比度;`min-height` 提到 22–24px 以保证点击穿透区域不挤压。

#### A-02 🟢 旧版 `min-height: 9px` / `min-height: 20px` 散落

- 文件: `mobile-app.css:1358, 1632, 1635, 1729, 1891` (以及历史 1719/1726)
- 现状: 商品列表/侧栏的 `font-size: 9px` 与 `min-height: 20-22px` 是历史装饰,部分被新规覆盖,部分仍是最终态。
- 风险: 与 A-01 同源,徽标/标记可读性偏差;不会触发触摸目标判定,但属于视觉可读性。
- 复测建议: 截图对比首页商品卡,确认所有非交互标签的 computed font-size ≥ 10.5px、对比度 ≥ 4.5:1。
- 期望修复: 在 `mobile-app.css` 末尾追加 `body.shop-mobile-app .product-list__badges .ant-tag { font-size: 11px !important; min-height: 22px !important; }` 兜底,或删除旧 9px 规则。

#### A-03 🟢 客服面板 session 创建期间加载/空态已覆盖 ✅

- 文件: `frontend/src/components/CustomerSupportWidget.tsx` (本次 diff 引入 `sessionLoading`,并在 catch 内 `message.error(t('pages.support.loadFailed'))`)
- 现状: `sessionLoading` 状态已加;面板打开加载会渲染 `<div className="customer-support-widget__loading" role="status" aria-live="polite"><Spin size="small" /><Text>{t('common.loading')}</Text></div>`;消息为空时渲染 `customer-support-widget__emptyState` + AntD `Empty` 欢迎卡 + 快捷问题按钮。
- 风险: 当前源码已覆盖"加载中"和"暂无消息/欢迎"两类状态;A-03 作为当前源码非问题归档,只保留真机弱网复测。
- 复测建议: 在 App/WebView 慢网络下打开客服面板,观察首屏是否给到"加载中"或"暂无历史会话"提示。
- 回归守卫: `CustomerSupportWidget.test.tsx` 已断言 `sessionLoading`、`role="status"` loading、`Spin`、`common.loading`、`Empty` 欢迎态和快捷问题入口同时存在。
- 期望修复: 无源码修复需求。

#### A-04 🟢 `App.tsx` 新增 `AuthStartupGate` 等待首屏 ✅

- 文件: `frontend/src/App.tsx:182-...` (新增组件 + `validateStoredSession` + dispose 保护)
- 现状: 已用 `useState(() => hasStoredValue('token'))` 初始进入"校验中"态,通过 `userApi.getProfile({ skipAuthRedirect: true })` 拉真实 profile 写回本地;失败时 `clearStoredAuthSession()` 退出。
- 风险: 启动时如果接口慢,`AuthStartupGate` 渲染 `<LoadingFallback />`,可能 1–3s 内不展示主框架。需在 `LoadingFallback` 中放友好文案(已含 `Spin` 与 `role="status"`,但文案是 `Loading…`)。
- 复测建议: Android 弱网 (模拟 2G/3G throttling) 启动 App,观察首屏是否在 1.5s 内给出"恢复登录中"或"App 加载中"中文。
- 期望修复: 若无 token,跳过整个 `AuthStartupGate` 立即放行;有 token 时显示本地化 "正在恢复登录…" 而非英文 "Loading…",并在 profile 失败时静默退出,不弹 modal。

#### A-05 🟢 Address cascader 内部多级折叠已修 ✅,fallback 已收口

- 文件: `frontend/src/mobile-app.css:2820-2910` (新加 cascader 在 App 上的 `flex-direction: column` 与 `min-height: 76px / level-height` 拆分)
- 现状: 已将原本水平排布的省/市/区级 cascader 改为竖向堆叠,每级 `min-height: 76px`、`max-height: var(--shop-address-cascader-level-height)`,3–4 级全部装入视口。
- 风险: 已收口。早期 cascader 规则与末尾 BUG-14 规则都使用 `--shop-address-cascader-available-height` / `--shop-address-cascader-level-height`,不再混用旧 `56dvh`/`66dvh` 高度。
- 复测建议: 在 Android WebView 360×640 打开结账 → 收货地址 → 选择省市区,确认 3 级地址和 5 级地址都不溢出、不顶满,滑动手势正常。
- 回归守卫: `Checkout.test.tsx` 断言 App Cascader 使用统一 safe-area viewport 公式,并禁止 `56dvh`/`66dvh` 回归。

#### A-06 🟢 `mobile-app.css` 中旧 `56dvh`/`66dvh` Cascader 高度已清理

- 文件: `mobile-app.css:2822, 2836, 2852` (cascader 高度)
- 现状: 早期规则已改为 `max-height: var(--shop-address-cascader-available-height)` 和 `max-height: var(--shop-address-cascader-level-height)`;源码搜索不再命中 Cascader `56dvh`/`66dvh`。
- 风险: 无当前源码风险;真机仍需做弹层几何复测。
- 复测建议: 复测结算页 cascader 不溢出即可,无需特调。
- 期望修复: 已完成。

#### A-07 🟢 Navbar 移动端下拉清理 ✅

- 文件: `frontend/src/components/Navbar.tsx` (本次 diff 新增 `useEffect(() => setOpenDropdowns({}), [location.hash, location.pathname, location.search])`)
- 现状: 路由切换/查询字符串变化时强制关闭所有 dropdown,避免移动端下拉残留遮住新页面内容。
- 风险: 极低,纯改进。
- 复测建议: 任意页打开语言/通知/更多菜单,点击页内链接切换路由,确认菜单被关闭。
- 回归守卫: `Navbar.test.tsx` 已有运行时测试 `closes mobile dropdown menus after route navigation`,并新增源码守卫确认 reset effect 依赖 `location.hash/pathname/search`。
- 期望修复: 无,当前源码已覆盖。

#### A-08 🟢 APK 升级 manifest / 签名 / 文件一致性已覆盖

- 文件: `frontend/public/downloads/mobile-version.json`
- 现状: 当前 manifest 与 generated release 均为 `versionName: 1.0.95`, `versionCode: 10095`, `apkUrl: /downloads/shoptest-1.0.95.apk`, `legacyApkUrl: /downloads/shoptest.apk?v=1.0.95`, `releaseSigned: true`, `minSupportedVersionCode: 0`, `certificateSha256: 99622898…`;版本化 APK 文件存在且 `sizeBytes` 一致。
- 风险: 旧文档中的 1.0.77 信息已过期;当前源码/manifest 允许 1.0.35 及更早客户端看到更新而不被 minSupported 阻断。
- 复测建议: 装旧 APK (如 1.0.24/1.0.35),启动后调用 `fetchLatestMobileRelease()`,确认跳转 `/downloads/shoptest-1.0.95.apk` 或 `legacyApkUrl`,升级流程正常,不强退。
- 回归守卫: `mobileUpdate.test.ts` 已读取 public manifest,断言它与 `CURRENT_MOBILE_RELEASE` 一致、签名 metadata 完整、`minSupportedVersionCode === 0`、版本化 APK 文件存在且大小匹配。
- 期望修复: 无,当前源码已覆盖。

### 总体回归结论

| 维度 | 数量 | 状态 |
|---|---|---|
| 源码级 117 项 + 23:36 / 00:16 / 01:35 / 02:18 / 05:55 UTC 追加项 | ~135 | ✅ SOURCE_CLOSED / REGRESSION_PENDING |
| 本次新发现 A-01 ~ A-08 | 8 | A-01/A-04/A-05/A-06 已源码修复并脚本 PASS;A-03/A-07/A-08 已确认为 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED |
| P0 阻断 | 0 | — |
| 阻塞真机测试 | 0 (设备未连接,但代码侧无未结 P0) | 等待连接 Android 设备后跑 `mobile-tests/appium` |

### 给开发工程师的优先修复 (2026-06-09 00:23 UTC 已处理)

1. **A-01 商品列表徽标 9px → 12px**: 已在 `mobile-app.css` 末尾追加高优先级 App 兜底,`.product-list__badges .ant-tag` 现在 `font-size: 12px !important; min-height: 22px !important;`。
2. **A-04 启动文案本地化 + 静默失败**: `LoadingFallback` 现在读取 `t('app.loading')`,zh/en/es 文案为 "App 加载中…" / "Loading app…" / "Cargando app…";profile 失败分支仍只 `clearStoredAuthSession()`,无 modal/toast。

### 给回归工程师的复测清单 (按本轮发现)

- **A-01**: Android WebView 360/428px 截首页 + 分类页,读 badge `getComputedStyle().fontSize`,期望 ≥ 11px。
- **A-03**: 弱网 (Chrome DevTools Slow 3G) 打开客服面板,确认首屏有 spinner / 加载中文案。
- **A-04**: 同样弱网下冷启动 App,确认首屏 < 1.5s 出现 "App 加载中" 且不会停留 > 3s。
- **A-05/A-06**: 360×640 模拟器上完整选 3 级 (省/市/区) 和 5 级 (国/省/市/区/街道) 地址,确认 cascader 容器不溢出、滚动顺滑。
- **A-07**: 任意页打开下拉 → 点击菜单项跳转,确认下拉自动关闭,没有"挂在新页面上方"的现象。
- **A-08**: 装 1.0.24/1.0.35 旧 APK,启动后访问 `/downloads/mobile-version.json`,确认升级到 1.0.95 流程正常,不强退。

> 状态: 源码层 0 项 P0 阻断;A-01/A-04 已在 2026-06-09 00:23 UTC 源码修复并通过本地 TypeScript、focused Jest、Android storefront audit。真机/WebView 复测待 Android 设备连接后执行。

## 2026-06-09 00:34 UTC A-07/A-08 当前源码覆盖 / 守卫已加

> 状态: A-07 / A-08 经源码核实为 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED;真机/Appium 仍待测。
> 验证:
> - `npm test -- --runTestsByPath src/components/Navbar.test.tsx src/utils/mobileUpdate.test.ts --watchAll=false --runInBand` PASS (19/19;仅既有 React/Router/AntD z-index/act 警告)
> - `npx tsc --noEmit --pretty false` PASS

### A-07 CURRENT_SOURCE_COVERED:Navbar 路由切换关闭下拉

- 当前源码证据: `Navbar.tsx` 使用受控 `openDropdowns`,所有 Select/Dropdown 都接入 `open={isDropdownOpen(...)}` / `onOpenChange={...}`;route `hash/pathname/search` 变化时 `setOpenDropdowns({})`。
- 回归守卫: `Navbar.test.tsx` 运行时测试打开 More 下拉后点击路由链接,断言 `aria-expanded=false`;源码守卫确认 reset effect 依赖 route 三元组。
- 回归方法: 真机/Appium 仍需打开语言/货币/More/Pet 分类下拉后跳转,确认下拉不残留。

### A-08 CURRENT_SOURCE_COVERED:APK 更新 manifest 已对齐当前 release

- 当前源码证据: `frontend/public/downloads/mobile-version.json` 与 `frontend/src/generated/mobileRelease.ts` 都指向 `1.0.95` / `10095`;`shoptest-1.0.95.apk` 文件存在,签名 fingerprint 非 debug,`releaseSigned=true`,`minSupportedVersionCode=0`。
- 回归守卫: `mobileUpdate.test.ts` 读取 public manifest 并与 generated release 深度比对,同时验证 APK 文件存在、文件大小匹配、签名/sha/fileName/apkUrl/legacyApkUrl metadata 满足下载 gate。
- 回归方法: 真机/Appium 仍需旧 APK 升级烟测,覆盖 1.0.24/1.0.35 → 1.0.95。

## 2026-06-09 00:26 UTC A-03 当前源码覆盖 / 守卫已加

> 状态: A-03 经源码核实为 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED,无需业务逻辑改动;真机/Appium 仍待测。
> 验证:
> - `npm test -- --runTestsByPath src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand` PASS (4/4)
> - `npx tsc --noEmit --pretty false` PASS

### A-03 CURRENT_SOURCE_COVERED:客服面板加载/空态

- 当前源码证据: `CustomerSupportWidget.tsx` 在 session 初始化期间渲染 `customer-support-widget__loading` 且带 `role="status"`/`aria-live="polite"`、`Spin size="small"` 与 `t('common.loading')`;当消息为空时渲染 `customer-support-widget__emptyState`、AntD `Empty` 欢迎卡和快捷问题按钮。
- 非问题结论: A-03 报告中的"缺空态提示"不符合当前源码;当前状态已能在慢网络下给出加载提示,空消息时也有欢迎空态。
- 回归守卫: `CustomerSupportWidget.test.tsx` 已添加源码/CSS 守卫,防止 loading/empty state 被删。
- 回归方法: 真机/Appium 仍需在 Slow 3G 或支持接口延迟下打开客服面板,确认 loading 和欢迎空态实际可见、无遮挡。

## 2026-06-09 00:31 UTC A-05/A-06 源码修复 / 脚本 PASS

> 状态: A-05 / A-06 已源码修复并通过本地脚本回归;真机/Appium 仍待测。
> 验证:
> - `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` PASS (15/15;仅既有 React/Router/AntD act 警告)
> - `npx tsc --noEmit --pretty false` PASS
> - `node audit-mobile-app-checkout-flow-ui.js` PASS: viewportCount 2,issueCount 0,issueTypes `[]`。

### A-05/A-06 已源码修复 / 脚本 PASS:App 地址 Cascader 高度公式统一

- 当前修复: `mobile-app.css` 早期 App Cascader 规则已改为 `--shop-address-cascader-available-height: calc(100vh/100dvh - 24px - safe-area)` 与 `--shop-address-cascader-level-height`;menus/menu 的 `max-height` 都引用这些变量。
- 清理结果: `rg "56dvh|66dvh" frontend/src/mobile-app.css frontend/src/pages/Checkout.test.tsx` 不再命中 Cascader 历史高度。
- 回归守卫: `Checkout.test.tsx` 新增 safe-area viewport 公式守卫,并禁止 Cascader CSS 回退到 `56dvh`/`66dvh`。
- 回归方法: 真机/Appium 仍需打开 `/checkout` 地址 Cascader,覆盖 3 级和 5 级地区,确认弹层不溢出、层级可滚动且关闭/滚动行为正常。

## 2026-06-09 00:23 UTC A-01/A-04 源码修复 / 脚本 PASS

> 状态: A-01 / A-04 已源码修复并通过本地脚本回归;真机/Appium 仍待测。
> 验证:
> - `npx tsc --noEmit --pretty false` PASS
> - `npm test -- --runTestsByPath src/App.test.tsx src/pages/ProductList.test.tsx --watchAll=false --runInBand` PASS (20/20;仅既有 React/Router/act 警告)
> - `node audit-mobile-app-storefront-ui.js` PASS: generatedAt `2026-06-09T00:22:32.435Z`,69 route states,issueStateCount 0,issueCounts `{}`,networkFailureCount 0,routeErrorCount 0。

### A-01 已源码修复 / 脚本 PASS:商品列表徽标字号

- 当前修复: `mobile-app.css` 末尾新增 A-01 App 兜底,`body.shop-mobile-app.shop-mobile-app.shop-mobile-app .product-list__badges .ant-tag` 强制 `font-size: 12px !important; min-height: 22px !important; line-height: 1.2 !important;`。
- 回归守卫: `ProductList.test.tsx` 读取 `mobile-app.css`,断言 A-01 规则存在且不含 `font-size: 9px`。
- 回归方法: 真机/Appium 仍需读 Android WebView computed style,期望 `font-size >= 12px` 且 badge 文案可读。
- 阻塞: 无源码阻塞;等待 Android 设备复测。

### A-04 已源码修复 / 脚本 PASS:启动文案本地化 + 静默失败

- 当前修复: `LoadingFallback` 读取 `useLanguage().t('app.loading')`,在 `<Spin />` 旁渲染 `<span className="app-route-loading__text" role="status" aria-live="polite">…</span>`。
- Locale: `en.json` = `Loading app…`,`zh.json` = `App 加载中…`,`es.json` = `Cargando app…`。
- 静默失败: `AuthStartupGate` profile 失败分支仍为 `clearStoredAuthSession();`,回归守卫确认该组件源码片段不调用 `message.*` 或 `Modal.*`。
- 回归方法: 真机/Appium 仍需在弱网和失效 token 下冷启动,确认本地化加载文案出现且 profile 失败无 modal/toast。
- 阻塞: 无源码阻塞;等待 Android 设备复测。

## 2026-06-08 07:13 UTC 手机 App 商城端 UI 审查 / 源码修复后脚本 PASS

> 状态: A-09 ~ A-14 已在 2026-06-09 00:13 UTC 源码修复并通过 Android App WebView 模拟脚本回归；真机/Appium 待测。
> 审查方式: Playwright + API mock + Android App WebView 模拟 (`ShopTestAndroidApp` UA + Capacitor shim)。
> 覆盖: 320x568、360x740、390x844 三档手机竖屏,共 69 个页面状态；最新复跑 issueStateCount 0、route errors 0、network failures 0、`useFormWarningCount` 0。
> 证据目录: `app-ui-audit-20260608T-mobile-storefront-codex/`
> 报告: `app-ui-audit-20260608T-mobile-storefront-codex/REPORT.md`, `summary.json`, `report.json`。

### A-09 已源码修复 / 脚本 PASS:App 底部导航遮挡商城页面内容和控件

- 严重程度: 🔴 High
- 当前状态: `App.tsx` 在 App shell 上标记滚动/底部 rail 冲突状态，`mobile-app.css` 在 scrolled/conflict 场景隐藏 App 底部 rail 并保留页面安全间距；`node audit-mobile-app-storefront-ui.js` 最新复跑不再出现 `bottom-nav-obscures-control`。
- 影响页面: 首页、商品列表、购物车、Pet Finder;同类风险也可能影响其他长列表页。
- 现象: 固定 `.shop-nav__bottomBar` 与页面内容/按钮重叠,页面滚动到中段或底部时,关键可点元素落入底栏区域。
- 证据:
  - `small-320-app-products-top.png`: 商品列表发现/分类 chip 被底部导航盖住。
  - `phone-360-app-cart-summary.png` / `phone-390-app-cart-summary.png`: 购物车 `Checkout` CTA 部分被底部导航盖住。
  - `small-320-app-home-mid.png`: 首页商品卡图片/加购区域贴到底部导航下方。
  - `phone-390-app-pet-finder-mid.png`: Pet Finder 结果卡 `View details` 按钮落入底部导航区域。
- 期望修复: App 模式下每个商城页面底部内容区预留 `bottom nav height + safe-area + 12px` 的稳定 padding;有自身 sticky/mobile action bar 的页面要叠加计算,避免与底部导航竞争。
- 回归方法: 320/360/390 App 视口复测上述截图点位,最后一个主 CTA / 卡片操作按钮应完整位于底部导航上方,且至少 12px 间距。

### A-10 已源码修复 / 脚本 PASS:优惠券页移动操作条与 App 底部导航冲突

- 严重程度: 🔴 High
- 当前状态: App 模式滚动/冲突时底部 rail 自动让位，`CouponCenter.css` 同步提升优惠券工具条/标签/领取按钮的 App 可读性；最新 storefront audit 不再报告优惠券页底部导航遮挡或小字号/小目标问题。
- 影响页面: `/coupons`
- 现象: 优惠券页自己的移动 action strip 与 App 底部导航同时固定/靠底,导致优惠券搜索框、排序 select、`Claim all` CTA 被压到导航区域。
- 证据:
  - `phone-390-app-coupons-mid.png`: `Search coupon name or details` 输入框和 `Recommended` select 被底栏区域遮挡。
  - `small-320-app-coupons-mid.png`: `Claim all` CTA 下半部分进入底部导航区域。
- 期望修复: 优惠券页移动 action bar 应固定在 App nav 上方,或在 App 模式下改为普通内容流;筛选/搜索控件底部必须有 nav clearance。
- 回归方法: 320/390 App 视口滚动到 Claim coupons 区域,确认搜索、排序、Claim all、Use at cart 等控件完整可见可点。

### A-11 已源码修复 / 脚本 PASS:收藏页主操作按钮位置过低

- 严重程度: 🟡 Medium
- 当前状态: App shell 底部 rail 冲突检测和 Profile/Wishlist 路由排版守卫已覆盖收藏页主操作区；最新 storefront audit 中 `/wishlist` 无 `bottom-nav-obscures-control`。
- 影响页面: `/wishlist`
- 现象: `Add all to cart` 与 best-pick 卡片操作在 320/390 App 视口中贴近或进入底部导航区域,降低可点性。
- 证据:
  - `small-320-app-wishlist-top.png`
  - `phone-390-app-wishlist-top.png`
  - `phone-390-app-wishlist-mid.png`
- 期望修复: 收藏页顶部/中段的主 CTA 和 best-pick 操作应进入正常内容流,或给 `.wishlist-page` / `.wishlist-page__mobileAction` 增加 App nav clearance。
- 回归方法: 320/390 App 视口打开收藏页并滚动到 best-pick/next action 区域,确认 `Add all to cart` 不被底栏遮挡。

### A-12 已源码修复 / 脚本 PASS:商品列表标题链接触控高度仅 34px

- 严重程度: 🟡 Medium
- 当前状态: `ProductList.css` 保持 `.product-list__titleLink` App 命中区最小 44px，并补齐商品列表上下文 chip、价格/评分/信心标签和 action 文案字号守卫；最新 storefront audit 不再出现 `small-touch-target`。
- 影响页面: `/products`
- 现象: 商品卡标题 `a.product-list__titleLink` 在 320/390 App 视口下 computed 高度为 34px,低于 44px App 触控目标。
- 证据:
  - `summary.json`: `a.product-list__titleLink`,320px 为 `138x34`,390px 为 `173x34`。
  - `small-320-app-products-mid.png`, `phone-390-app-products-mid.png`。
- 期望修复: 标题链接命中区至少 44px 高,可通过 padding/min-height/line-height 包住两行标题,不要截断长商品名。
- 回归方法: 读取 `getBoundingClientRect()` 确认 `.product-list__titleLink.height >= 44`,并目视确认标题仍自然换行。

### A-13 已源码修复 / 脚本 PASS:`useForm` 未连接警告在商城路由重复出现

- 严重程度: 🟢 Low
- 当前状态: `Checkout` 外层先创建并挂接无 DOM `<Form form={form} component={false}>`，实际 checkout 逻辑下沉到 `CheckoutContent`，确保 `Form.useWatch` 和 `form.getFieldValue()` 在 form 已 hook 后执行；同时移除 Cascader deprecated `popupVisible/onPopupVisibleChange`。最新 `report.json` 中 `useFormWarningCount: 0`、Cascader deprecated warning 0。
- 影响页面: 首页、商品列表、详情、购物车、结账等核心商城路由。
- 现象: 每个核心路由都会出现一次 AntD 警告 `Instance created by useForm is not connected to any Form element...`。
- 证据: `report.json` 中三档手机视口共 15 条 `useForm` warning;路由错误 0、网络失败 0。
- 期望修复: 只在实际挂载 Form 的组件内创建 form instance,或确保所有 `useForm()` 实例都传给对应 `<Form form={form}>`;清理未使用/条件渲染中悬空的 form。
- 回归方法: 重新跑本轮脚本或打开核心商城路由,console 不应再出现该 warning;React Router v7 future warning 可忽略。

### A-14 已源码修复 / 专项 smoke PASS:购物车抽屉 `View full cart` CTA 被 App 底部导航遮挡

- 严重程度: 🔴 High
- 当前状态: App/cart drawer 打开时底部 rail 不再覆盖抽屉 footer；`node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js` 中 `add to cart opens drawer and full cart entry` PASS。最新几何: `fullCartOverlapsBottomNav=false`、`checkoutOverlapsBottomNav=false`、drawer open true。
- 影响页面/组件: 移动端购物车抽屉 `CartDrawer`;从商品列表/搜索加购后进入抽屉的完整购物车入口。
- 现象: 390x844 移动视口下,购物车抽屉底部 `View full cart` 按钮被 `.shop-nav__bottomBar` 覆盖,用户无法稳定点击进入完整购物车页。这是 A-09 的组件级阻断点,需要在 `CartDrawer` 内单独兜住。
- 证据:
  - `app-e2e-smoke-20260608T0650-codex/SMOKE_REPORT.md`: `mobile-chromium / public catalog search cart drawer cart page` 失败。
  - 失败几何: button `{top:774,bottom:818,left:10,right:360}`, bottomNav `{top:772,bottom:834,left:8,right:382}`,二者重叠。
  - 截图: `app-e2e-smoke-20260608T0650-codex/screenshots/mobile-cart-drawer.png`
  - 截图: `app-e2e-smoke-20260608T0650-codex/screenshots/mobile-public-catalog-search-cart-drawer-cart-page-failure.png`
  - 2026-06-08 子 Agent E2E 复现: `app-e2e-smoke-20260608T-auth-order-codex/SMOKE_REPORT.md`,场景 `add to cart opens drawer and full cart entry` 失败。
  - 复现几何: `View full cart` `{top:760,bottom:804,left:14,right:356,width:342,height:44}`,bottom nav `{top:772,bottom:844,left:0,right:390,width:390,height:72}`,`fullCartOverlapsBottomNav=true`。
  - 新截图/trace: `app-e2e-smoke-20260608T-auth-order-codex/screenshots/android-webview-add-to-cart-opens-drawer-and-full-cart-entry-cart-drawer-open.png`,`app-e2e-smoke-20260608T-auth-order-codex/traces/android-webview-add-to-cart-opens-drawer-and-full-cart-entry.zip`。
- 期望修复: App/移动模式下购物车抽屉 footer 必须预留底部导航高度、安全区和至少 12px 间距;最后一个 `View full cart` CTA 应完整位于底部导航上方。可在 `CartDrawer.css` 对 `.cart-drawer__footer` / drawer body 做 App nav clearance,或让抽屉底部固定区域整体停在 `.shop-nav__bottomBar` 上方。
- 回归方法: 重新运行 `node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js` 或 `node app-e2e-smoke-20260608T0650-codex/storefront-e2e-smoke.js`,重点看购物车抽屉场景通过;390x844 截图中 `View full cart` 与底部导航无重叠,且 CTA 底边距离 nav 顶边 >= 12px。

## 2026-06-08 07:39 UTC 手机 App 结账流程 UI 审查 / 源码修复后脚本 PASS

> 状态: A-15 ~ A-16 已在 2026-06-08 23:35 UTC 源码修复并通过 Android App WebView 模拟脚本回归；真机/Appium 待测。
> 审查方式: Playwright + API mock + Android App WebView 模拟 (`ShopTestAndroidApp` UA + Capacitor shim)。
> 覆盖: 320x568、390x844;访客结账 loaded、地址卡片、地址 cascader open、支付区填充、提交 ready trial、校验错误态。
> 证据目录: `app-ui-audit-20260608T-checkout-flow-codex/`
> 报告: `app-ui-audit-20260608T-checkout-flow-codex/REPORT.md`, `report.json`;console warnings/errors 6、network failures 0。

### A-15 已源码修复 / 脚本 PASS:结账页支付方式正常响应后仍不渲染付款选项

- 严重程度: 🔴 High
- 当前状态: `normalizeArrayResponseData()` 已兼容直接数组、`data`、`items`、`content`、`records`、`list` 及嵌套数组包装；支付市场缺省/未知值按 `GLOBAL` 处理，结账页以可渲染 method detail 判定可用性。`node audit-mobile-app-checkout-flow-ui.js` 复跑不再出现 `checkout-payment-methods-not-rendered`。
- 影响页面/组件: `/checkout`, `Checkout.tsx` 支付方式区、提交 CTA。
- 现象: 访客结账页在 `/api/payments/channels` 已请求成功的情况下,支付区域仍显示 `Payment methods are temporarily unavailable`,`.checkout-page__paymentMethod` 数量为 0,移动固定支付条仍展示 `Create order and pay ...` 但提交实际被禁用/阻断,用户无法完成下单。
- 证据:
  - `app-ui-audit-20260608T-checkout-flow-codex/report.json`: 320/390 两档、6 个结账状态均出现 `checkout-payment-methods-not-rendered`。
  - API 记录: 每档视口都命中 `GET /api/payments/channels`;本审查脚本固定 mock 顶层数组 `[STRIPE, PAYPAL]`,页面仍为 `paymentMethodCount: 0`, `paymentUnavailableVisible: true`。
  - `phone-390-app-checkout-loaded.png`: 支付卡片显示不可用提示。
  - `phone-390-app-payment-section-filled.png`: 填完地址后支付卡仍不可用,底部支付条存在但无法完成支付。
  - 2026-06-08 子 Agent E2E 复现: `app-e2e-smoke-20260608T-auth-order-codex/SMOKE_REPORT.md`,场景 `checkout form payment visibility and submit readiness` 失败。
  - 新证据: mock `GET /api/payments/channels` 返回 STRIPE/PAYPAL,但 `.checkout-page__paymentMethod` 数量仍为 `0`,`paymentUnavailableVisible=true`,`submitDisabled=true`,`mobilePayDisabled=true`。
  - 新截图/trace: `app-e2e-smoke-20260608T-auth-order-codex/screenshots/android-webview-checkout-form-payment-visibility-and-submit-readiness-checkout-filled-payment.png`,`app-e2e-smoke-20260608T-auth-order-codex/traces/android-webview-checkout-form-payment-visibility-and-submit-readiness.zip`。
- 期望修复: 复查 `paymentApi.getChannels()` → `withArrayData()` → `setPaymentChannels()` → `paymentChannelsAvailable` 链路,确保后端/网关返回的可用渠道能稳定渲染为 `.checkout-page__paymentMethod`;若响应可能是 `{data:[...]}` / `{items:[...]}` 包装,前端需要兼容归一化。支付方式不可用时,移动底部支付条应清楚显示不可提交状态,不要给出像可提交的 `Create order and pay` 主 CTA。
- 回归方法: 在 320/390 App 视口用 mock 返回至少 STRIPE/PAYPAL 两个渠道,打开 `/checkout` 后确认 `.checkout-page__paymentMethod.length >= 1`,不可用 Alert 消失,选择支付方式后移动支付条 CTA 可提交;重新运行 `node audit-mobile-app-checkout-flow-ui.js` 和 `node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js`,不再出现 `checkout-payment-methods-not-rendered` 或结账支付冒烟失败。

### A-16 已源码修复 / 脚本 PASS:结账地址 Cascader 弹层滚动后残留遮挡支付区

- 严重程度: 🔴 High
- 当前状态: 结账地址 Cascader 已改为受控开关，并在滚动、触摸、滚轮、resize、Escape、失焦和离开 checkout 页面时关闭/清理 stale `.ant-cascader-dropdown` portal；`node audit-mobile-app-checkout-flow-ui.js` 复跑不再出现 `checkout-address-cascader-stays-open-after-scroll`。
- 影响页面/组件: `/checkout`, 地址 `Cascader` 弹层、支付区、表单校验态。
- 现象: 在地址区域打开 region cascader 后,页面滚动到支付区或触发提交校验,`.ant-cascader-dropdown` 仍以 `position: fixed; z-index: 9800` 留在屏幕顶部,覆盖后续内容且中心命中不再属于 cascader 自身。用户会看到国家列表悬在订单摘要/支付卡片上方,容易误触或挡住阅读。
- 证据:
  - `app-ui-audit-20260608T-checkout-flow-codex/report.json`: 320/390 两档的 `payment-section-filled`、`submit-ready-trial`、`validation-errors` 均出现 `checkout-address-cascader-stays-open-after-scroll`。
  - 390px 几何: cascader `{top:12,bottom:178,left:8,right:382,width:374,height:166,zIndex:9800}`, payment card `{top:288.39,bottom:721.34}`;`centerHit.inside=false`,命中 `Order summary` / payment card 内容而非 cascader。
  - 截图: `phone-390-app-payment-section-filled.png`
  - 截图: `phone-390-app-submit-ready-trial.png`
  - 截图: `phone-390-app-validation-errors.png`
- 期望修复: 地址 cascader 在滚动离开地址卡、点击/聚焦其他结账字段、提交校验或进入支付区前必须关闭;或将 popup 绑定到地址卡容器并随输入一起滚出视口。避免用全局 fixed popup 在 App 结账流中跨 section 残留。
- 回归方法: 390x844 App 视口打开 `/checkout` → 打开 region cascader → 滚到 `#checkout-payment-card` / 点击提交;确认 `.ant-cascader-dropdown` 不存在或不可见,支付卡片和移动支付条无遮罩/误触。重新运行 `node audit-mobile-app-checkout-flow-ui.js`,不再出现 `checkout-address-cascader-stays-open-after-scroll`。

## 2026-06-08 08:01 UTC 手机 App 认证/查单流程 UI 审查 / 源码修复后脚本 PASS

> 状态: A-17 ~ A-19 已在 2026-06-08 23:35 UTC 源码修复并通过 Android App WebView 模拟脚本回归；真机/Appium 待测。
> 审查方式: Playwright + API mock + Android App WebView 模拟 (`ShopTestAndroidApp` UA + Capacitor shim)。
> 覆盖: 320x568、390x844;登录密码/邮箱码、注册、找回密码、订单追踪初始/校验/结果/操作区/退货弹窗/物流区。
> 证据目录: `app-ui-audit-20260608T-auth-order-codex/`
> 报告: `app-ui-audit-20260608T-auth-order-codex/REPORT.md`, `report.json`;console warnings/errors 22、network failures 0、run errors 0。
> 备注: 登录、注册、找回密码状态本轮未发现新的横向溢出或主操作遮挡;E-mail 清除按钮属于 AntD 内部 12px 图标但容器高 44px,未提升为新问题。

### A-17 已源码修复 / 脚本 PASS:订单追踪页操作按钮被 App 底部导航遮挡

- 严重程度: 🔴 High
- 当前状态: `/track-order` 进入 focused flow 时应用 `shop-app-shell--order-tracking-flow`，移动/App 底部导航在该流程隐藏；`OrderTracking.css` 同步给操作区保留安全间距。`node audit-mobile-app-auth-order-ui.js` 复跑不再出现 `order-tracking-actions-bottom-nav-obscured`。
- 影响页面/组件: `/track-order`, `OrderTracking.tsx` 空态/结果态操作区。
- 现象: App 模式下订单追踪页底部导航缺少页面级 clearance,导致空态 `Contact support` 和结果态 `Confirm receipt` / `Request return` / `Contact support` 操作按钮落入 `.shop-nav__bottomBar` 区域。390x844 结果态中三个关键按钮整高 44px 都被底部导航覆盖,用户无法稳定完成收货确认、退货或联系客服。
- 证据:
  - `app-ui-audit-20260608T-auth-order-codex/report.json`: `order-tracking-actions-bottom-nav-obscured` 共 5 条。
  - 390px 结果态几何: `Confirm receipt` / `Request return` / `Contact support` 均为 `{top:773.09,bottom:817.09,height:44,overlapPx:44}`,bottom nav `{top:772,bottom:844,height:72}`。
  - 320px 初始态几何: `Contact support` `{top:515.52,bottom:559.52,height:44,overlapPx:44}`,bottom nav `{top:496,bottom:568,height:72}`。
  - 截图: `phone-390-app-order-tracking-result-top.png`
  - 截图: `small-320-app-order-tracking-initial.png`
- 期望修复: `/track-order` 在 App 模式下给页面底部和结果操作区预留 `bottom nav height + safe-area + 12px` 的稳定空间;`order-tracking-page__nextActionButtons` 不应在滚动定位后落入底栏。空态按钮、结果态按钮和物流区入口都应完整位于底部导航上方。
- 回归方法: 320x568 和 390x844 App 视口打开 `/track-order`,先看空态,再 mock 成功查单;滚动到结果操作区后确认最后一行按钮底边距离 `.shop-nav__bottomBar.top` >= 12px。重新运行 `node audit-mobile-app-auth-order-ui.js`,不再出现 `order-tracking-actions-bottom-nav-obscured`。

### A-18 已源码修复 / 脚本 PASS:订单追踪退货 Modal footer 与 App 底部导航冲突

- 严重程度: 🔴 High
- 当前状态: 订单追踪退货 Modal 内容和 footer 已避开固定 rails，并在 focused flow 下不再与 App 底部导航竞争底部空间；`node audit-mobile-app-auth-order-ui.js` 复跑不再出现 `order-tracking-return-modal-footer-bottom-nav-overlap`。
- 影响页面/组件: `/track-order`, 退货申请 Modal (`profile-mobile-safe-modal order-tracking-page__returnModal`)。
- 现象: 320x568 App 短屏打开 `Request return` 后,Modal footer 使用 sticky 布局,底边贴到 504.56px,与底部导航 top 496px 发生 8.56px 垂直重叠。虽然按钮自身仍在 44px 高度内,整个 footer 与底栏竞争同一底部区域,容易造成遮挡、误触和视觉压迫。
- 证据:
  - `app-ui-audit-20260608T-auth-order-codex/report.json`: `order-tracking-return-modal-footer-bottom-nav-overlap`。
  - 320px 几何: modal footer `{top:388.56,bottom:504.56,width:252,height:116,position:sticky}`,bottom nav `{top:496,bottom:568,height:72}`,overlap `{x:252,y:8.56,area:2157.75}`。
  - Modal footer 按钮: `Cancel` `{top:398.56,bottom:442.56,width:224,height:44}`,`Request return` `{top:450.56,bottom:494.56,width:224,height:44}`。
  - 截图: `small-320-app-order-return-modal-open.png`
- 期望修复: App 模式下订单退货 Modal 的内容高度和 footer sticky offset 必须考虑底部导航与 safe-area;footer 底边应停在 bottom nav 上方至少 12px,或在 Modal 打开时隐藏/禁用底部导航并保证遮罩层优先级清晰。
- 回归方法: 320x568 App 视口查单成功 → 打开 `Request return`;确认 Modal footer、`Cancel`、`Request return` 均不与 `.shop-nav__bottomBar` 重叠,视觉上底部留有安全间距。重新运行 `node audit-mobile-app-auth-order-ui.js`,不再出现 `order-tracking-return-modal-footer-bottom-nav-overlap`。

### A-19 已源码修复 / 脚本 PASS:订单追踪旅程步骤标签 11px 且横向裁切

- 严重程度: 🟡 Medium
- 当前状态: App 手机视口下订单旅程步骤改为可读 2x2 网格，标签字号提升到 12px 且取消无提示横向裁切；`node audit-mobile-app-auth-order-ui.js` 复跑不再出现 `order-tracking-journey-step-labels-too-small-clipped`。
- 影响页面/组件: `/track-order`, `.order-tracking-page__steps`。
- 现象: 订单追踪结果态的旅程步骤条在 320/390 App 视口中横向内容宽于容器,同时步骤标签 computed `font-size: 11px`。390px 下容器 `clientWidth=340`、`scrollWidth=496`;320px 下 `clientWidth=270`、`scrollWidth=456`。截图中 `In transit` / 后续步骤被右侧裁切,且没有明显可滚动提示,物流状态可读性不足。
- 证据:
  - `app-ui-audit-20260608T-auth-order-codex/report.json`: `order-tracking-journey-step-labels-too-small-clipped` 共 4 条。
  - 390px 几何: `.order-tracking-page__steps` `{width:340,scrollWidth:496,clientWidth:340,overflowX:auto}`,步骤标签 `Order placed` / `Preparing` / `In transit` / `Delivered` 均为 `fontSize:11px,height:12.97`。
  - 320px 几何: `.order-tracking-page__steps` `{width:270,scrollWidth:456,clientWidth:270,overflowX:auto}`。
  - 截图: `phone-390-app-order-tracking-result-top.png`
  - 截图: `small-320-app-order-tracking-result-top.png`
- 期望修复: 在 App 手机视口中把步骤标签字号提升到 ≥12px,并让旅程步骤以可读方式布局:可改为 2x2 网格、压缩 gap、提供渐变/分页提示,或确保横向滚动有明确 affordance;不要让当前/下一步状态被裁切。
- 回归方法: 320/390 App 视口查单成功后读取 `.order-tracking-page__step span` 字号应 >= 12px;`.order-tracking-page__steps` 不应无提示裁切关键步骤。重新运行 `node audit-mobile-app-auth-order-ui.js`,不再出现 `order-tracking-journey-step-labels-too-small-clipped`。

## 2026-06-08 08:27 UTC 手机 App Profile/客服浮窗 UI 审查 / 源码修复后脚本 PASS

> 状态: A-20 已在 2026-06-08 23:35 UTC 源码修复并通过 Android App WebView 模拟脚本回归；真机/Appium 待测。
> 审查方式: Playwright + API mock + Android App WebView 模拟 (`ShopTestAndroidApp` UA + Capacitor shim)。
> 覆盖: 320x568、390x844;Profile 地址 Modal/Cascader、宠物 Modal/类型 Select/生日 DatePicker/体型 Select、客服浮窗、客服订单 Select、客服订单详情 Modal。
> 证据目录: `app-ui-audit-20260608T-profile-support-app-codex/`
> 报告: `app-ui-audit-20260608T-profile-support-app-codex/REPORT.md`, `report.json`;console warnings/errors 28、network failures 0、run errors 0。
> 备注: Profile 地址/宠物弹层在 App 条件下 hit-test 已命中 Cascader/Select/DatePicker 选项;客服订单 Select 也已命中 `.ant-select-item-option-content`,本轮不重复记录旧 Profile popup 和 support order Select 普通浏览器问题。

### A-20 已源码修复 / 脚本 PASS:客服浮窗内订单详情 Modal 被客服面板覆盖

- 严重程度: 🔴 High
- 当前状态: 客服订单 Select 和订单详情 Modal 已使用专用高层 popup/root class 与显式 z-index，Modal mask/wrap/content 高于客服面板并受小屏视口约束；`node audit-mobile-app-profile-support-ui.js` 复跑不再出现 `support-order-modal-under-panel`。
- 影响页面/组件: 全站客服浮窗 `CustomerSupportWidget`,订单卡片 `View order` 详情 Modal。
- 现象: Android App WebView 中打开客服浮窗后点击订单卡片的 `View order`,订单详情 Modal 已插入 DOM,但仍位于客服面板/遮罩之下。用户看到的是聊天面板被半透明灰层压住,Modal 内容和关闭按钮无法正常点击;订单详情被聊天消息、客服 header close 或 backdrop 命中。
- 证据:
  - `app-ui-audit-20260608T-profile-support-app-codex/report.json`: `support-order-modal-under-panel` 共 2 条。
  - 320px 几何: `.customer-support-widget__panel` `{top:8,bottom:560,left:8,right:312,width:304,height:552,zIndex:9799}`,订单 Modal `{top:22,bottom:526,left:10,right:310,width:300,height:504,zIndex:auto}`;Modal 中心命中 `.customer-support-widget__bubble`,不是 `.ant-modal-content`。
  - 320px close 命中: Modal close `{top:28,bottom:72,left:260,right:304,width:44,height:44,zIndex:1010}`,点击点命中客服 header close 图标。
  - 390px 几何: 支持面板 `{top:64.16,bottom:836,left:8,right:382,width:374,height:771.84,zIndex:9799}`,订单 Modal `{top:22,bottom:601.19,left:10,right:380,width:370,height:579.19,zIndex:auto}`;Modal 中心命中 `.customer-support-widget__message--mine`,close 点击点命中 `.customer-support-widget__backdrop`。
  - 截图: `small-320-app-support-order-modal-open.png`
  - 截图: `phone-390-app-support-order-modal-open.png`
- 期望修复: 客服订单详情 Modal 必须进入客服浮窗的最高层交互上下文。可选方案: 将订单详情 Modal portal 到客服 panel 内部并使用本地 z-index;或在打开订单详情时把 `.customer-support-widget__panel` 降层/暂停点击;或给 `.customer-support-widget__orderModal` 的 root/wrap/mask/content 一个明确高于客服 panel/backdrop 的 App 专用 z-index。修复后 Modal 内容、关闭按钮、列表滚动都应命中自身。
- 回归方法: 320x568 和 390x844 App 视口打开任意页面 → 打开客服 → 点击订单卡 `View order`;`document.elementFromPoint()` 在 Modal 内容中心应命中 `.ant-modal-content` 内元素,close 中心应命中 `.ant-modal-close`。重新运行 `node audit-mobile-app-profile-support-ui.js`,不再出现 `support-order-modal-under-panel`。

## 2026-06-08 08:44 UTC 手机 App 账户工具页 UI 审查 / 源码修复后脚本 PASS

> 状态: A-21 已在 2026-06-08 16:11 UTC 当前脚本复跑 PASS；A-22 已在 2026-06-08 23:35 UTC 源码修复并通过 Android App WebView 模拟脚本回归；真机/Appium 待测。
> 审查方式: Playwright + API/localStorage mock + Android App WebView 模拟 (`ShopTestAndroidApp` UA + Capacitor shim)。
> 覆盖: 320x568、390x844;通知列表/删除 Popconfirm、库存提醒顶部/删除 Popconfirm/底部、浏览历史顶部/删除 Popconfirm/底部、支付说明验证态顶部/底部。
> 证据目录: `app-ui-audit-20260608T-account-utilities-app-codex/`
> 报告: `app-ui-audit-20260608T-account-utilities-app-codex/REPORT.md`, `report.json`;console warnings/errors 16、network failures 0、run errors 0。
> 备注: `/notifications` 和 `/payment/:orderNo` 本轮未发现新的可复现 App UI 问题;通知删除 Popconfirm、库存提醒删除 Popconfirm、浏览历史删除 Popconfirm 的确认按钮 hit-test 均命中自身。

### A-21 已回归 PASS:库存提醒移动主操作条被 App 底部导航完全覆盖

- 严重程度: 🔴 High
- 影响页面/组件: `/stock-alerts`, `.stock-alerts__mobileAction`。
- 现象: Android App WebView 中库存提醒页存在固定底部主操作条,但该条 `bottom:0` 且 `z-index:1000`,落在 `.shop-nav__bottomBar` 的固定底栏区域下方。用户看到底部导航压住 `Add ready items`,点击按钮中心实际命中底部导航 `Cart`,无法稳定执行库存提醒页的主要加购操作。
- 2026-06-08 16:11 UTC 当前回归: 重新运行 `node audit-mobile-app-account-utilities-ui.js` 后 `stock-alerts-mobile-action-overlaps-bottom-nav` 不再出现；`.stock-alerts__mobileAction` 在 320px 为 `{top:408,bottom:484,height:76,zIndex:8998}`、在 390px 为 `{top:684,bottom:760,height:76,zIndex:8998}`，按钮中心 hit-test 命中自身或内部图标，未命中底部导航。
- 证据:
  - `app-ui-audit-20260608T-account-utilities-app-codex/report.json`: `stock-alerts-mobile-action-overlaps-bottom-nav` 共 6 条。
  - 320px 几何: mobile action `{top:503,bottom:568,left:0,right:320,width:320,height:65,position:fixed,zIndex:1000}`,bottom nav `{top:496,bottom:568,width:320,height:72,zIndex:9000}`,overlap `{x:320,y:65,area:20800}`。
  - 320px hit-test: `Add ready items` 按钮点击点 `{x:232.91,y:536}` 命中 `a.shop-nav__bottomItem--cart`,不是按钮自身。
  - 390px 几何: mobile action `{top:779,bottom:844,left:0,right:390,width:390,height:65,position:fixed,zIndex:1000}`,bottom nav `{top:772,bottom:844,width:390,height:72,zIndex:9000}`,overlap `{x:390,y:65,area:25350}`。
  - 390px hit-test: `Add ready items` 按钮点击点 `{x:284.54,y:812}` 命中 `a.shop-nav__bottomItem--cart`,不是按钮自身。
  - 截图: `small-320-app-stock-alerts-top.png`
  - 截图: `small-320-app-stock-alerts-bottom.png`
  - 截图: `phone-390-app-stock-alerts-top.png`
  - 截图: `phone-390-app-stock-alerts-bottom.png`
- 期望修复: App 模式下 `.stock-alerts__mobileAction` 必须避开底部导航。可参考浏览历史页当前 App guard,把该操作条收回内容流;或保持 fixed 但 `bottom` 至少为 `bottom nav height + safe-area + 12px`,并给页面底部预留相同空间。修复后按钮中心 hit-test 应命中 `.stock-alerts__mobileAction .ant-btn`,不应命中底部导航。
- 回归方法: 320x568 和 390x844 App 视口打开 `/stock-alerts`,mock 至少一个 back-in-stock 商品;分别在顶部、删除 Popconfirm 打开状态、滚到底部时检查 `.stock-alerts__mobileAction` 与 `.shop-nav__bottomBar` 无重叠,`Add ready items` 中心命中自身。重新运行 `node audit-mobile-app-account-utilities-ui.js`,不再出现 `stock-alerts-mobile-action-overlaps-bottom-nav`。

### A-22 已源码修复 / 脚本 PASS:库存提醒/浏览历史洞察标签字号低于 12px

- 严重程度: 🟡 Medium
- 当前状态: `StockAlerts.css` 与 `BrowsingHistory.css` 已增加账户工具 App 视口最终 guard，洞察标签、移动操作说明和状态文案字号提升到 12px+；`node audit-mobile-app-account-utilities-ui.js` 复跑不再出现 `account-utilities-insight-labels-too-small`。
- 影响页面/组件: `/stock-alerts` 的洞察信号和移动主操作条文案,`/history` 的 eyebrow/洞察信号/移动操作条文案。
- 现象: Android App 手机视口中多个账户工具页的辅助洞察标签 computed font-size 为 10.5px 或 11px,低于本清单移动端最小 12px 标准。库存提醒页的 `Ready now` / `Low-stock ready` / `Still watching` 和 `Add ready alerts now` 在 320/390 视口均为 11px;浏览历史页的 `All viewed` / `Viewed today` / `Deals watched` / `Low stock` 为 10.5px,`Recently viewed` / `Next browsing action` 为 11px。该类标签承担状态解释和下一步提示,不应按装饰性小字处理。
- 证据:
  - `app-ui-audit-20260608T-account-utilities-app-codex/report.json`: `account-utilities-insight-labels-too-small` 共 10 条。
  - 320px 库存提醒顶部: `Ready now` / `Low-stock ready` / `Still watching` 均 `fontSize:11px,height:12.64`;移动条 `Add ready alerts now` `fontSize:11px,height:13.75`。
  - 390px 库存提醒顶部: 同一组标签均为 `fontSize:11px`;移动条 `Add ready alerts now` `fontSize:11px,height:13.75`。
  - 320px 浏览历史顶部: `Recently viewed` `fontSize:11px,height:12`;`All viewed` / `Viewed today` `fontSize:10.5px,height:12.06`。
  - 390px 浏览历史顶部: `All viewed` / `Viewed today` / `Deals watched` / `Low stock` `fontSize:10.5px,height:12.06`;底部 `Next browsing action` `fontSize:11px,height:13.19`。
  - 截图: `small-320-app-stock-alerts-top.png`
  - 截图: `phone-390-app-stock-alerts-top.png`
  - 截图: `small-320-app-history-top.png`
  - 截图: `phone-390-app-history-top.png`
- 期望修复: App 手机视口中这些状态/操作说明标签字号提升到 ≥12px,同时保持卡片/操作条不溢出、不遮挡。若空间不足,优先调整 grid/flex gap、允许文案换行或减少重复标签,不要继续压低字号。
- 回归方法: 320x568 和 390x844 App 视口打开 `/stock-alerts` 与 `/history`,读取上述标签 computed `font-size` 应全部 >= 12px。重新运行 `node audit-mobile-app-account-utilities-ui.js`,不再出现 `account-utilities-insight-labels-too-small`。

## 2026-06-08 16:15 UTC 手机 App UI 修复前复跑状态

> 状态: 该节保留 16:15 UTC 修复前 Playwright + Android App WebView 模拟复跑结果；A-15、A-16、A-17、A-18、A-19、A-20、A-22 的最新 23:35 UTC 修复后 PASS 结果见下一节。`mobile-storefront` 中 2 条 `hot-update.json` aborted 属于 dev-server HMR 噪声,不计作页面网络失败；真机/Appium 仍未完成。

| 范围 | 命令 | 当前结果 | 仍需开发处理 |
|---|---|---|---|
| 商城端首页/商品/购物车/优惠券/收藏/通知/Profile orders/查单/Pet Finder | `node audit-mobile-app-storefront-ui.js` | 16:15 修复前: 69 个 route state；`bottom-nav-obscures-control` 26 个状态、`small-touch-target` 6 个状态；`useForm` warning 15 条。 | 2026-06-09 00:13 已源码修复并脚本 PASS；最新 `report.json` 为 issueStateCount 0、network/route errors 0、`useFormWarningCount` 0。 |
| 结账流程 | `node audit-mobile-app-checkout-flow-ui.js` | 16:15 修复前: Issues 18；`checkout-payment-methods-not-rendered` x12、`checkout-address-cascader-stays-open-after-scroll` x6；network failures 0。 | 23:35 已源码修复并脚本 PASS；真机待测。 |
| 认证/查单/退货 Modal | `node audit-mobile-app-auth-order-ui.js` | 16:15 修复前: Issues 10；`order-tracking-actions-bottom-nav-obscured` x5、`order-tracking-journey-step-labels-too-small-clipped` x4、`order-tracking-return-modal-footer-bottom-nav-overlap` x1；run errors 0。 | 23:35 已源码修复并脚本 PASS；真机待测。 |
| Profile/客服浮窗 | `node audit-mobile-app-profile-support-ui.js` | 16:15 修复前: Issues 2；`support-order-modal-under-panel` x2；run errors 0。 | 23:35 已源码修复并脚本 PASS；真机待测。 |
| 账户工具页 | `node audit-mobile-app-account-utilities-ui.js` | 16:15 修复前: Issues 10；仅 `account-utilities-insight-labels-too-small` x10；`stock-alerts-mobile-action-overlaps-bottom-nav` 已消失。 | A-21 保持 PASS；A-22 于 23:35 已源码修复并脚本 PASS；真机待测。 |
| 宠物工具/商品对比 | `node audit-mobile-app-pet-compare-ui.js` | 24 个状态；Issues 0；network failures 0；run errors 0。 | UI-20260608-01~03 当前脚本覆盖 PASS，等真机最终确认。 |
| 商品详情购买条小审查 | 临时 Playwright 片段，证据 `app-ui-audit-20260608T-product-detail-buybar-current-codex/` | 320/390 App 下底部导航隐藏；`Favorite`、`Add to cart`、`Buy now` 均 >=44px 且命中自身；脚本自动标记隐藏 Home/Compare,经目视和几何复核不升级为待修缺陷。 | 无新增。 |

## 2026-06-08 23:35 / 2026-06-09 00:13 UTC 手机 App UI 修复后复跑状态

> 状态: A-09 ~ A-22 当前已完成源码修复并通过对应 Android App WebView 模拟脚本；A-21 保持 PASS。真机/Appium 仍待连接设备后执行。

| 范围 | 命令 | 当前结果 | 后续 |
|---|---|---|---|
| 商城端首页/商品/购物车/优惠券/收藏/通知/Profile orders/查单/Pet Finder | `node audit-mobile-app-storefront-ui.js` | 69 个 route state；issueStateCount 0；issueCounts `{}`；network failures 0；route errors 0；`useFormWarningCount` 0；report `app-ui-audit-20260608T-mobile-storefront-codex/report.json`。 | 真机复测底部导航让位、优惠券/收藏/商品列表触控和 checkout console；A-14 抽屉入口另由 smoke 场景覆盖。 |
| 购物车抽屉完整购物车入口 | `node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js` | 场景 `add to cart opens drawer and full cart entry` PASS；几何 `fullCartOverlapsBottomNav=false`。整体 smoke 6/7，剩余 checkout readiness 仍按 A-15 脚本选择 region 后续跟进。 | 真机复测商品列表加购后抽屉 footer、`Checkout`、`View full cart` hit-test。 |
| 结账流程 | `node audit-mobile-app-checkout-flow-ui.js` | issueCount 0；network failures 0；report `app-ui-audit-20260608T-checkout-flow-codex/report.json`。 | 真机复测支付方式渲染、地址 Cascader 滚动关闭和提交校验。 |
| 认证/查单/退货 Modal | `node audit-mobile-app-auth-order-ui.js` | issueCount 0；run errors 0；report `app-ui-audit-20260608T-auth-order-codex/report.json`。 | 真机复测订单追踪操作区、旅程步骤和退货 Modal。 |
| Profile/客服浮窗 | `node audit-mobile-app-profile-support-ui.js` | issueCount 0；run errors 0；report `app-ui-audit-20260608T-profile-support-app-codex/report.json`。 | 真机复测客服订单 Select 与订单详情 Modal 层级。 |
| 账户工具页 | `node audit-mobile-app-account-utilities-ui.js` | issues []；networkFailureCount 0；runErrors []；report `app-ui-audit-20260608T-account-utilities-app-codex/report.json`。 | 真机复测库存提醒和浏览历史标签字号/底部操作区。 |
