# ShopMX UI/UX 审计报告

审计日期: 2026-05-31 | 审计师: AI 测试工程师

---

## 摘要

| 指标 | 数值 |
|------|------|
| 总问题数 | 25 |
| High | 5 |
| Medium | 16 |
| Low | 4 |

### 主要问题类别
- **可访问性**: 8 个问题 (ARIA 标签、键盘导航、对比度、焦点管理)
- **响应式设计**: 4 个问题 (移动端布局冲突、表格处理)
- **视觉一致性**: 3 个问题 (内联样式、颜色硬编码)
- **交互反馈**: 5 个问题 (加载状态不统一、表单验证时机)
- **表单体验**: 4 个问题 (必填标识、自动填充、禁用状态)
- **导航**: 3 个问题 (面包屑、Tab URL 同步)

---

## High 严重度问题 (5个)

### UI-001: 错误状态展示方式不统一
- **页面**: Home, Cart, ProductDetail, Checkout
- **描述**: 四种页面采用四种不同的错误状态模式 (Alert/Empty/Spin/内联)
- **建议**: 创建全局 `PageError` 和 `PageEmpty` 复用组件

### UI-002: 表格在小屏幕无水平滚动提示
- **页面**: Cart, AdminDashboard
- **描述**: 表格在移动端压缩变窄，用户无法直观感知可横向滚动
- **建议**: 增加 CSS 渐变溢出指示器或自动切换为卡片视图

### UI-004: ARIA 标签覆盖不完整
- **页面**: Login, Register, Profile
- **描述**: 表单输入框缺少 `aria-label` 或 `<label>` 关联
- **建议**: 为所有 Form.Item 增加 `htmlFor` 关联

### UI-010: 颜色对比度不足
- **页面**: Home, ProductDetail, Cart
- **描述**: `type="secondary"` 文字对比度约 3.9:1，低于 WCAG AA 标准 4.5:1
- **建议**: 调整颜色为 `rgba(0,0,0,0.55)` 或更深

### UI-013: 缺少 Skip to Content 跳过链接
- **页面**: 全局
- **描述**: 键盘用户每次页面加载都需要 Tab 过整个导航栏
- **建议**: 添加隐藏的 "Skip to main content" 链接

### UI-017: 移动端底部导航栏与页面操作栏冲突
- **页面**: ProductDetail, Checkout
- **描述**: Navbar 底部栏与页面购买/支付栏相互遮挡
- **建议**: 在显示页面操作栏时隐藏导航底部栏

### UI-025: 模态框缺少 Focus Trap
- **页面**: ProductDetail, Profile, Checkout
- **描述**: 模态框打开时焦点可能不在第一个可交互元素
- **建议**: 使用 `autoFocus` prop 确保焦点正确设置

---

## Medium 严重度问题 (16个)

### UI-003: 内联样式破坏设计系统一致性
- **页面**: Home, Cart, ProductDetail, AdminDashboard
- **描述**: 多处使用 `style={{}}` 硬编码颜色和间距
- **建议**: 定义 CSS 变量，提取内联样式为 CSS class

### UI-005: 密码字段缺少可访问性支持
- **页面**: Login, Register, Profile
- **描述**: 密码切换按钮缺少 `aria-label`
- **建议**: 自定义 `iconRender` 添加 `aria-label` 和 `aria-pressed`

### UI-006: 购物车移动端列表缺少语义标注
- **页面**: Cart
- **描述**: 移动端卡片列表缺乏 `role="list"` / `role="listitem"`
- **建议**: 添加语义化 role 属性

### UI-007: 加载状态不统一
- **页面**: 全局
- **描述**: 混合使用 Skeleton、Spin、纯文字加载状态
- **建议**: 统一使用骨架屏方案

### UI-008: 面包屑导航不完整
- **页面**: ProductDetail, Cart, Checkout, Profile
- **描述**: 仅 ProductDetail 有面包屑，且缺少分类层级
- **建议**: 为核心页面添加面包屑

### UI-009: 表单实时验证不足
- **页面**: Checkout, Register
- **描述**: 验证仅在提交时触发，非实时反馈
- **建议**: 设置 `validateTrigger: ['onChange', 'onBlur']`

### UI-011: 移动端筛选功能缺少引导
- **页面**: ProductList
- **描述**: 侧边栏完全隐藏，缺少首次使用引导
- **建议**: 添加 Tooltip 引导和逐个清除筛选

### UI-012: 管理后台统计卡片溢出
- **页面**: AdminDashboard
- **描述**: 5 个卡片在 lg 断点下布局不对称
- **建议**: 重新分组或使用自适应布局

### UI-015: 订单表格缺少行选择可访问性
- **页面**: OrderManagement
- **描述**: 选中状态变化缺乏 `aria-live` 通知
- **建议**: 添加 `aria-live="polite"` 区域

### UI-016: 地区选择不支持自动填充
- **页面**: Checkout
- **描述**: Cascader 级联选择器无法被浏览器自动填充识别
- **建议**: 提供文本输入模式或记住上次选择

### UI-018: 空状态引导不足
- **页面**: Profile
- **描述**: 空订单状态仅显示简单 Empty 组件
- **建议**: 增加推荐商品和当前优惠信息

### UI-019: 表单必填标识不够醒目
- **页面**: Checkout, Register, Profile
- **描述**: 缺少视觉上的必填标识（红色星号）
- **建议**: 为 Form.Item 设置 `required` prop

### UI-020: 首页发现区域缺少键盘导航
- **页面**: Home
- **描述**: 无限滚动缺少屏幕阅读器加载通知
- **建议**: 添加 `aria-live="polite"` 加载状态通知

### UI-022: 禁用按钮缺少原因说明
- **页面**: Checkout, ProductDetail
- **描述**: 禁用原因没有通过 Tooltip 告知用户
- **建议**: 为禁用按钮添加 Tooltip 说明

### UI-023: 图片轮播缺少无障碍控制
- **页面**: ProductDetail
- **描述**: 自动播放缺少暂停控制，键盘用户无法切换
- **建议**: 添加暂停按钮和键盘导航支持

---

## Low 严重度问题 (4个)

### UI-014: 产品详情 Tab 缺少 URL 同步
- **页面**: ProductDetail
- **描述**: Tab 切换不更新 URL，刷新后丢失状态
- **建议**: 使用 `useSearchParams` 同步 tab 参数

### UI-021: 价格显示颜色不一致
- **页面**: 全局
- **描述**: 前台使用 CSS class，后台使用内联样式
- **建议**: 统一使用 `commerce-money` CSS class

### UI-024: Profile Tab 缺少 URL 同步
- **页面**: Profile
- **描述**: Tab 切换不更新 URL
- **建议**: 在 onChange 中使用 `setSearchParams`

---

## 修复优先级建议

### P0 - 立即修复 (影响核心功能)
1. UI-017: 移动端底部栏冲突 (影响购买流程)
2. UI-001: 错误状态不统一 (影响用户体验)
3. UI-002: 表格滚动提示 (影响管理效率)

### P1 - 尽快修复 (影响可访问性)
4. UI-013: Skip to Content (键盘用户无法高效导航)
5. UI-004: ARIA 标签 (屏幕阅读器用户)
6. UI-010: 颜色对比度 (低视力用户)
7. UI-025: Focus Trap (键盘用户)

### P2 - 计划修复 (提升体验)
8. UI-007: 加载状态统一
9. UI-008: 面包屑导航
10. UI-009: 表单实时验证
11. UI-019: 必填标识

### P3 - 优化项
12. UI-003: 内联样式清理
13. UI-014/UI-024: Tab URL 同步
14. UI-021: 价格颜色统一
