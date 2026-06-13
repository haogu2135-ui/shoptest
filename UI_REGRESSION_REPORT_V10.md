# UI 回归测试报告（第十轮）

**测试时间**: 2026-05-30（第十轮）
**重要变化**: 本轮首次从新项目路径 `/home/guhao/shoptest/frontend` 启动前端服务，之前 v1~v9 均使用旧路径 `/root/shoptest/frontend`
**截图目录**: `/home/guhao/shoptest/ui-screenshots-v10/`
**测试页面**: 10 个核心页面 × 3 视口（桌面 1920 / 平板 768 / 移动 375）= 30 张

---

## 开发处理记录（2026-05-30 02:01 UTC）

**处理状态**: NEW-22~NEW-25 已做代码级修复，待下一轮截图回归确认。未提交代码，未运行前端 build 或自动化 UI 测试；仅执行 `git diff --check` 静态空白检查，并观察当前已有 dev server 自动编译结果。

| 编号 | 处理结果 |
|------|----------|
| NEW-22 | 已精简 Pet Finder 下一步说明文案，英语从长句改为紧凑的 `Top fit` / `Review this first` 表达，中文/西语同步缩短；移动端 `NEXT BEST ACTION` 说明字号与行高收紧到 13px/1.35，减少 375px 下的三行拥挤。 |
| NEW-23 | 已将英文 Coupons `Savings path` 标题从 `Turn the coupon into an order` 改为 `Use this coupon`，中文改为 `使用这张优惠券`；移动端标题字号降至 15px 并保持单行，西语原文 `Del cupón al pedido` 已足够短。 |
| NEW-24 | 已在 641~1024px 平板断点把空购物车快捷操作网格统一为 `gap: 12px`，四个按钮的水平/垂直间距保持一致。 |
| NEW-25 | 已取消 Login 移动端卡片副标题和 hero 副标题的 line-clamp/ellipsis 限制，允许自然换行，避免 `...and keep...` 被省略号截断。 |
| 前端告警 | 顺手清理 `ProductList.tsx` 的 hook dependency warning；当前 `/tmp/frontend-new.log` 最新状态为 `Compiled successfully!`。 |

**验证限制**: 未跑截图脚本或 Playwright，以上为代码修复和已有 dev server 自动编译观察结果，仍需测试工程师下一轮基于 375px/768px 截图确认。

---

## 遗留问题回归结论

### NEW-17 ✅ Products 面包屑 "Catalog Title" 占位文本
**结论**: 已修复（新目录代码生效）
**截图**: `02-products-desktop.png`、`02-products-mobile.png`

- 桌面端面包屑现在显示 **"BEDS & FURNITURE > Pet supplies"**，不再是占位符
- 移动端同样正常显示 "Pet supplies"
- 此问题在切换到 `/home/guhao/shoptest` 后立即消失，确认之前问题是旧目录代码未更新所致

---

### NEW-21 ✅ webpack Html Webpack Plugin 构建错误（v9 P0问题）
**结论**: 已解决（新目录无此问题）
**截图**: 所有 v10 截图正常显示页面内容，无错误文字覆盖

---

### NEW-18 ✅ Home 桌面 Hero CTA 按钮文字截断（新目录确认）
**结论**: 已修复并确认
**截图**: `01-home-desktop.png`
- Hero 区 "Shop now" 等 CTA 按钮文字完整显示，无截断

---

### NEW-19 ✅ Pet Gallery 上传按钮与配额提示间距（新目录确认）
**结论**: 已修复并确认
**截图**: `07-pet-gallery-desktop.png`
- "Upload photo" 按钮与左侧配额信息间距合理，无视觉粘连

---

### NEW-20 ✅ Coupons 移动端进度条标签折行（新目录确认）
**结论**: 已修复并确认
**截图**: `08-coupons-mobile.png`
- "Savings path" 进度条两端标签单行显示，无折行

---

## 全页面新问题扫描

### NEW-22 🟡 [Pet Finder 移动端] "NEXT BEST ACTION" 说明文字折行过多
**影响视口**: 移动端（375px）
**截图**: `06-pet-finder-mobile.png`

**现象**:
"NEXT BEST ACTION" 区块下方的决策说明文字（"PawPilot found the 4 best fit. 4 fits the strongest fit right now."）在 375px 宽度下折为 3 行，内容拥挤。虽然可读，但与上方商品卡片区域相比视觉密度偏高。

**建议**: 精简说明文字长度，或在移动端缩小字号至 13px。

---

### NEW-23 🟡 [Coupons 移动端] "Turn the coupon into an order" 标题折为两行
**影响视口**: 移动端（375px）
**截图**: `08-coupons-mobile.png`

**现象**:
"Turn the coupon into an order" 标题在移动端 375px 宽度下折为两行（"Turn the coupon into" / "an order"），与其他区块标题单行显示风格不一致，视觉上偏重。

**建议**: 缩短标题文案（如改为 "Use this coupon"），或调整字号至 15px 以内。

---

### NEW-24 🟢 [Cart 平板] 空购物车快捷操作按钮间距不均
**影响视口**: 平板（768px）
**截图**: `05-cart-tablet.png`

**现象**:
空购物车页面中 "Browse products"、"Coupons"、"Pet finder"、"History" 四个快捷操作按钮在平板端以 2×2 网格排列，但各按钮之间水平和垂直间距不一致，右侧按钮（"Coupons"、"History"）与左侧按钮的间距明显小于上下间距，视觉上不够均匀。

**建议**: 使用 `gap: 12px` 统一网格间距。

---

### NEW-25 🟢 [Login 移动端] 副标题 "...and keep..." 被省略号截断
**影响视口**: 移动端（375px）
**截图**: `03-login-mobile.png`

**现象**:
登录卡片副标题 "Recover saved cart items, follow every order, and keep..." 末尾仍有省略号，文案最后一个词被截断。虽然整体已比早期版本改善，但省略号依然存在，说明文本容器高度限制未完全放开。

**建议**: 将副标题文本容器的 `overflow` 或 `-webkit-line-clamp` 设置为允许3行以上，或直接缩短文案。

---

## 本轮统计

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 本轮确认修复 | 5 | NEW-17, NEW-18, NEW-19, NEW-20, NEW-21 |
| 🆕 本轮新发现 | 4 | NEW-22（🟡）, NEW-23（🟡）, NEW-24（🟢）, NEW-25（🟢） |

---

## 累计全轮次状态

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 完全修复 | 34 | BUG-01~15, NEW-02, NEW-04~06, NEW-08~10, NEW-12~13, NEW-15~21 |
| ❌ 持续未修复 | 0 | 无 |
| 🆕 新增待修 | 4 | NEW-22（🟡）, NEW-23（🟡）, NEW-24（🟢）, NEW-25（🟢） |

---

## 待修问题优先级

| 优先级 | 编号 | 描述 | 视口 |
|--------|------|------|------|
| 🟡 中 | NEW-22 | Pet Finder 移动端决策说明文字折行过多 | 移动 375px |
| 🟡 中 | NEW-23 | Coupons 移动端 "Turn the coupon..." 标题折为两行 | 移动 375px |
| 🟢 低 | NEW-24 | Cart 平板空购物车快捷按钮间距不均 | 平板 768px |
| 🟢 低 | NEW-25 | Login 移动端副标题末尾被省略号截断 | 移动 375px |

---

*第十轮截图存放于 `/home/guhao/shoptest/ui-screenshots-v10/`*
*注：本轮起测试基准切换为 `/home/guhao/shoptest/frontend`（新项目路径）*
