# DraMark Parser/Plugin 工作计划（Block Stack 对齐版）

> 适用版本：0.4.1（spec）
> 文档定位：实现路线与验收基线，不替代语言规范正文。

---

## 0. 目标与约束

目标：让仓库实现逐步与 `spec/spec.md` 的 Block Stack 模型对齐。

约束：

- 不回退现有可用能力（`$$ title`、`!!`、`inline-spoken`、frontmatter 透传）。
- 继续保持 CommonMark 结构保留（通过 `fromMarkdown` 解析内容块）。
- 保持 3-4 pass multipass 合同，不退化为单遍解析。
- 所有变更必须由 `pnpm build` + `pnpm test:run` 回归。

---

## 1. 当前实现快照（2026-03-19）

### 1.1 已稳定能力

- frontmatter 原文透传与最小开关判定
- `@角色`（含多角色与情绪）
- `@@` 角色显式退出
- `$$` / `$$ 标题`、`!!`、song 中 `inline-spoken`
- `= 原文` 译配对（角色上下文）与单行 `=` 退出译配
- `%`、`%%`、`<<<...>>>`、`<<<...\n...\n>>>`
- 角色声明独占行校验（strict/compat）与引号姓名
- 根级 heading/thematicBreak 输出真实 mdast 节点
- root-level 指令门禁（缩进行不触发 DraMark 指令）

### 1.2 与规范差距（重点）

- Tech Cue 闭合优先级细节仍需补齐更多边界测试（特别是 `<<<\n<<<\n>>>`）
- 外部 frontmatter 拉取执行链路仍在应用层，parser 未接入 fetch/merge 执行
- multipass 的 Pass 4（保护块显式还原）仍是约定语义，尚未形成独立可观测产物

---

## 2. 差距分级

### P0（语义一致性）

1. TechCueBlock 的 `>>>` 主闭合优先 + `<<<` 回退闭合在复杂输入中的一致性
2. 保护区策略在 multipass 中的可观测性（含 pass4 restore）
3. micromark-only 集成下的多插件链路稳定性

### P1（闭合与诊断一致性）

1. Tech Cue 多行闭合优先级：`>>>` 主闭合 + `<<<` 回退闭合
2. 诊断码集合与严重级别对齐规范建议

### P2（架构升级）

1. multipass 管线显式化（pass1/2/3/4 的可观测接口）
2. pass4 保护块还原的显式化与可测试化

---

## 3. 里程碑计划

## M1：Legacy 语义补齐（已完成）

### M1-1 结构控制 token 补齐

- 增加 `@@` 语义：关闭 `CharacterBlock`（及其内层兼容关闭）
- 增加单行 `=` 语义：显式关闭 `TranslationBlock`

状态：已完成，当前解析器已支持并通过回归。

### M1-2 角色声明规则补齐

- 引入角色声明独占行校验
- 增加 `characterDeclarationMode: 'strict' | 'compat'`（默认 strict）
- strict：违规降级为文本并 warning
- compat：保留旧写法并产生弃用 warning

状态：已完成，strict/compat 逻辑已落地；后续补充更细粒度测试。

### M1-3 角色名解析升级

- 支持 `@"..."` / `@“...”`
- 处理空白裁剪与空名降级

状态：已完成，已支持引号姓名与非法名 warning。

---

## M2：Block Stack 显式化（进行中）

### M2-1 引入显式栈模型

- 在 `parser.ts` 内将上下文布尔变量迁移为统一 stack
- 落地兼容性闭合算法（内到外）

状态：核心 stack 已落地，下一步是拆分成显式 pass 管线并补强可观测中间产物。

### M2-3：micromark-only 集成收敛

- 插件不再暴露 legacy/parserMode 切换
- 统一走 micromark 集成路径 + DraMark 结构 pass
- standalone parser 的 CommonMark 材料化已复用 `m2-extensions`（行内词法与插件同源）

验收：

- `plugin.test.ts` 不再包含 legacy 模式断言
- `file.data.dramark` 输出包含 multipass 集成标识
- `parser.test.ts` 中行内 cue/song/action 值解析与 song 上下文 `inline-spoken` 行为通过

### M2-2 闭合优先级收敛

- 统一处理 `Comment/Tech/Translation/Character/Song` 闭合优先
- Tech Cue 支持 `>>>` 主闭合、`<<<` 回退闭合

验收：

- `scan-segments` + `parser` + `edge-cases` 新增闭合顺序用例
- 保证既有 AST 结构不退化

---

## M3：multipass 可观测性与保护还原（可并行探索）

### M3-1 pass 产物可观测化

顺序建议：

1. 暴露 pass1 词法边界快照（调试开关）
2. 暴露 pass2 结构段快照（调试开关）
3. 补齐 pass4 显式还原路径与开关

### M3-2 插件行为收敛

- 保留 3-4 pass multipass 合同，避免因“单 pass 优化”破坏词法优先级与保护区语义

验收：

- `plugin.test.ts` 持续验证“树不被覆盖 + file.data.dramark 输出完整”
- 仍保持 remark 链路兼容

---

## 4. 诊断码收敛建议

在现有 parser warning 基础上，持续收敛：

- `CHARACTER_DECLARATION_NOT_STANDALONE`
- `INVALID_CHARACTER_NAME`
- `DEPRECATED_INLINE_CHARACTER_DECLARATION`
- `EXTERNAL_FRONTMATTER_FETCH_FAILED`
- `EXTERNAL_FRONTMATTER_PARSE_FAILED`

说明：外部 frontmatter 拉取本身应继续由应用层实现，parser 只负责接收与透传相关诊断。

---

## 5. 文档同步约束

每次里程碑完成后必须同步更新：

- `README.md`
- `src/README.md`
- `spec/editor-renderer-v1-plan.md`
- `spec/mic-switch-extension-plan.md`

原则：

- 规范目标（spec）与实现状态（README）必须分层叙述
- 文档中“已支持”必须有测试依据

---

## 6. 回归命令

- `pnpm build`
- `pnpm test:run`

若涉及 Web 渲染行为变更，再执行：

- `pnpm build:web`
