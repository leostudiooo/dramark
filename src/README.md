# DraMark Parser 开发文档

## 1. 文档定位

本文件描述的是当前仓库实现状态，而不是语言规范全文。

- 规范目标模型：Block Stack（见 `spec/spec.md`）
- 当前实现模型：micromark-only 集成 + DraMark multipass 管线
- 结论：当前实现已完成“legacy 集成路径下线 + micromark 词法统一”，规范差距主要集中在应用层 frontmatter 外链执行

## 2. 当前状态（2026-03-20）

- 插件已切换为 micromark-only 集成路径（不再提供 `legacy` 模式开关）
- DraMark 采用**3-4 pass multipass** 架构（见下方“解析流水线”）
- `bun build`、`bun test:run` 已通过（6 files / 81 tests）

## 2.1 解析流水线（3-4 pass）

### 为什么必须 multipass

单遍解析无法同时满足以下规范约束：

1. 代码保护区优先（Code Sanctuary Priority）
2. 行内 Tech Cue 词法抢占（避免 `<<...>>` 被 CommonMark HTML/文本路径吞掉）
3. Block Stack 的确定性闭合顺序
4. CommonMark 内容块保真（list/blockquote/code 等结构不丢失）

多遍解析的目标不是“多跑几次”，而是把上述冲突分层处理，防止互相吞噬。

### 每一遍做什么

| Pass | 输入 | 输出 | 作用 |
| --- | --- | --- | --- |
| Pass 0（frontmatter） | 原始文本 | frontmatter 元数据 + 正文起始行 | 透传 YAML 原文，计算 translation 最小开关 |
| Pass 1（micromark 标记） | 正文文本 | 行内词法边界 | 先锁定 `<<...>>`、`$...$`、`{...}`，避免被 CommonMark 抢占 |
| Pass 2（DraMark 结构解析） | 行流 + 词法边界 | Block Stack 结构段 | 处理根级触发、闭合顺序、角色声明规则、译配上下文 |
| Pass 3（CommonMark 材料化） | 结构段 markdown | mdast 内容块 | 保留 list/blockquote/code 等标准结构 |
| Pass 4（可选还原） | 带保护占位中间树 | 最终 AST | 还原保护块字面量，防止语义污染 |

实现说明：当前 parser 在 `parseMarkdownBlocks` 中直接复用 `m2-extensions.ts` 的 micromark/from-markdown 扩展，standalone 与 unified 插件共享同一套行内词法规则。

### 失败模式（为什么不能退化为单遍）

1. `<<...>>` 被 CommonMark 路径吞掉，Tech Cue 漏识别
2. 代码块内符号误触发 DraMark 指令
3. `Song/Character/Translation` 闭合顺序错误导致 AST 漂移
4. list/blockquote 等内容块结构损坏

## 3. 目录结构

- `errors.ts`
  - `DraMarkParseError`、`defaultOptions`、`warningToError`
- `types.ts`
  - 自定义 AST 节点与 warning 类型
- `parser.ts`
  - DraMark multipass 结构解析主流程（scan + block-stack assemble）
- `inline-markers.ts`
  - 历史兼容工具（已不作为主解析路径）
- `m2-extensions.ts`
  - micromark 行内扩展、from-markdown bridge、standalone 复用入口
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
  - `multipassDebug?`（仅在 `multipassDebug: true` 时输出）
    - `pass0.hasFrontmatter`
    - `pass0.startIndex`
    - `pass1.markedInput`
    - `pass2.segments[]`（`kind` + `lineNo`）
    - `pass4.enabled`
    - `pass4.executed`
    - `pass4.restoredNodeCount`

说明：

- 解析器只透传 frontmatter 原文并做最小开关判定
- 解析器识别 Tech Cue 外层边界并保留 payload 原文；payload 内基础 DraMark/CommonMark 语法可正常解析，但不在语法层解释换麦关键词等扩展语义
- frontmatter schema 校验与外部配置拉取不在 parser 语法层完成
- `multipassDebug` 用于调试 pass 产物，不影响默认解析语义
- `pass4Restore` 默认为开启；可在调试或对比场景显式关闭

### 4.2 remark 插件

- 默认导出：`remarkDraMark`

行为：

- 固定走 micromark 集成路径（不再切换 legacy）
- 保持 mdast 主树不被覆盖
- 通过 `file.data.dramark` 输出 DraMark warnings/metadata（以及 multipass 集成信息）

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
- `=` 显式退出译配
- `%` 行注释、`%%...%%` 块注释
- `<<<...>>>`（单行）与 `<<<`...`>>>` / `<<<`...`<<<`（多行闭合）
- 行内 `{...}` / `｛...｝`、`$...$`、`<<...>>`
- `inline-spoken`：song 上下文下 `$...$` 转为 `inline-spoken`
- root-level 指令门禁（缩进行不触发 DraMark 指令）
- `@@` 显式退出角色模式
- 角色声明独占行校验（`strict`）与兼容模式（`compat`）
- 引号角色名解析（`@"..."` / `@“...”`）

### 5.2 架构决策（非缺失项）

- 块级语义由 DraMark pass2 的 Block Stack 明确驱动（不是 legacy 状态机回退）
- 行内词法统一由 micromark 扩展负责（standalone 与插件同源）

### 5.3 尚未支持（规范条目）

- 外部 frontmatter 拉取执行链路（`use_frontmatter_from` 的 fetch/merge）

## 6. Warning 与诊断

当前 parser warning code：

- `UNCLOSED_BLOCK_COMMENT`
- `UNCLOSED_BLOCK_TECH_CUE`
- `UNCLOSED_SONG_CONTAINER`
- `TRANSLATION_OUTSIDE_CHARACTER`
- `CHARACTER_DECLARATION_NOT_STANDALONE`
- `INVALID_CHARACTER_NAME`
- `DEPRECATED_INLINE_CHARACTER_DECLARATION`
- `EXTERNAL_FRONTMATTER_FETCH_FAILED`
- `EXTERNAL_FRONTMATTER_PARSE_FAILED`

`core` 层可附加配置诊断（`CONFIG_*`），用于 frontmatter 归一化反馈。

## 7. 测试与命令

- `bun build`
- `bun test:run`
- `bun dev:web`
- `bun build:web`

测试文件：

- `src/tests/parser.test.ts`
- `src/tests/scan-segments.test.ts`
- `src/tests/edge-cases.test.ts`
- `src/tests/plugin.test.ts`
- `src/tests/core.test.ts`
- `src/tests/ham.test.ts`

## 8. 下一步（与 Block 模型对齐）

1. 补齐 Tech Cue 闭合优先级边界测试（尤其是 `<<<\n<<<\n>>>`）
2. 继续扩展保护区边界测试矩阵（覆盖更多 Tech Cue 与代码块组合）
3. 补齐外部 frontmatter 拉取失败诊断与应用层对接样例
