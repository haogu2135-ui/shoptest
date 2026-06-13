# UI 回归测试报告（第六轮）

**测试时间**: 2026-05-29（第六轮，NEW-08/09/10 修复后）
**截图目录**: `/root/shoptest/ui-screenshots-v6/`
**测试页面**: 10 个核心页面 × 3 视口（桌面 1920 / 平板 768 / 移动 375）= 30 张

---

## 遗留问题回归结论

### NEW-03/07 ❌ Products 面包屑 "Catalog Title" 占位文本
**结论**: 仍未修复，连续两轮未解决
**截图**: `02-products-desktop.png`、`02-products-mobile.png`、`02-products-tablet.png`

- 三个视口下面包屑区域均显示 **"BEDS & FURNITURE > Catalog Title"**
- 开发记录两次标注已处理，但实际截图确认均未生效
- 需要开发团队重新定位根因：检查面包屑组件读取分类名称的数据来源，确认 API 响应字段名与前端读取字段名是否一致

---

### NEW-08 ✅ Coupons 移动端 "Preview" 标签与折扣标签重叠
**结论**: 已修复
**截图**: `08-coupons-mobile.png`

- "Preview" 标签与折扣类型标签（"Smart Care Upgrade"、"Fixed Discount" 等）之间间距正常
- 两个标签区域无重叠，布局清晰

---

### NEW-09 ✅ Coupons 平板/移动端 "Log in" 按钮视觉过重
**结论**: 已修复
**截图**: `08-coupons-tablet.png`、`08-coupons-mobile.png`

- 优惠券卡片底部 "Log in" 按钮改为次要样式（outlined），不再是大橙色实心按钮
- 三张卡片连续排列时视觉重量合理，不再抢夺注意力

---

### NEW-10 ✅ Login 移动端表单下方大面积空白
**结论**: 已修复
**截图**: `03-login-mobile.png`

- 登录表单卡片下方空白明显减少，页面底部留白合理
- 整体垂直布局平衡

---

## 全页面新问题扫描

### NEW-11 🟠 [Products 全视口] 面包屑 "Catalog Title" 持续未修复（第三轮未解决）
与 NEW-03/07 相同，已连续三轮出现，升级优先级。

**建议排查路径**:
1. 检查 `frontend/src/components/Breadcrumb.tsx`（或类似组件）中读取分类名称的字段
2. 对比 `/api/products` 或 `/api/categories` 响应中实际返回的字段名（`name`、`title`、`label`？）
3. 确认是否存在 i18n key 未配置导致回退到 key 字符串 "Catalog Title"

---

### NEW-12 🟡 [Pet Finder 移动端] "Match summary" 统计卡数字与标签折行
**影响视口**: 移动端（375px）
**截图**: `06-pet-finder-mobile.png`

**现象**:
"Match summary" 区块中的三个统计卡（"4 found"、"4 in budget"、"4 top picks"）在 375px 宽度下，数字与标签文字折行，每个卡片内容分成两行显示，且三个卡片横向排列时宽度过窄，整体显得拥挤。

**建议**: 移动端改为 2×2 或单列布局，或减小字体使数字与标签保持同行。

---

### NEW-13 🟢 [Pet Gallery 桌面] 统计数字 "0" 异常
**影响视口**: 桌面（1920px）
**截图**: `07-pet-gallery-desktop.png`

**现象**:
"Gallery momentum" 统计区块中 "0 photos uploaded this week" 和 "0 community members active" 均显示为 0，而 "177 total community photos" 显示正常。这两个 0 值可能是后端接口未返回对应统计数据，或前端读取字段名有误。

**建议**: 确认后端 `/api/pet-gallery/stats` 接口是否返回 `weeklyUploads` 和 `activeMembers` 字段，前端读取字段名是否匹配。

---

## 本轮统计

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 本轮确认修复 | 3 | NEW-08, NEW-09, NEW-10 |
| ❌ 未修复（持续存在） | 1 | NEW-03/07/11 — Products 面包屑 "Catalog Title" |
| 🆕 本轮新发现 | 2 | NEW-12（🟡）, NEW-13（🟢） |

---

## 累计全轮次状态

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 完全修复 | 22 | BUG-01~15, NEW-02, NEW-04~06, NEW-08~10 |
| ❌ 持续未修复 | 1 | NEW-03/07/11 — Products 面包屑占位文本（已连续 3 轮） |
| 🆕 新增待修 | 2 | NEW-12（🟡）, NEW-13（🟢） |

---

## 待修问题优先级

| 优先级 | 编号 | 描述 | 视口 |
|--------|------|------|------|
| 🟠 高 | NEW-11 | Products 面包屑 "Catalog Title" 连续 3 轮未修复 | 全视口 |
| 🟡 中 | NEW-12 | Pet Finder 移动端 "Match summary" 统计卡折行拥挤 | 移动 375px |
| 🟢 低 | NEW-13 | Pet Gallery 统计数字 "0 photos this week / 0 active members" 疑似数据缺失 | 桌面 |

---

*第六轮截图存放于 `/root/shoptest/ui-screenshots-v6/`*
