# DraMark Parser/Plugin 工作计划（面向 Agent 实施）

> 适用版本：`0.1.x → 0.3+`  
> 目标读者：实现/重构 DraMark 解析器与 remark 插件的自动化 Agent  
> 本文定位：把“下一步要做什么”拆成可执行、可验收、可回归的任务清单。

---

## 0. 背景与现状（对齐）

当前实现（v0.1.0）的关键事实：

- 解析核心是**逐行状态机**：`src/parser.ts`
  - 产出自定义节点：`character-block` / `translation-pair` / `song-container` / `block-tech-cue` / `comment-*` 等（见 `src/types.ts`）
  - 普通文本目前基本都被降级为 `paragraph(text)`，并在段落内做少量自定义 inline（`{}` / `$...$` / `<<...>>`）
- remark 插件会**覆盖** `tree.children`：`src/index.ts`
- 测试覆盖：
  - 语法基本能力：`src/tests/parser.test.ts`
  - 规范裁决门禁（6 条）：`src/tests/edge-cases.test.ts`
  - plugin strict 行为：`src/tests/plugin.test.ts`
  - 示例集成：`src/tests/ham.test.ts` + `example/ham.md`

当前主要差距（与 `spec/spec.md` 的“CommonMark 超集方言”目标相比）：

1. CommonMark 结构未保留（列表/引用/强调/heading/thematicBreak 等节点不真实）
2. “Root-level/容器隔离”是靠缩进猜测，无法严格对齐 CommonMark 容器语义
3. translation target 目前仅按空行切段生成 paragraph，无法表达“target 是 block list 且可含列表/引用”
4. 缩进注释等场景存在信息丢失风险
5. 选项与实现存在不一致（例如 `strictMode` 在 parse API 里不生效；`NESTED_SONG_CONTAINER` 基本不可达）

### 执行状态快照（2026-03-19）

- M0：已完成并在测试中覆盖（strict 行为归属、百分号注释词法、防不可达 nested song 警告分支）
- M1：已完成核心目标（角色对白与 translation target 均可保留 CommonMark block 结构）
- M2：已完成“插件注入 + inline token”阶段
  - 已完成：`parserMode: 'legacy' | 'micromark'`、`micromarkExtensions`/`fromMarkdownExtensions` 注入、`<<...>>`/`$...$`/`{...}` 行内 tokenization
  - 未完成：`@`, `=`, `$$`, `<<<`, `%`, `%%` 的 block construct 迁移
- Web MVP：已启动 `apps/web`（编辑、预览、诊断、outline、config 面板）
- 语义修复：
  - legacy 路径修复 `<<...>>` 在 html-split 场景下的 `inline-tech-cue` 归一化
  - `$$` 上下文禁用 `$...$` inline-song，回退普通文本
- 本地回归基线：`pnpm build:web && pnpm test:run` 通过（5 files / 42 tests）

---

## 1. 总目标（Definition of Done）

实现完成的最低标准（DoD）：

- 解析结果 AST 既能表达 DraMark 语义（角色/唱段/译配/技术 cue/注释等），又**最大化保留 CommonMark 结构**
- “容器隔离原则”能被可靠执行：位于列表/引用等嵌套容器中的 `---/#/@/=/$$/<<<` 不应触发 DraMark 状态切换
- `translation-pair.target` 为**块级节点数组**，可以包含段落、列表、引用等多种块级结构
- plugin 能在 unified/remark 链路中工作，且不会破坏下游插件对标准 mdast 的预期
- 测试与示例可回归：`pnpm test:run` 必须稳定通过，并新增覆盖关键缺口的测试用例

---

## 2. 路线图概览（里程碑）

建议按从“小修一致性 → 引入真实 mdast → micromark 扩展”的顺序推进：

- **M0（v0.1.x）一致性修复**：清理不一致与明显缺口，避免后续重构被历史包袱拖累
- **M1（v0.2）引入真实 mdast blocks（增量）**：保持“状态机驱动”，但用 `mdast-util-from-markdown` 解析内容块
- **M2（v0.3+）micromark 扩展 + from-markdown bridge（根治）**：让 `remark-parse` 原生识别 DraMark，严格容器隔离

每个里程碑都必须提供：

- 任务清单（可逐项勾选）
- 验收标准（可自动化判断）
- 必要的测试新增点（对应 spec 关键规则）

---

## 3. M0（v0.1.x）一致性修复（建议先做）

### M0-1：明确 strict 行为的归属

**问题**：`DraMarkOptions.strictMode` 目前在 `parseDraMark` 内不生效，仅 remark 插件使用。

**决策（需选其一，并在文档中写清楚）**：

- 方案 A（推荐）：`parseDraMark` 始终只返回 `warnings`，strict 仅在插件层生效  
  - 动作：从 `DraMarkOptions` 移除 `strictMode`，或者保留但在 parse API 文档中声明“无效/仅插件使用”
- 方案 B：`parseDraMark` 在 `strictMode=true` 时对首个 warning 抛 `DraMarkParseError`  
  - 动作：在 `parseDraMark` 内调用 `warningToError` 并抛出；同步更新 tests 与 `src/README.md`

**验收标准**：
- 对 `parseDraMark` 与 plugin 的 strict 行为描述一致（代码 + `src/README.md`）
- 新增/更新测试覆盖 strict 行为边界

### M0-2：修复/定义 “缩进注释” 的行为

**问题**：缩进形式的 `% 注释` 可能被当作普通段落并被 `stripInlineComment` 清空，导致信息丢失。

**建议行为**（与 spec 精神一致）：
- 只要某行的“第一个非空字符”为 `%`（且不是 `%%`），就应视作 `comment-line`（当 `includeComments=true`）
- 不要求注释必须 root-level；注释应能附着在当前角色/唱段上下文

**任务**：
- 调整注释识别逻辑：将 comment-line 的识别从 `rootDirectiveLine` 中解耦
- 新增测试：
  - 角色上下文里、列表缩进里、引用块里分别出现 `%` 时的行为（至少覆盖“不丢内容”）

**验收标准**：
- `includeComments=true` 时，不会把“本应是注释的内容”变成空 paragraph

### M0-3：移除或修正 `NESTED_SONG_CONTAINER` / `allowNestedSongContainers`

**问题**：当前 `$$` 逻辑是 toggle，`NESTED_SONG_CONTAINER` 分支基本不可达。

**任务**（二选一）：
- 方案 A（推荐）：移除 `allowNestedSongContainers` 与 `NESTED_SONG_CONTAINER`，简化 API
- 方案 B：实现真正的 song container stack（复杂度较高，不建议在 v0.1.x 做）

**验收标准**：
- 选项与警告在代码路径上可达且有测试；或彻底移除并更新文档

---

## 4. M1（v0.2）增量：引入真实 mdast blocks（保留状态机）

> 核心思路：仍用“逐行状态机”决定上下文边界，但不再手工造 paragraph/text；改为对“内容块”使用 `mdast-util-from-markdown` 解析为真实 mdast blocks。

### M1-1：内容块缓冲与 flush 策略

**要做的结构性调整**：

- 在 `character-block` 内，不再对每行直接 `paragraphFromLine`，而是：
  1. 缓冲一段原始 markdown lines（直到状态切换指令出现）
  2. flush：对缓冲内容调用 `fromMarkdown` 得到 `Content[]`
  3. 将这些 blocks push 到 `currentCharacter.children`
- 在 `translation-pair.target` 内同样使用 `fromMarkdown` 解析 target chunk

**边界要点**：
- 必须保持 spec 的截断点（下一个 `= ` / `@` / root `---` / root `#` / `$$`）
- 仍需维持“容器隔离原则”：只有 root-level 指令才截断/切换

### M1-2：自定义 inline 的注入策略（临时）

`fromMarkdown` 会产出标准 mdast（text/emphasis/strong/link/list/...）。

在 M1 阶段可以先采用“后处理 walker”：

- 遍历 mdast 的所有 `text` 节点，将其中的
  - `{动作}` / `｛动作｝` → `inline-action`
  - `$短唱$` → `inline-song`
  - `<<...>>` → `inline-tech-cue`
  做成 split + 替换（注意转义字符 `\`）

**注意**：spec 对 inline tech cue 有“词法抢占权”，M1 的后处理可能仍会被 HTML/实体等影响；这属于 M2 才根治的问题，但 M1 至少要保证：

- “不跨行泄漏”仍成立
- 转义序列生效
- 不破坏 `fromMarkdown` 生成的强调/链接等节点结构

### M1-3：新增测试（必须）

新增覆盖应当以 spec 的“缺口点”为导向：

- translation target 内包含列表/引用/多段落，并断言 `target` 中出现 `list` / `blockquote` 等节点类型
- character dialogue 内包含 `*斜体*`、`**加粗**`、链接等，断言 mdast 结构被保留
- root-level 指令与“≤3 空格顶格”兼容性（如果决定在 M1 阶段支持）

**验收标准**：
- `translation-pair.target` 不再只包含 paragraph
- 示例 `example/ham.md` 解析后能在 tree 中找到常见 mdast 结构（例如 list/heading/thematicBreak，具体以实现选择为准）

---

## 5. M2（v0.3+）根治：micromark 扩展 + from-markdown bridge

> 核心思路：让 DraMark 成为 remark-parse 的一等公民。用 micromark 扩展实现 block/inline tokenization，再用 from-markdown 扩展生成 mdast 自定义节点。这样容器隔离将由 CommonMark 解析过程天然保证。

### M2-1：插件形态调整（关键）

将 `remarkDraMark` 从“覆盖 tree.children”升级为“向 remark-parse 注入扩展”：

- 在 unified 插件里设置：
  - `this.data('micromarkExtensions', [...])`
  - `this.data('fromMarkdownExtensions', [...])`
- 由 `remark-parse` 在 parse 阶段直接生成 DraMark 节点与 CommonMark 节点混合 AST

### M2-2：需要实现的 token（建议拆分实现）

按风险从低到高拆：

1. inline：`<<...>>`（不跨行）、`$...$`、`{...}`（含全角）
2. block：`<<< ... >>>`、`%% ... %%`、`% ...`（comment-line）
3. block：`@角色...`（character-block）
4. block：`= source` + target 吞噬（translation-pair）
5. block：`$$` song-container（含 heading breakout 的裁决）

### M2-3：测试策略升级

除现有单测外，增加：

- “容器隔离”严格测试：在 list item / blockquote 内写入 `---/#/@/=`，断言**不触发** DraMark 行为
- 与 remark 生态协作测试：跑一条 unified 链（`remark-parse` + `remark-stringify` + 自定义），确保 AST 可 round-trip（不要求字面完全相同，但结构必须可处理）
- snapshot（可选）：对关键输入输出 AST 做快照，稳定重构

**验收标准**：
- 在嵌套容器内，DraMark 指令不会触发状态机切换（靠 CommonMark 语义保证）
- plugin 不再需要手工覆盖 `tree.children`

---

## 6. 实施顺序建议（给 Agent 的最短可行路径）

如果要让 Agent 在最少回合内产出可用改进，推荐：

1. 先做 **M0（strict/注释/nested song 选项）**：低风险、立刻消除不一致
2. 再做 **M1（fromMarkdown 引入真实 blocks）**：大幅提升“CommonMark 超集”的实际效果
3. 最后推进 **M2（micromark 扩展）**：根治容器隔离与词法抢占

---

## 6.1 M3（app/扩展层）麦克风分配与换麦扩展

> 核心思路：换麦识别完全由前端/应用层处理，Parser 只输出普通 `<<...>>` 行内技术标记。

### M3-1：简洁语法规范（spec 已更新）

换麦指令通过简洁语法识别，**不依赖关键词配置**：

| 语法 | 含义 | 角色来源 | 源麦来源 |
|------|------|----------|----------|
| `<<=HM2>>` | 切到 HM2 | 当前 `@角色` 上下文 | 角色默认麦 |
| `<<角色=HM2>>` | 角色切到 HM2 | 显式指定 | 角色默认麦 |
| `<<HM1->HM2>>` | 从 HM1 切到 HM2 | 当前 `@角色` 上下文 | 显式指定 |
| `<<角色:HM1->HM2>>` | 角色从 HM1 切到 HM2 | 显式指定 | 显式指定 |

- 等号 `=` 与箭头 `->` 等价，可混用
- 歧义时优先匹配角色名；无法消歧时产出 warning

### M3-2：前端识别层职责

- 解析 `<<...>>` 和 `<<<...>>>` 内容，识别上述简洁语法
- 默认目标策略：
  - 角色上下文省略 target 时绑定当前角色
  - 非角色上下文省略 target 时发 warning
- 角色匹配：默认按 `name`，重名时通过 `id` 消歧

### M3-3：Parser 职责

- **无变化**：继续将 `<<...>>` 输出为 `inline-tech-cue` 节点
- 前端自行处理语义识别，无需 Parser 特殊支持

### M3 验收标准

- Parser 不增加换麦相关代码，保持 `inline-tech-cue` 统一输出
- 前端可稳定识别简洁语法换麦事件
- 无换麦指令的旧文档行为完全不变

---

## 7. 运行与回归命令（Agent 必跑）

- 单测：`pnpm test:run`
- 构建：`pnpm build`

---

## 8. 风险清单（实施时优先关注）

- **AST 兼容性**：自定义节点需正确扩展 mdast 的类型映射（`src/types.ts`），否则下游插件可能崩溃
- **指令优先级**：frontmatter phase-0、song breakout、translation 截断点必须持续满足 spec 的 6 条裁决
- **性能与内存**：M1 大量调用 `fromMarkdown` 时要避免“按行解析”；必须以 chunk 为单位
- **语义回归**：任何改动都要确保 `src/tests/edge-cases.test.ts` 的裁决门禁不被破坏
