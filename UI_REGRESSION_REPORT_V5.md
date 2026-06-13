# UI 回归测试报告（第五轮）

**测试时间**: 2026-05-29（第五轮，NEW-02~NEW-06 + F93/F94/F95 修复后）
**截图目录**: `/root/shoptest/ui-screenshots-v5/`
**测试页面**: 10 个核心页面 × 3 视口（桌面 1920 / 平板 768 / 移动 375）= 30 张

---

## 遗留问题回归结论

### NEW-02 ✅ Pet Finder 平板端标题折行过碎
**结论**: 已修复
**截图**: `06-pet-finder-tablet.png`

- "NEXT BEST ACTION" 区块标题 **"Turn the match into a cart decision"** 完整显示在一行
- 决策内容（筛选条件、价格范围、CTA 按钮）布局正常，无碎行

---

### NEW-03 ❌ Products 页面包屑显示 "Catalog Title" 占位文本
**结论**: 未修复，问题持续存在
**截图**: `02-products-desktop.png`、`02-products-mobile.png`、`02-products-tablet.png`

- 三个视口下面包屑均显示 **"BEDS & FURNITURE > Catalog Title"**
- "Catalog Title" 为明显占位文字，非实际分类/搜索上下文
- 开发记录显示已处理，但本轮截图确认**未生效**，需重新排查

---

### NEW-04 ✅ Coupons 平板端优惠券卡片折行拥挤
**结论**: 已修复
**截图**: `08-coupons-tablet.png`

- 优惠券卡片（"Smart Care Upgrade Deal"、"New Pet Parent Starter Perk"、"Weekend Walk & Play Bundle"）改为全宽单列卡片
- 折扣金额（"90% off, max $1.32"、"/ Discount amount $0.66" 等）在卡片宽度内正常显示，无不必要折行
- 门槛金额、有效期信息排布清晰

---

### NEW-05 ✅ Products 移动端价格/原价折行
**结论**: 已修复
**截图**: `02-products-mobile.png`

- 商品卡片现价与划线原价（如 `$6.73` / `$8.71`）在同一行显示，不再换行
- 各卡片高度一致，列表对齐感正常

---

### NEW-06 ✅ Home 移动端区块间距偏大
**结论**: 已修复
**截图**: `01-home-mobile.png`

- "Picked for your pet" 与下方区块之间间距收紧，视觉断层感消失
- 整体页面垂直节奏流畅

---

## 全页面新问题扫描

### NEW-07 🟠 [Products 全视口] 面包屑 "Catalog Title" 仍为占位文本（NEW-03 未修复）
与 NEW-03 相同，已在上方记录，升级为独立追踪。

---

### NEW-08 🟡 [Coupons 移动端] 优惠券卡片"Preview"标签与折扣标签重叠
**影响视口**: 移动端（375px）
**截图**: `08-coupons-mobile.png`

**现象**:
在移动端 375px 宽度下，优惠券卡片右上角的 "Preview" 标签与左侧的折扣类型标签（"Smart Care Upgrade"、"Fixed Discount" 等彩色 tag）在水平空间不足时发生重叠或紧贴，两个标签之间没有足够间距，视觉上粘连在一起。

**建议**: 将 "Preview" 标签移至标题下方独立行，或使用 `flex-wrap` 确保两个标签区域互不覆盖。

---

### NEW-09 🟡 [Coupons 平板/移动] 优惠券卡片内 "Log in" 按钮过于突出
**影响视口**: 平板（768px）、移动（375px）
**截图**: `08-coupons-tablet.png`、`08-coupons-mobile.png`

**现象**:
每张优惠券卡片底部都有一个大橙色 "Log in" 按钮，在平板端三张卡片连续排列时，页面中段出现三个等宽大橙色按钮连续堆叠，视觉重量极重，抢夺了对实际优惠券内容的注意力，与页面整体设计语言不协调。

**建议**: 将 "Log in" 操作改为次要样式（outlined 或 link button），或在已有全局登录入口的情况下改为提示文字。

---

### NEW-10 🟢 [Login 移动端] 登录表单下方大面积空白
**影响视口**: 移动（375px）
**截图**: `03-login-mobile.png`

**现象**:
登录表单卡片内容结束后（"Forgot password / Register" 链接之后），到页面底部 Footer 区域之间有约 300px 的空白区域，页面底部显得空旷。

**建议**: 使用 `min-height: calc(100vh - header - footer)` + flexbox 垂直居中，或在空白区增加辅助内容（如品牌特性说明）。

---

## 本轮统计

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 本轮确认修复 | 4 | NEW-02, NEW-04, NEW-05, NEW-06 |
| ❌ 未修复（持续存在） | 1 | NEW-03 / NEW-07（面包屑占位文本） |
| 🆕 本轮新发现 | 3 | NEW-08（🟡）, NEW-09（🟡）, NEW-10（🟢） |

---

## 累计全轮次状态

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 完全修复 | 19 | BUG-01~15, NEW-02, NEW-04, NEW-05, NEW-06 |
| ❌ 待修（未解决） | 1 | NEW-03/NEW-07 — Products 面包屑 "Catalog Title" |
| 🆕 新增待修 | 3 | NEW-08（🟡）, NEW-09（🟡）, NEW-10（🟢） |

---

## 新问题优先级排序

| 优先级 | 编号 | 描述 | 视口 |
|--------|------|------|------|
| 🟠 高 | NEW-03/07 | Products 面包屑持续显示 "Catalog Title" 占位文本 | 全视口 |
| 🟡 中 | NEW-08 | Coupons 移动端 "Preview" 标签与折扣标签重叠/紧贴 | 移动 375px |
| 🟡 中 | NEW-09 | Coupons 平板/移动端三个 "Log in" 大按钮连续堆叠 | 平板/移动 |
| 🟢 低 | NEW-10 | Login 移动端表单下方大面积空白 | 移动 375px |

---

*第五轮截图存放于 `/root/shoptest/ui-screenshots-v5/`*
*历史对照: v1~v4 见各对应 `ui-screenshots-vN/` 目录*
