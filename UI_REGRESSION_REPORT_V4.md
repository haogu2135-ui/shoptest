# UI 回归测试报告（第四轮）

**测试时间**: 2026-05-29（第四轮，BUG-02/03/04 降级 UI 修复后）
**截图目录**: `/root/shoptest/ui-screenshots-v4/`
**测试页面**: 10 个核心页面 × 3 视口（桌面 1920 / 平板 768 / 移动 375）= 30 张

---

## 遗留 BUG 回归结论

### BUG-02 ✅ Pet Finder — 推荐加载失败降级处理
**结论**: 已修复
**截图**: `06-pet-finder-desktop.png`、`06-pet-finder-mobile.png`

- 页面现在显示 **4 个推荐商品**（使用本地目录快照兜底）
- 顶部出现蓝色 info 条 "Showing saved catalog picks while live recommendations reconnect."，语气友好，非错误警告
- 导航栏无遮挡，推荐区域正常展示商品卡片、价格、库存标签
- "Match summary" 统计卡（找到4个、价位4个、顶选4个）正常渲染
- "Turn the match into a cart decision" CTA 区域正常显示

### BUG-03 ✅ Pet Gallery — 图库加载失败降级处理
**结论**: 已修复
**截图**: `07-pet-gallery-desktop.png`、`07-pet-gallery-mobile.png`

- 顶部导航无遮挡
- 展示蓝色 info 条 "Showing curated community moments while the live pet gallery reconnects."，非错误警告
- 图片内容（6张宠物图）正常显示，页面完全可浏览
- "Gallery momentum" 统计数据（177、0、3）正常渲染

### BUG-04 ✅ Coupons — 优惠券加载失败降级处理
**结论**: 已修复
**截图**: `08-coupons-desktop.png`、`08-coupons-mobile.png`

- 顶部蓝色 info 条 "Showing curated savings while live coupons reconnect. Log in and checkout discounts will use the live coupon service when it is available." 语气友好，非错误警告
- 页面完整展示：预览券（标有 "Preview" 标签）、省钱路径、门槛差额、即将到期等信息
- 3张预览优惠券卡片正常显示（折扣金额、门槛、有效期、"Preview" 标签清晰）
- "My coupons" 区域正常显示空状态

---

## 全页面新问题扫描

### NEW-02 🟠 [Pet Finder 平板] "NEXT BEST ACTION" 标题折行过碎
**影响视口**: 平板（768px）
**截图**: `06-pet-finder-tablet.png`

**现象**:
"NEXT BEST ACTION" 区块中的行动标题 **"Turn the match"** 在 768px 宽度下被强制折行，分成 3 行显示：
```
Turn
the
match
```
同区块内 "DECISION" 正文内容（筛选条件列表）也折行极碎，每行只显示 1-2 个词，可读性很差。

**根因推测**: 该卡片采用固定窄列布局（或 `word-break: break-all`），在平板宽度下左侧标签列过宽，导致右侧内容列宽不足。

**建议**: 在 `768px` 断点下调整该卡片为单列全宽布局，或增大容器宽度。

---

### NEW-03 🟡 [Products 页面] 面包屑显示 "Catalog Title" 占位文本
**影响视口**: 桌面、平板
**截图**: `02-products-desktop.png`、`02-products-tablet.png`

**现象**:
商品列表页面包屑区域（页面左上角 "BEDS & FURNITURE > **Catalog Title**"）显示的是占位文本 "Catalog Title"，而非实际分类名称。在用户实际浏览时这会造成困惑。

**建议**: 确认分类名称字段是否正确从 API 响应中读取并赋值，检查相关状态是否在初始加载时未能正确回填。

---

### NEW-04 🟡 [Coupons 平板] 优惠券卡片文字折行拥挤
**影响视口**: 平板（768px）
**截图**: `08-coupons-tablet.png`

**现象**:
平板宽度下优惠券卡片内的折扣标题（如 "90% off, max $1.32"、"/ Discount amount $0.66"、"/ Discount amount $0.33"）在卡片内换行，导致价格信息被分割为多行，可读性下降。同时"Minimum spend $4.35"等内容也发生不必要换行。

**建议**: 平板端优惠券卡片改为单列全宽布局（现为多列），或增大卡片最小宽度避免文字折断。

---

### NEW-05 🟡 [Products 移动端] 商品卡片价格与原价折行
**影响视口**: 移动端（375px）
**截图**: `02-products-mobile.png`

**现象**:
商品列表卡片中现价（如 `$6.73`）与划线原价（如 `$8.71`）在移动端卡片宽度下换行至两行显示，价格区域高度增加，整体卡片高度不一致，列表对齐感较差。

**建议**: 价格区域使用 `white-space: nowrap` 或 `flex-wrap: nowrap`，确保现价与原价在同一行显示。

---

### NEW-06 🟢 [Home 移动端] "Pick up where you left off" 区块间距偏大
**影响视口**: 移动端（375px）
**截图**: `01-home-mobile.png`

**现象**:
首页 "Picked for your pet" 推荐区块下方紧接 "Pick up where you left off" 区块，但两个区块之间存在约 40px 多余间距，在移动端有明显的视觉断层感。与桌面版对比，移动端该间距明显偏大。

---

## 本轮统计

| 状态 | 数量 | BUG 编号 |
|------|------|---------|
| ✅ 本轮新确认修复 | 3 | BUG-02, BUG-03, BUG-04 |
| 🆕 本轮新发现问题 | 4 | NEW-02, NEW-03, NEW-04, NEW-05, NEW-06（含1个低优先级） |

---

## 累计最终状态（所有轮次）

| 状态 | 数量 | BUG 编号 |
|------|------|---------|
| ✅ 完全修复 | 15 | BUG-01~15 全部 |
| 🆕 新增待修问题 | 5 | NEW-02（🟠）, NEW-03（🟡）, NEW-04（🟡）, NEW-05（🟡）, NEW-06（🟢） |

---

## 新问题优先级排序

| 优先级 | 编号 | 描述 | 视口 |
|--------|------|------|------|
| 🟠 高 | NEW-02 | Pet Finder 平板端 "Turn the match" 标题折行极碎 | 平板 768px |
| 🟡 中 | NEW-03 | Products 页面包屑显示 "Catalog Title" 占位文本 | 桌面/平板 |
| 🟡 中 | NEW-04 | Coupons 平板端优惠券卡片折扣文字折行 | 平板 768px |
| 🟡 中 | NEW-05 | Products 移动端价格/原价换行导致卡片高度不一 | 移动 375px |
| 🟢 低 | NEW-06 | Home 移动端区块间距偏大 | 移动 375px |

---

## 开发跟进（2026-05-29 22:45 UTC）

### 已处理

- NEW-02: Pet Finder 平板端 CTA 区域改为更宽的单列呈现，避免 "Turn the match" 和决策文本过碎折行。
- NEW-03: Products 页面面包屑/标题不再显示 "Catalog Title" 占位符，改为按搜索词、分类、集合或折扣上下文生成实际标题。
- NEW-04: Coupons 平板端优惠券卡片改为单列宽卡片，并限制金额文本不必要折行。
- NEW-05: Products 移动端价格行改为不换行，避免现价和划线原价分成两行。
- NEW-06: Home 移动端推荐区与最近浏览区间距已收紧。
- F93: 客服 WebSocket 改为 token-free URL + `support.v1` / `auth.<base64url-token>` 子协议认证，前后台已对齐，并保留旧 query token 兼容。
- F94: 401/session cleanup 清理范围扩展到 `userId`、`username`、`role`、`adminDefaultPath` 等身份和后台路由键。
- F95: IP 黑名单默认显示全部记录，空列表状态下保留手动拉黑、筛选重置和清晰提示，状态/来源筛选已本地化。
- F96: 后台评价管理接口契约已统一为分页对象，后端支持状态/关键词筛选，前端使用服务端分页并兼容旧数组响应，避免有评价数据却显示空表。

### 说明

- 按用户要求，本次只做代码修改和问题文件更新，未提交代码，未运行测试/构建/截图回归。

---

*第四轮截图存放于 `/root/shoptest/ui-screenshots-v4/`*
*历史对照：v1=`ui-screenshots/` v2=`ui-screenshots-v2/` v3=`ui-screenshots-v3/`*
