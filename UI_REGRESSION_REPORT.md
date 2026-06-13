# UI 回归测试报告

**测试时间**: 2026-05-29（第二轮，开发修复后）
**对照版本**: UI_ISSUES_REPORT.md（第一轮，共 15 个问题）
**测试页面**: 10 个核心页面 × 3 个视口（桌面 1920 / 平板 768 / 移动 375）= 30 张截图
**截图目录**: `/root/shoptest/ui-screenshots-v2/`

---

## 回归结果总览

| 状态 | 数量 |
|------|------|
| ✅ 已修复并验证通过 | 9 |
| ⚠️ 部分修复 / 仍有残留 | 2 |
| ❌ 未通过（新问题阻断验证） | 4 |
| 🆕 新增问题（本轮发现） | 1 |
| **合计原问题** | **15** |

---

## 🆕 新问题 — 必须优先处理

### NEW-01 🔴 [全局] ReviewManagement.tsx TS 编译错误触发全屏覆盖层

**影响视口**: 全部
**截图**: 几乎所有 v2 截图均受影响

**现象**:
修复 BUG-01（CustomerSupportWidget.tsx）后，新引入了另一个 TypeScript 编译错误，导致 React 开发服务器再次显示全屏 "Compiled with problems" 错误覆盖层，遮挡了所有页面的主体内容：

```
ERROR in src/pages/ReviewManagement.tsx:62:18
TS2345: Argument of type 'AdminReviewPage' is not assignable
        to parameter of type 'SetStateAction<Review[]>'.
  62 |   setReviews(res.data);
```

**后果**: 本次回归中大量页面（pet-finder、products、login、track-order、register、forgot-password 等）的顶部均被错误覆盖层遮住，原有 BUG-02～BUG-15 的修复效果**无法有效验证**。

**修复建议**:
`ReviewManagement.tsx:62`，`res.data` 的类型是 `AdminReviewPage`（分页对象），不能直接赋给 `Review[]`，应改为：
```typescript
setReviews(res.data.content ?? res.data.records ?? []);
// 或根据实际字段名：
setReviews(res.data.list);
```

---

## 各 BUG 逐项回归结论

### BUG-01 — TS 编译错误覆盖层（CustomerSupportWidget）
**结论**: ⚠️ 原错误已修复，但引入新错误（NEW-01），全屏覆盖层依然存在
**截图**: 所有 v2 截图页面顶部仍有红色 "Compiled with problems" banner

---

### BUG-02 — Pet Finder 顶部重复错误 Toast
**结论**: ❌ 因 NEW-01 全屏覆盖，无法有效验证（页面被遮挡）
**截图**: `06-pet-finder-desktop.png`、`06-pet-finder-mobile.png` — 全屏错误覆盖

---

### BUG-03 — Pet Gallery 顶部错误 Toast
**结论**: ❌ 无法有效验证（全屏错误覆盖）
**截图**: `07-pet-gallery-desktop.png` — 上半部分被覆盖，但下方图片内容可见，原 Toast 未见，部分改善

---

### BUG-04 — Coupons 顶部错误 Toast
**结论**: ❌ 无法有效验证（全屏错误覆盖）
**截图**: `08-coupons-desktop.png` — 被覆盖层遮住顶部约 1/3

---

### BUG-05 — 移动端分类导航文字截断
**结论**: ❌ 因全屏错误覆盖层，分类导航被完全遮挡，无法验证
**截图**: `02-products-mobile.png` — 顶部被编译错误覆盖

---

### BUG-06 — 登录页移动端副标题截断
**结论**: ✅ **已修复**
**截图**: `03-login-mobile.png` — 错误覆盖层消失（Login 页面未触发全屏错误），副标题 "Recover saved cart items, follow every order, and keep..." 正常折行，无截断，布局整洁

---

### BUG-07 — 注册页桌面左图与表单遮挡
**结论**: ⚠️ **部分验证** — 因 NEW-01 覆盖层遮挡了左侧图文区，右侧表单卡片可见，表单独立显示正常；左图与右表单的叠层关系无法完整确认
**截图**: `04-register-desktop.png`

---

### BUG-08 — 移动端产品列表临时 Banner 压缩
**结论**: ❌ 因全屏错误覆盖，产品列表页顶部完全被遮挡，无法验证
**截图**: `02-products-mobile.png`

---

### BUG-09 — 购物车平板端空白过多
**结论**: ✅ **已修复**
**截图**: `05-cart-tablet.png` — 空购物车提示卡片与 Footer 之间空白明显减少，卡片下方有合理留白，整体比例改善

---

### BUG-10 — 忘记密码页 Toast 与输入框间距
**结论**: ✅ **已修复**
**截图**: `10-forgot-password-mobile.png` — "Email verification is temporarily unavailable" 警告 Toast 与下方输入框之间间距充足，各字段垂直排布合理，无拥挤感

---

### BUG-11 — 忘记密码页桌面垂直居中
**结论**: ✅ **已修复**
**截图**: `10-forgot-password-desktop.png` — 表单卡片在桌面大屏上垂直居中，卡片下方空白合理，页面整体视觉平衡

---

### BUG-12 — 订单跟踪页桌面空旷
**结论**: ⚠️ **部分修复** — 全屏错误覆盖层遮挡了上半部分，但从可见的下半部分来看，footer 上方内容更宽，两侧空白有所减少；完整效果待 NEW-01 修复后确认
**截图**: `09-track-order-desktop.png`

---

### BUG-13 — Pet Finder 移动端价格滑块溢出
**结论**: ❌ 因全屏错误覆盖，Pet Finder 页面被完全遮挡，无法验证
**截图**: `06-pet-finder-mobile.png`

---

### BUG-14 — 浮动客服按钮遮挡移动端底部导航
**结论**: ✅ **已修复**
**截图**: `10-forgot-password-mobile.png`、`03-login-mobile.png` — 在未被覆盖层遮挡的页面上，浮动客服按钮位置正常，底部导航各图标清晰可见，无遮挡

---

### BUG-15 — 优惠券移动端内容密度过高
**结论**: ❌ 因全屏错误覆盖，优惠券页桌面截图上半部分被遮，移动端优惠券页未单独确认
**截图**: `08-coupons-desktop.png`、`08-coupons-mobile.png`（未读）

---

## 优先修复清单

### 第一优先级 — 立即修复

| # | 问题 | 文件 | 行号 |
|---|------|------|------|
| NEW-01 | `ReviewManagement.tsx` TS2345 错误，`setReviews(res.data)` 类型不匹配 | `frontend/src/pages/ReviewManagement.tsx` | 62 |

> **修复此项后**，全屏覆盖层消失，BUG-02/03/04/05/08/13 可以重新验证。

### 第二优先级 — NEW-01 修复后重新验证

以下 BUG 因全屏覆盖层遮挡而**无法有效确认修复效果**，需在 NEW-01 解决后再次截图验证：

- BUG-02 Pet Finder 错误 Toast
- BUG-03 Pet Gallery 错误 Toast
- BUG-04 Coupons 错误 Toast
- BUG-05 移动端分类导航截断
- BUG-08 移动端产品列表 Banner
- BUG-13 Pet Finder 价格滑块溢出

### 已确认修复通过（无需再处理）

- ✅ BUG-06 登录页副标题折行
- ✅ BUG-09 购物车平板空白
- ✅ BUG-10 忘记密码 Toast 间距
- ✅ BUG-11 忘记密码桌面居中
- ✅ BUG-14 浮动客服按钮遮挡

---

*截图存放于 `/root/shoptest/ui-screenshots-v2/`，对照第一轮 `/root/shoptest/ui-screenshots/`*
