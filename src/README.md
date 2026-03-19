# DraMark Parser 开发文档

## 1. 文档定位

本文件描述的是当前仓库实现状态，而不是语言规范全文。

- 规范目标模型：Block Stack（见 `spec/spec.md`）
- 当前实现模型：`legacy` 路径采用“frontmatter 预处理 + 分段扫描 + 汇编组装”的过渡实现
- 结论：当前实现已经覆盖大量语法能力，但尚未完整落地规范中的全部闭合与诊断规则

## 2. 当前状态（2026-03-19）

- `legacy`：生产可用路径，负责 DraMark 块级语义组装
- `micromark`：实验性路径，仅做行内 tokenization（`<<...>>`、`$...$`、`{...}`）
- `pnpm build`、`pnpm test:run` 已通过（6 files / 77 tests）

## 3. 目录结构

- `errors.ts`
  - `DraMarkParseError`、`defaultOptions`、`warningToError`
- `types.ts`
  - 自定义 AST 节点与 warning 类型
- `parser.ts`
  - legacy 解析主流程（scan + assemble）
- `inline-markers.ts`
  - 行内 marker 变换（含 `inline-spoken`）
- `m2-extensions.ts`
  - micromark 行内扩展与 from-markdown bridge
- `index.ts`
  - remark 插件入口
- `core/`
  - frontmatter 归一化、诊断映射、outline、view-model

## 4. 对外 API

### 4.1 parseDraMark

输入字符串，返回：

- `tree`
- `warnings`
- `metadata`
  - `frontmatterRaw?: string`
  - `translationEnabledFromFrontmatter: boolean`

说明：

- 解析器只透传 frontmatter 原文并做最小开关判定
- frontmatter schema 校验与外部配置拉取不在 parser 语法层完成

### 4.2 remark 插件

- 默认导出：`remarkDraMark`
- `parserMode`：`legacy | micromark`（默认 `legacy`）

行为差异：

- `legacy`：会用 `parseDraMark` 结果覆盖 `tree.children`
- `micromark`：不覆盖 `tree.children`，仅注入行内扩展；同时把 legacy 解析出的 warnings/metadata 挂到 `file.data.dramark`

### 4.3 strictMode

- `parseDraMark`：不会抛错，只返回 warnings
- `remarkDraMark`：`strictMode=true` 时，遇到 warnings 抛首条错误

## 5. 语法支持矩阵（实现视角）

### 5.1 已支持

- frontmatter 提取与原文透传
- `@角色`、多角色声明、`[]/【】` 情绪解析
- `---` / `***` / `___` 重置
- 根级 heading 识别与 song 穿透退出
- `$$` 与 `$$ 标题`
- `!!`（仅在 song 内有效）
- `= 原文` 译配源行（角色上下文 + translation enabled）
- `%` 行注释、`%%...%%` 块注释
- `<<<...>>>`（单行）与 `<<<`...`>>>`（多行主闭合）
- 行内 `{...}` / `｛...｝`、`$...$`、`<<...>>`
- `inline-spoken`：song 上下文下 `$...$` 转为 `inline-spoken`
- root-level 指令门禁（缩进行不触发 DraMark 指令）

### 5.2 部分支持

- Tech Cue 多行闭合：目前只支持 `>>>` 主闭合；规范中的 `<<<` 对称回退闭合尚未完整实现
- `micromark` 模式：仅行内 tokenization，块级语义不由 micromark 构造自定义节点

### 5.3 尚未支持（规范条目）

- `@@` 显式退出角色模式
- 单行 `=` 显式退出译配
- 角色声明独占行校验（含兼容模式 warning）
- 引号角色名完整解析（例如 `@"冉 阿让"`）
- 外部 frontmatter 拉取 warning（如 `EXTERNAL_FRONTMATTER_*`）
- 扩展 warning 码（如 `INVALID_CHARACTER_NAME` 等）

## 6. Warning 与诊断

当前 parser warning code（仅 4 个）：

- `UNCLOSED_BLOCK_COMMENT`
- `UNCLOSED_BLOCK_TECH_CUE`
- `UNCLOSED_SONG_CONTAINER`
- `TRANSLATION_OUTSIDE_CHARACTER`

`core` 层可附加配置诊断（`CONFIG_*`），用于 frontmatter 归一化反馈。

## 7. 测试与命令

- `pnpm build`
- `pnpm test:run`
- `pnpm dev:web`
- `pnpm build:web`

测试文件：

- `src/tests/parser.test.ts`
- `src/tests/scan-segments.test.ts`
- `src/tests/edge-cases.test.ts`
- `src/tests/plugin.test.ts`
- `src/tests/core.test.ts`
- `src/tests/ham.test.ts`

## 8. 下一步（与 Block 模型对齐）

1. 在 `legacy` 路径中引入显式 Block Stack 结构与统一 close/open 规则
2. 补齐规范差距：`@@`、`=` 显式退出、角色独占行校验、引号角色名解析、warning code 扩展
3. 收敛 Tech Cue 多行闭合优先级（`>>>` 主闭合 + `<<<` 回退闭合）
4. 将 block-level 能力逐步迁移到 micromark flow constructs
