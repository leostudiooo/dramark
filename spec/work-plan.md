# DraMark Parser/Plugin 工作计划（Block Stack 对齐版）

> 适用版本：0.4.1（spec）
> 文档定位：实现路线与验收基线，不替代语言规范正文。

---

## 0. 目标与约束

目标：让仓库实现逐步与 `spec/spec.md` 的 Block Stack 模型对齐。

约束：

- 不回退现有可用能力（`$$ title`、`!!`、`inline-spoken`、frontmatter 透传）。
- 继续保持 CommonMark 结构保留（通过 `fromMarkdown` 解析内容块）。
- 所有变更必须由 `pnpm build` + `pnpm test:run` 回归。

---

## 1. 当前实现快照（2026-03-19）

### 1.1 已稳定能力

- frontmatter 原文透传与最小开关判定
- `@角色`（含多角色与情绪）
- `$$` / `$$ 标题`、`!!`、song 中 `inline-spoken`
- `= 原文` 译配对（角色上下文）
- `%`、`%%`、`<<<...>>>`、`<<<...\n...\n>>>`
- 根级 heading/thematicBreak 输出真实 mdast 节点
- root-level 指令门禁（缩进行不触发 DraMark 指令）

### 1.2 与规范差距（重点）

- 未实现 `@@` 显式退出角色
- 未实现单行 `=` 显式退出译配
- 未实现角色声明独占行硬约束与相关 warning
- 未实现引号角色名完整解析
- warning code 集合明显少于规范建议
- Tech Cue 尚未完整支持 `<<<` 对称回退闭合策略
- `micromark` 仅行内扩展，块级构造未迁移

---

## 2. 差距分级

### P0（语义一致性）

1. `@@` 与 `=` 显式退出
2. 角色声明独占行校验（含兼容模式策略）
3. 角色名解析（空格裁剪、引号、空名降级）

### P1（闭合与诊断一致性）

1. Tech Cue 多行闭合优先级：`>>>` 主闭合 + `<<<` 回退闭合
2. 诊断码集合与严重级别对齐规范建议

### P2（架构升级）

1. `legacy` 汇编器内显式 Block Stack 数据结构
2. 块级语法向 micromark flow 扩展迁移

---

## 3. 里程碑计划

## M1：Legacy 语义补齐（先对齐功能）

### M1-1 结构控制 token 补齐

- 增加 `@@` 语义：关闭 `CharacterBlock`（及其内层兼容关闭）
- 增加单行 `=` 语义：显式关闭 `TranslationBlock`

验收：

- 新增 parser tests 覆盖正常关闭与无效位置输入
- 不影响已有 `= 原文` 行为

### M1-2 角色声明规则补齐

- 引入角色声明独占行校验
- 增加 `characterDeclarationMode: 'strict' | 'compat'`（默认 strict）
- strict：违规降级为文本并 warning
- compat：保留旧写法并产生弃用 warning

验收：

- 旧测试全通过
- 新增 strict/compat 双模式测试

### M1-3 角色名解析升级

- 支持 `@"..."` / `@“...”`
- 处理空白裁剪与空名降级

验收：

- 空格姓名与引号姓名测试覆盖
- 非法空名产生 warning

---

## M2：Block Stack 显式化（先保留 legacy 外观）

### M2-1 引入显式栈模型

- 在 `parser.ts` 内将上下文布尔变量迁移为统一 stack
- 落地兼容性闭合算法（内到外）

### M2-2 闭合优先级收敛

- 统一处理 `Comment/Tech/Translation/Character/Song` 闭合优先
- Tech Cue 支持 `>>>` 主闭合、`<<<` 回退闭合

验收：

- `scan-segments` + `parser` + `edge-cases` 新增闭合顺序用例
- 保证既有 AST 结构不退化

---

## M3：micromark 块级迁移（可并行探索）

### M3-1 flow constructs 分阶段迁移

顺序建议：

1. `%` / `%%`
2. `<<<`（块级）
3. `@` 与 `=`
4. `$$` 与 `!!`

### M3-2 插件行为收敛

- 目标：`micromark` 模式下由 parse 阶段直接产出块级自定义节点
- 在迁移完成前，明确 `micromark` 仍为实验路径

验收：

- `plugin.test.ts` 增加“块级节点在 micromark 模式可见”的断言
- 仍保持 remark 链路兼容

---

## 4. 诊断码收敛建议

在现有 4 个 parser warning 基础上，逐步增加：

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
