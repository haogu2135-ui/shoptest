# Android UI 回归测试计划

> 测试目标: 验证 ANDROID_UI_ISSUES.md 中记录的所有问题已修复，且未引入新问题
> 测试环境: Android 12+ / Chrome WebView / Capacitor Native App
> 测试视窗: 360px, 380px, 428px, 768px (竖屏+横屏)

---

## 2026-06-05 复测入口

本轮源码修复已完成，复测时优先执行：

- T09-T21: 回归报告历史快照中 13 项失败/未触及触控目标；当前已源码补修，需读取 Android computed size 验证。
- T37-T47: 客服 Escape、加载/错误状态、Profile Spin/ARIA。
- T48-T68: 后台/辅助页面触控目标、字号、对比度。
- T69-T72: 全局文件和 Skeleton 性能。
- 22:09 UTC 补充: 追加评价晒单图片上传/预览/删除和后台评价图片展示回归，重点确认 Android WebView 44px 触控目标、1:1 缩略图、无横向溢出和三语文案不截断。
- 22:20 UTC 补充: 追加第四轮剩余管理页/组件复测：Brand/Category/Notification/Alert/IpBlacklist/Log/StockAlerts/AddOn/SearchBar/PetPersonalized/Payment/SocialProofToast/ProductManagement import tooltip/Coupon grant modal。重点确认 44px 触控目标、输入框 16px、移动端小字 >=12px、低对比文本加深、长文案换行、无横向溢出。
- 22:34 UTC 补充: 追加最终 Android/App 兜底复测：原生 App body class 下所有 AntD/自定义按钮和选择器 computed `min-height >= 44px`，输入框 computed `font-size = 16px`，小标签/元信息 `font-size >= 12px`；底部导航文字 12px、激活态绿色高亮、图标约放大 10%；商品详情 SKU 选中态为绿色边框/浅绿背景；旧版 Android WebView 不因 `overflow-x: clip` 缺失产生横向滚动。
- 23:17 UTC 补充: 追加精修项复测：Navbar 徽标接口失败时应出现一次性轻提示且不再完全静默；登出撤销失败应提示；Cart 加载失败空态在 360/428/768px 下无高空白峡谷且空态图标响应式；商品详情图片预览 Modal 不超过视口宽度；移动图片轮播最后一张在 Android WebView 下不再因强制 snap 对齐异常。
- 23:36 UTC 补充: 追加运行时最终 guard 复测：路由懒加载完成后 `<head>` 最后应存在 `shop-android-ui-final-guard`；重新读取 T09-T72、首页、商品详情、Modal/Drawer 和管理页 computed 样式，确认后加载 CSS 不能覆盖 44px 触控、16px 输入、>=12px 小字、商品详情图片/缩略图/SKU、首页商品卡和管理页网格闭合规则。
- 00:16 UTC 补充: 追加购物车/结算状态复测：Cart stock=0/下架商品数量区应显示缺货或暂不可买状态 chip，不能显示禁用数量 `1`；登录态 Checkout 后端 quote 慢响应或失败时运费区应显示计算中/不可用，提交按钮禁用且提交保护生效，quote 成功后再显示真实运费/应付金额。
- 01:35 UTC 补充: 追加访客订单链路复测：新访客订单应通过 `guest_order` 和专用联系人字段识别，`shippingAddress` 不再包含 `[Guest] name / phone / email` 拼接；Android App/WebView 需覆盖访客结账、查单、客服入口、支付成功/取消返回、访客取消/退货，以及旧 `[Guest]` 历史订单兼容。
- 02:18 UTC 补充: 追加客服消息 HTML payload 显示复测：客户客服、访客订单客服、后台客服回复和 WebSocket 客服发送 raw `<script>`、encoded `&lt;img ...&gt;`、nested `&amp;lt;script&amp;gt;` 后，应只显示安全文本，无脚本执行、无消息气泡溢出，普通文本发送不回归。
- 已关闭/源码闭合问题归档: `ANDROID_UI_CLOSED_ARCHIVE.md`。
- PWA/Android: theme-color、maskable 图标、`mobile-web-app-capable`、`format-detection`。

当前仅做源码静态检查：`git diff --check` 通过；未构建、未发布 APK、未执行截图或真机测试。

## 一、P0 修复验证清单

### 1.1 触摸目标尺寸验证 (目标: ≥44px)

使用浏览器DevTools测量以下元素的实际渲染尺寸：

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T01 | Cart.css:528 | 数量步进器按钮 | 30px | ___px | ⬜ |
| T02 | Cart.css:536 | 数量输入框 | 30px | ___px | ⬜ |
| T03 | ProductDetail.css:3168 | 购买栏工具按钮(360px) | 34px | ___px | ⬜ |
| T04 | ProductDetail.css:3037 | 购买栏工具按钮(380px) | 36px | ___px | ⬜ |
| T05 | ProductDetail.css:3152 | 购买栏按钮(420px) | 42px | ___px | ⬜ |
| T06 | ProductDetail.css:3310 | Tab按钮(360px) | 32px | ___px | ⬜ |
| T07 | ProductDetail.css:3504 | 套装商品按钮(360px) | 36px | ___px | ⬜ |
| T08 | Login.css:1120 | 登录面板按钮(430px) | 38px | ___px | ⬜ |
| T09 | Login.css:1496 | 快捷链接(430px) | 38px | ___px | ⬜ |
| T10 | Login.css:1667 | 登录链接(430px) | 34px | ___px | ⬜ |
| T11 | CustomerSupportWidget.css:768 | 客服链接按钮 | 28px | ___px | ⬜ |
| T12 | CustomerSupportWidget.css:1716 | 链接按钮(430px) | 26px | ___px | ⬜ |
| T13 | CustomerSupportWidget.css:1798 | 快速回复(430px) | 32px | ___px | ⬜ |
| T14 | Cart.css:1997 | 删除按钮(420px) | 38px | ___px | ⬜ |
| T15 | Cart.css:2390 | 删除按钮(360px) | 36px | ___px | ⬜ |
| T16 | Checkout.css:2745 | 空操作按钮(360px) | 40px | ___px | ⬜ |
| T17 | Profile.css:1372 | 订单操作按钮(900px) | 34px | ___px | ⬜ |
| T18 | ProductReview.css:147 | 提交评价按钮(430px) | 38px | ___px | ⬜ |
| T19 | OrderManagement.css:381 | 表单输入框 | 34px | ___px | ⬜ |

### 1.2 字号验证 (目标: ≥12px, 表单输入≥16px)

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T20 | ProductDetail.css:4418 | 购买栏工具标签(430px) | 9px | ___px | ⬜ |
| T21 | ProductDetail.css:3052 | 购买栏工具标签(380px) | 9px | ___px | ⬜ |
| T22 | CartDrawer.css:1904 | 统计数字(360px) | 9px | ___px | ⬜ |
| T23 | ProductDetail.css:100 | 西班牙语购买栏(720px) | 9.5px | ___px | ⬜ |
| T24 | CustomerSupportWidget.css:1789 | 工作流标签(430px) | 10px | ___px | ⬜ |
| T25 | CustomerSupportWidget.css:1712 | 订单标签(430px) | 10px | ___px | ⬜ |
| T26 | Login.css:1160 | 统计文字(430px) | 10px | ___px | ⬜ |
| T27 | Cart.css:1820 | 西班牙语统计(420px) | 10px | ___px | ⬜ |
| T28 | Checkout.css:2117 | 西班牙语统计(420px) | 10px | ___px | ⬜ |
| T29 | ProductDetail.css:3183 | 购买按钮文字(360px) | 10px | ___px | ⬜ |
| T30 | Cart (全局) | 表单输入框font-size | 缺失 | 16px? | ⬜ |
| T31 | CustomerSupportWidget.css:1816 | 消息输入框(430px) | 12px | 16px? | ⬜ |

### 1.3 对比度验证 (目标: ≥4.5:1)

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T32 | ProductDetail.css:269 | 促销文字 | 3.4:1 | ___:1 | ⬜ |
| T33 | ProductDetail.css:277 | 售罄按钮 | 3.9:1 | ___:1 | ⬜ |
| T34 | Login.css:267 | 统计文字 | 4.1:1 | ___:1 | ⬜ |
| T35 | CustomerSupportWidget.css:730 | 消息元数据 | 极低 | ___:1 | ⬜ |
| T36 | Profile.css:199 | 警告文字 | 4.1:1 | ___:1 | ⬜ |

---

## 二、功能回归测试

### 2.1 购物车页面

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F01 | 点击数量+按钮 | 数量+1，按钮可正常点击 | ⬜ |
| F02 | 点击数量-按钮 | 数量-1，按钮可正常点击 | ⬜ |
| F03 | 手动输入数量 | 输入框可聚焦，无自动缩放 | ⬜ |
| F04 | 点击删除按钮 | 弹出确认对话框 | ⬜ |
| F05 | 横屏模式下操作购物车 | 布局正常，按钮可点击 | ⬜ |

### 2.2 商品详情页

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F06 | 点击"加入购物车"按钮 | 商品添加成功 | ⬜ |
| F07 | 点击"立即购买"按钮 | 跳转结账页 | ⬜ |
| F08 | 切换商品规格Tab | Tab切换正常 | ⬜ |
| F09 | 点击套装商品按钮 | 按钮可正常点击 | ⬜ |
| F10 | 左右滑动商品图片 | 轮播正常，无卡顿 | ⬜ |
| F11 | 360px视窗下操作购买栏 | 所有按钮可点击 | ⬜ |

### 2.3 登录/注册页

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F12 | 输入用户名/密码 | 输入框可聚焦，无缩放 | ⬜ |
| F13 | 点击登录按钮 | 登录成功 | ⬜ |
| F14 | 点击快捷链接 | 跳转正常 | ⬜ |
| F15 | 点击验证码按钮 | 发送验证码 | ⬜ |
| F16 | Tab切换登录/注册 | 切换正常 | ⬜ |

### 2.4 结账页

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F17 | 填写收货地址 | 表单输入正常 | ⬜ |
| F18 | 选择支付方式 | 单选可点击 | ⬜ |
| F19 | 提交订单 | 提交按钮可点击 | ⬜ |
| F20 | 空购物车跳转结账 | 操作按钮可点击 | ⬜ |

### 2.5 客服组件

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F21 | 打开客服面板 | 面板正常弹出 | ⬜ |
| F22 | 点击快速回复按钮 | 发送预设消息 | ⬜ |
| F23 | 输入消息 | 输入框可聚焦，无缩放 | ⬜ |
| F24 | 点击链接按钮 | 链接可点击 | ⬜ |
| F25 | 关闭客服面板 | 面板正常关闭 | ⬜ |

### 2.6 个人资料页

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| F26 | 查看订单列表 | 订单操作按钮可点击 | ⬜ |
| F27 | 切换订单Tab | Tab切换正常 | ⬜ |
| F28 | 编辑收货地址 | 表单输入正常 | ⬜ |
| F29 | 横屏模式下浏览 | 布局正常 | ⬜ |

---

## 三、新问题排查清单

修复后需检查以下区域是否引入新问题：

### 3.1 布局溢出检查

在360px、380px、428px视窗下检查：
- [ ] 无水平滚动条出现
- [ ] 文字无截断/溢出
- [ ] 按钮不超出容器边界
- [ ] 图片不溢出卡片

### 3.2 层级问题检查

- [ ] 下拉菜单不被遮挡
- [ ] 模态框正常显示
- [ ] 底部导航栏不遮挡内容
- [ ] 客服按钮不被遮挡

### 3.3 交互反馈检查

- [ ] 按钮点击有视觉反馈
- [ ] 触摸高亮正常
- [ ] 加载状态正常显示
- [ ] 错误提示正常显示

### 3.4 国际化检查

在中文、英文、西班牙文环境下：
- [ ] 文字不溢出容器
- [ ] 按钮宽度自适应
- [ ] 长文本正确截断/换行

---

## 四、测试执行记录

### 测试环境
- 设备: _______________
- 系统版本: _______________
- 浏览器/WebView版本: _______________
- 测试日期: _______________

### 测试结果汇总
| 类别 | 总数 | 通过 | 失败 | 跳过 |
|------|------|------|------|------|
| P0修复验证(CSS) | 36 | | | |
| 功能回归 | 29 | | | |
| 新问题排查 | 16 | | | |
| TSX组件验证 | 11 | | | |
| 第二轮-管理后台 | 5 | | | |
| 第二轮-辅助页面 | 7 | | | |
| 第二轮-字号验证 | 5 | | | |
| 第二轮-对比度验证 | 4 | | | |
| 第二轮-全局文件 | 4 | | | |
| **总计** | **117** | | | |

## 五、TSX组件问题验证清单

### 5.1 无障碍验证

| # | 文件:行号 | 问题 | 验证方法 | 状态 |
|---|----------|------|---------|------|
| T37 | CustomerSupportWidget.tsx:891 | 对话框无Escape关闭 | 打开客服面板 → 按Escape → 应关闭 | ⬜ |
| T38 | 全部TSX | 无prefers-reduced-motion | 系统设置开启"减少动态效果" → 检查动画是否停止 | ⬜ |
| T39 | Profile.tsx:1222 | Tab栏缺少ARIA角色 | DevTools检查 → 应有role="tablist"/"tab" | ⬜ |
| T40 | Profile.tsx:1098 | 加载无Spin/aria-live | 打开个人资料页 → 应显示Spin组件 | ⬜ |
| T41 | Login.tsx:431 | 表单缺少visible label | 检查登录表单 → 输入框应有可见标签或aria-label | ⬜ |

### 5.2 布局与样式验证

| # | 文件:行号 | 问题 | 验证方法 | 状态 |
|---|----------|------|---------|------|
| T42 | Cart.tsx:625-699 | 表格列宽硬编码 | 768px视窗下查看桌面表格 → 应无水平溢出 | ⬜ |
| T43 | ProductDetail.tsx:2102 | Modal宽度800px硬编码 | 360px视窗下打开Modal → 应不超出屏幕 | ⬜ |
| T44 | CustomerSupportWidget.tsx:875 | 浮动按钮硬编码尺寸 | 检查按钮 → 应随系统字号缩放 | ⬜ |

### 5.3 加载与错误状态验证

| # | 文件:行号 | 问题 | 验证方法 | 状态 |
|---|----------|------|---------|------|
| T45 | Profile.tsx:1098 | 加载状态无Spinner | 慢网络下打开个人资料 → 应显示Spinner | ⬜ |
| T46 | CustomerSupportWidget | 面板打开无加载指示 | 点击客服按钮 → session创建期间应有加载状态 | ⬜ |
| T47 | CustomerSupportWidget:338 | 订单失败无错误提示 | 模拟API失败 → 应显示错误信息 | ⬜ |

---

## 六、第二轮测试：管理后台 + 辅助页面 + 全局文件验证

### 6.1 管理后台触摸目标验证

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T48 | AdminDashboard.css | 全局按钮 | 无保护 | ___px | ⬜ |
| T49 | UserManagement.css:229 | 表格按钮(430px) | 30px | ___px | ⬜ |
| T50 | ReviewManagement.css:258 | 表格按钮(430px) | 30px | ___px | ⬜ |
| T51 | CouponManagement.css:371 | 表格按钮(430px) | 30px | ___px | ⬜ |
| T52 | UserManagement.css:163 | 筛选按钮(430px) | 38px | ___px | ⬜ |

### 6.2 商城辅助页面触摸目标验证

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T53 | PetGallery.css:385 | 删除/相机按钮 | 30px | ___px | ⬜ |
| T54 | PetFinder.css:657 | 商品卡片按钮(430px) | 30px | ___px | ⬜ |
| T55 | CouponCenter.css:289 | Hero计划按钮 | 32px | ___px | ⬜ |
| T56 | Register.css:405 | 验证码按钮 | 32px | ___px | ⬜ |
| T57 | Notifications.css:677 | 列表操作按钮 | 36px | ___px | ⬜ |
| T58 | Wishlist.css:925 | 信息药丸 | 26px | ___px | ⬜ |
| T59 | ProductCompare.css:885 | 表格按钮(430px) | 32px | ___px | ⬜ |

### 6.3 新增字号验证

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T60 | AdminDashboard.css:87 | 统计文字 | 11px | ___px | ⬜ |
| T61 | BrowsingHistory.css:1350 | 空状态标签 | 10px | ___px | ⬜ |
| T62 | PetGallery.css:884 | 统计标题(430px) | 10px | ___px | ⬜ |
| T63 | ProductCompare.css:896 | 表格标签(430px) | 10px | ___px | ⬜ |
| T64 | Notifications.css:659 | 列表标签 | 10.5px | ___px | ⬜ |

### 6.4 新增对比度验证

| # | 文件:行号 | 元素 | 修复前 | 修复后 | 状态 |
|---|----------|------|--------|--------|------|
| T65 | CouponCenter.css:149 | 静音徽章文字 | 3.4:1 | ___:1 | ⬜ |
| T66 | CouponCenter.css:155 | 静音徽章图标 | 2.6:1 | ___:1 | ⬜ |
| T67 | ProductCompare.css:329 | 缺失规格值 | 3.5:1 | ___:1 | ⬜ |
| T68 | mobile-page-contrast.css:218 | 链接文字颜色 | 不可区分 | 可区分? | ⬜ |

### 6.5 全局文件验证

| # | 文件:行号 | 问题 | 验证方法 | 状态 |
|---|----------|------|---------|------|
| T69 | App.css:3037-3116 | 客服按钮矛盾规则 | 移动端检查客服按钮可见性是否正确 | ⬜ |
| T70 | App.css:2143 | 输入框16px仅780px | 780-800px平板检查输入框无缩放 | ⬜ |
| T71 | index.css:232 | 全局按钮34px | 检查无页面级覆盖的按钮是否≥44px | ⬜ |
| T72 | SkeletonLoader.css:29 | shimmer性能 | 360px设备检查骨架屏渲染流畅度 | ⬜ |

---

## 七、测试执行记录
| # | 测试项 | 预期 | 实际 | 严重程度 |
|---|--------|------|------|---------|
| | | | | |

### 新发现问题
| # | 描述 | 位置 | 严重程度 |
|---|------|------|---------|
| | | | |

## 2026-06-06 01:52 UTC Added Regression Scope

No Android device/WebView run, screenshot, Playwright check, build, APK publish, or service restart was performed in this source-only pass.

| Scope | Priority | Required check | Expected result |
|---|---|---|---|
| Cart suggested/add-on add-to-cart | P1 | In App/WebView cart, add a valid suggested/add-on product as guest and authenticated user; if possible mock an invalid/non-numeric product id. | Valid product is added and selected; invalid id shows add failure and no malformed cart row appears. |
| Legacy guest cart localStorage migration | P1 | Seed `shop-guest-cart` with rows containing nested `product` metadata, then open Cart, Checkout, and CartDrawer. | Product title/image/price render from migrated metadata, storage rewrites flat rows, and no blank title appears. |
| Profile missing translation fallback | P2 | Spot-check Profile with incomplete locale fixture if available. | No raw dotted translation key appears; old Profile fallback report stays archived unless current rendered evidence fails. |
