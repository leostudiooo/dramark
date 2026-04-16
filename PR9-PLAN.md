# PR #9 修复工作计划

**分支**: `vscode-plugin-enhc`
**PR**: https://github.com/dramark-md/dramark/pull/9
**Review Comment**: https://github.com/dramark-md/dramark/pull/9#issuecomment-4260784678
**创建日期**: 2026-04-16

## 目标

在 `vscode-plugin-enhc` 分支上修复 PR #9 code review 发现的问题，使 PR 可合并。

---

## Phase 1: 删死代码（预计减少 ~1200 行）

| # | 操作 | 文件 | 状态 |
|---|------|------|------|
| 1.1 | 删除整个文件 | `apps/core/standalone-renderer.ts` | ⬜ |
| 1.2 | 移除 `getStandaloneRendererJs` 的 re-export | `apps/core/index.ts:13` | ⬜ |
| 1.3 | 删除调试残留文件 | `apps/core/render/test-layout.ts` | ⬜ |
| 1.4 | 删除死函数 `renderRowCenter` | `apps/core/components/Preview.ts:127-132` | ⬜ |
| 1.5 | 删除死方法 `wrapCSSWithSelector` | `apps/vscode-extension/src/preview-panel.ts:372-379` | ⬜ |
| 1.6 | 删除死导出 `generateTechCueColorCSS` 及 re-export | `apps/core/render/css.ts:693`、`render/index.ts:37` | ⬜ |
| 1.7 | 删除重复的 `generateTechCueCSS()` | `apps/core/render/css.ts:680-691`（与 264-285 重复） | ⬜ |
| ✅ | **验证**: `pnpm build` 通过 | | ⬜ |

---

## Phase 2: 修 Bug（3 个关键修复）

| # | 操作 | 文件 | 状态 |
|---|------|------|------|
| 2.1 | PDF 导出加 try/finally 防浏览器泄漏 | `apps/vscode-extension/src/pdf-exporter.ts:83-118` | ⬜ |
| 2.2 | 修 `${color}15` 透明度 → 用正确 hex alpha 或 `applyAlpha()` | `apps/core/components/Preview.ts:219,304` | ⬜ |
| 2.3 | 合并同模块拆分导入 | `apps/vscode-extension/src/preview-panel.ts:6-15` | ⬜ |
| ✅ | **验证**: `pnpm build && pnpm test:run` 通过 | | ⬜ |

---

## Phase 3: 构建时预编译 standalone renderer

**目标**: 消除运行时 esbuild 依赖，将 standalone renderer 在 build 阶段预编译。

| # | 操作 | 文件 | 状态 |
|---|------|------|------|
| 3.1 | 在 `build.mjs` 添加 esbuild 预编译步骤：`standalone-runtime.ts` → `dist/standalone-renderer.js` (IIFE) | `apps/vscode-extension/build.mjs` | ⬜ |
| 3.2 | 重写 `buildStandaloneRendererBundle()`：读取预编译 JS 文件而非运行时调 esbuild | `apps/vscode-extension/src/preview-panel.ts:234-259` | ⬜ |
| 3.3 | esbuild 从 `dependencies` 移至 `devDependencies` | `apps/vscode-extension/package.json` | ⬜ |
| 3.4 | 确保 VSIX 打包包含 `dist/standalone-renderer.js` | `.vscodeignore` 或 `package.json` | ⬜ |
| ✅ | **验证**: 手动测试 VSIX 安装后 PDF/HTML 导出正常 | | ⬜ |

---

## Phase 4: 清理 Minor 问题

| # | 操作 | 文件 | 状态 |
|---|------|------|------|
| 4.1 | 移除 `flushPendingSideBlocks` 两个未使用参数 + 更新调用点 | `apps/core/render/ast-to-blocks.ts:57-73` | ⬜ |
| 4.2 | 提取重复 SVG 图标为共享常量 | `preview-panel.ts:391`、`export-standalone-html.ts:128` | ⬜ |
| 4.3 | Print theme CSS 用 CSS 变量替代硬编码 hex | `apps/core/render/css.ts:660-676` | ⬜ |
| 4.4 | 合并 `export-overrides.css` print 部分到 `css.ts` 单一来源 | `apps/vscode-extension/src/styles/export-overrides.css` | ⬜ |
| 4.5 | 移除中文注释，`'配置'` → `'Settings'` | 多文件 | ⬜ |
| ✅ | **验证**: `pnpm build` 通过 | | ⬜ |

---

## Phase 5: 补关键路径测试

| # | 操作 | 文件 | 状态 |
|---|------|------|------|
| 5.1 | Chrome 路径检测逻辑单元测试 | `apps/vscode-extension/src/tests/` | ⬜ |
| 5.2 | `buildStandaloneExportHtml()` 基本输出验证 | `src/tests/` 或 `apps/core/` | ⬜ |
| 5.3 | Print theme CSS 生成验证（关键选择器和变量） | `src/tests/core.test.ts` | ⬜ |
| ✅ | **验证**: `pnpm test:run` 全部通过 | | ⬜ |

---

## 执行依赖关系

```
Phase 1 (删死代码)
  ├─→ Phase 2 (修 bug)
  ├─→ Phase 3 (预编译改造) ← 依赖 Phase 1.1 删掉 standalone-renderer.ts
  │     │
  │     └─→ Phase 4 (清理 minor) ← 可与 Phase 3 交叉进行
  │
  └────────────────────→ Phase 5 (补测试) ← 依赖 Phase 2+3 完成
```

## 不在本计划范围内

- #7 global state translation pairs — spec 讨论事项
- #8 docs live preview — 独立任务
- #10 译配工具 — 独立任务
- #11 排麦显示 — 独立任务
- #12 演员高亮 — 独立任务
- 运行时 esbuild 之外的架构重构（跨 workspace 导入等）
