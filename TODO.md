# DraMark 预览界面重构 TODO

## 项目结构变更

```
packages/app-core/
  components/           # 新增：共用 React 组件
    Preview.tsx
    ConfigPanel.tsx
    Preview.css
    index.ts
  render/               # 新增：渲染逻辑
    types.ts
    default-theme.ts
    tech-cue-colors.ts
    ast-to-blocks.ts
    css.ts
    index.ts
  index.ts              # 修改：导出新增模块

apps/web/src/           # 大幅简化
  main.tsx              # 重写：使用共用组件
  styles.css            # 清理

apps/vscode-extension/src/
  webview/
    index.tsx           # 新增：Webview React 入口
  preview-panel.ts      # 重写：启用脚本模式
  build.mjs             # 修改：增加 webview 打包
```

---

## 核心设计决策

| 决策 | 说明 |
|------|------|
| **共用 React 组件** | Web 和 VSCode 使用相同的 `<Preview />` 和 `<ConfigPanel />`，保证一致性 |
| **VSCode Webview 启用脚本** | `enableScripts: true`，加载 esbuild 打包的 React 应用 |
| **CSS Container Queries** | 响应式基于容器宽度，组件可嵌入任意布局 |
| **Tech cue 匹配首词** | 取 payload 第一个 token（忽略空白），匹配分类名或 entry id |
| **块级 tech cue 带标题** | `<<<SFX\n内容>>>` 渲染分类标题 "SFX" |
| **译配双栏 fallback** | 容器宽度 ≤600px 时自动切换单栏 |

---

## Phase 1: 规范更新（Tech 配置结构）

### 1.1 更新 JSON Schema
- **文件**: `packages/app-core/schemas/dramark-frontmatter.schema.json`
- **变更**: tech 下除 mics 外支持 `{color, entries}` 结构
- **Commit**: `feat(schema): tech categories support color + entries`

### 1.2 更新语言规范文档
- **文件**: `spec/spec.md`
- **变更**: 更新 §4 frontmatter 表格，说明 tech 分类结构
- **Commit**: `docs(spec): document tech category color structure`

### 1.3 更新 TypeScript 类型
- **文件**: `src/core/types.ts`
- **变更**: 修改 TechConfig 为动态分类结构
- **Commit**: `types(core): TechConfig with dynamic categories`

### 1.4 更新配置解析器
- **文件**: `src/core/config-normalizer.ts`
- **变更**: normalizeTech 处理新结构，保留 mics 特殊逻辑
- **Commit**: `feat(core): parse tech category color and entries`

### 1.5 导出新增类型
- **文件**: `src/core/index.ts`
- **变更**: 导出 TechCategory 等新类型
- **Commit**: `export(core): expose tech category types`

---

## Phase 2: 渲染层（packages/app-core/render/）

### 2.1 创建渲染类型定义
- **文件**: `packages/app-core/render/types.ts`
- **内容**: IR 类型、主题接口、开关配置、TechCueColorMap
- **Commit**: `feat(render): IR types and theme interfaces`

### 2.2 创建默认主题
- **文件**: `packages/app-core/render/default-theme.ts`
- **内容**: light + warm-dark 主题定义
- **Commit**: `feat(render): default light and warm-dark themes`

### 2.3 创建 tech cue 颜色匹配
- **文件**: `packages/app-core/render/tech-cue-colors.ts`
- **内容**: 匹配 payload 首词、颜色解析、自适应文字色
- **Commit**: `feat(render): tech cue color matching by first token`

### 2.4 创建 AST 转换器
- **文件**: `packages/app-core/render/ast-to-blocks.ts`
- **内容**: DraMark AST → RenderBlock[]，处理三栏分离
- **Commit**: `feat(render): AST to render blocks converter`

### 2.5 创建 CSS 生成器
- **文件**: `packages/app-core/render/css.ts`
- **内容**: 主题 + toggle → CSS 字符串
- **Commit**: `feat(render): CSS generator for themes and toggles`

### 2.6 创建渲染入口
- **文件**: `packages/app-core/render/index.ts`
- **内容**: 汇总导出
- **Commit**: `export(render): render module public API`

### 2.7 挂载到 app-core
- **文件**: `packages/app-core/index.ts`
- **变更**: 追加 render 导出
- **Commit**: `export(app-core): expose render module`

---

## Phase 3: 共用组件（packages/app-core/components/）

### 3.1 创建配置面板组件
- **文件**: `packages/app-core/components/ConfigPanel.tsx`
- **内容**: 悬浮球 + Radix Switch/RadioGroup
- **Commit**: `feat(components): floating config panel with Radix`

### 3.2 创建预览组件
- **文件**: `packages/app-core/components/Preview.tsx`
- **内容**: 主预览组件，响应式三栏布局
- **Commit**: `feat(components): main preview with three-column layout`

### 3.3 创建组件样式
- **文件**: `packages/app-core/components/Preview.css`
- **内容**: CSS Container Queries + 紧凑排版
- **Commit**: `style(components): container queries and compact design`

### 3.4 创建组件入口
- **文件**: `packages/app-core/components/index.ts`
- **内容**: 汇总导出
- **Commit**: `export(components): component library`

### 3.5 挂载到 app-core
- **文件**: `packages/app-core/index.ts`
- **变更**: 追加 components 导出
- **Commit**: `export(app-core): expose components`

### 3.6 添加 React 依赖
- **文件**: `packages/app-core/package.json`
- **内容**: 新增 React 和 Radix UI 依赖
- **Commit**: `deps(app-core): add React and Radix UI`

---

## Phase 4: Web 应用简化

### 4.1 重写主应用
- **文件**: `apps/web/src/main.tsx`
- **变更**: 简化，直接使用 `<Preview />` 组件
- **Commit**: `refactor(web): use shared Preview component`

### 4.2 清理旧样式
- **文件**: `apps/web/src/styles.css`
- **变更**: 删除旧样式（保留基础样式）
- **Commit**: `cleanup(web): remove old preview styles`

### 4.3 更新 Web 依赖
- **文件**: `apps/web/package.json`
- **变更**: 移除本地 React（使用 app-core 的）
- **Commit**: `deps(web): align with app-core`

---

## Phase 5: VSCode 扩展重构（重大变更）

### 5.1 创建 Webview React 入口
- **文件**: `apps/vscode-extension/src/webview/index.tsx`
- **内容**: VSCode Webview 的 React 应用入口
- **Commit**: `feat(vscode-webview): React entry point`

### 5.2 更新构建配置
- **文件**: `apps/vscode-extension/build.mjs`
- **变更**: 增加 webview 入口打包
- **Commit**: `build(vscode): bundle webview with esbuild`

### 5.3 重写预览面板
- **文件**: `apps/vscode-extension/src/preview-panel.ts`
- **变更**: 启用脚本，加载打包后的 webview.js，postMessage 通信
- **Commit**: `feat(vscode): enable scripts and load React bundle`

### 5.4 添加 React 依赖
- **文件**: `apps/vscode-extension/package.json`
- **内容**: 添加 React 用于 webview
- **Commit**: `deps(vscode): add React for webview`

---

## Phase 6: 验证

### 6.1 类型检查
- **命令**: `pnpm build`
- **Commit**: `build: pass typecheck`

### 6.2 运行测试
- **命令**: `pnpm test:run`
- **Commit**: `test: all tests pass`

### 6.3 Web 预览验证
- **命令**: `pnpm dev:web`
- **检查项**:
  - 三栏/两栏/单栏响应式切换
  - Tech cue 颜色匹配正确
  - 悬浮球配置面板工作正常
  - 译配单双栏切换

### 6.4 VSCode 预览验证
- **操作**: 在 VSCode 中运行扩展
- **检查项**:
  - Webview 正常加载 React
  - 与 Web 端外观一致
  - 配置开关可交互

---

## UI/UX 设计规范

### 布局结构

| 断点 | 布局 | 内容分布 |
|------|------|----------|
| **>960px 三栏** | 左-中-右 | 左栏=tech cue **blocks**；中栏=正文（角色-对白 + inline tech cues）；右栏=注释 |
| **>600px 两栏** | 左-右 | 左栏=正文（tech cue blocks 内嵌 + inline）；右栏=注释 |
| **≤600px 单栏** | 单栏 | 全部内嵌到正文流 |

### 配置面板（悬浮球）

| 设置 | 类型 | 选项 |
|------|------|------|
| Tech Cue 显示 | 开关 | on / off |
| 注释显示 | 开关 | on / off |
| 译配显示 | 单选 | 仅原文 / 仅译文 / 双语对照 |
| 译配排版 | 单选 | 单栏（上下堆叠）/ 双栏（左右对照） |
| 主题模式 | 单选 | 自动 / 亮色 / 暗色 |

**注**: 译配双栏在 ≤600px 自动 fallback 到单栏

### 配色方案

**浅色主题**:
- 背景: `#ffffff`
- 唱段背景: `#f5f0e0`（浅暖黄）
- 对白背景: `#f0f4f8`（浅冷灰）
- 角色名: `#555`
- 边框: `#e0ddd5`

**深色主题（暖色调）**:
- 背景: `#1e1a14`（深暖黑）
- 唱段背景: `#2a2318`（深琥珀）
- 对白背景: `#1e2028`（深蓝灰）
- 角色名: `#c4a86a`（琥珀金）
- 边框: `#3a342a`

**Tech Cue 着色**:
- 来源: frontmatter `tech.{category}.color`
- 渲染: 低透明度背景 + 原色文字/边框
- 示例: `#66ccff` → `bg: rgba(102,204,255,0.15)`, `color: #66ccff`

### 排版规范

- 角色名左栏固定 100px，`white-space: nowrap`
- 多角色（>2）自动垂直堆叠
- 对白右栏自适应
- 行高: 1.4
- Tech cue block 带分类标题（如 "SFX"）

---

## Tech Cue 匹配规则

1. **取 payload 开头第一个词**（忽略前导空白）
   - `<<LX: SPOT_PARK>>` → "LX"
   - `<<<SFX\n音效>>>` → "SFX"

2. **匹配优先级**:
   - 匹配分类名（如 "sfx", "lx"）→ 使用该分类 color
   - 匹配 entry id（如 "BGM_ENTER" 在 sfx 下）→ 使用所属分类 color
   - 未匹配 → 使用 `tech.color` → 主题默认色

3. **块级渲染**:
   ```html
   <div class="block-tech-cue" data-category="SFX">
     <div class="block-tech-cue-header">SFX</div>
     <div class="block-tech-cue-content">春去秋来</div>
   </div>
   ```

---

## 执行检查清单

- [ ] Phase 1.1 完成
- [ ] Phase 1.2 完成
- [ ] Phase 1.3 完成
- [ ] Phase 1.4 完成
- [ ] Phase 1.5 完成
- [ ] Phase 2.1 完成
- [ ] Phase 2.2 完成
- [ ] Phase 2.3 完成
- [ ] Phase 2.4 完成
- [ ] Phase 2.5 完成
- [ ] Phase 2.6 完成
- [ ] Phase 2.7 完成
- [ ] Phase 3.1 完成
- [ ] Phase 3.2 完成
- [ ] Phase 3.3 完成
- [ ] Phase 3.4 完成
- [ ] Phase 3.5 完成
- [ ] Phase 3.6 完成
- [ ] Phase 4.1 完成
- [ ] Phase 4.2 完成
- [ ] Phase 4.3 完成
- [ ] Phase 5.1 完成
- [ ] Phase 5.2 完成
- [ ] Phase 5.3 完成
- [ ] Phase 5.4 完成
- [ ] Phase 6.1 通过
- [ ] Phase 6.2 通过
- [ ] Phase 6.3 验证通过
- [ ] Phase 6.4 验证通过
