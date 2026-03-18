# DraMark Parser 开发文档

## 1. 目标

本目录实现了 DraMark 的 remark 插件与解析核心，当前版本为 v0。

当前目标：
- 可以解析核心语法并输出结构化树
- 可以作为 unified/remark 插件接入处理链
- 支持 warning 与 strict mode 报错

当前状态（2026-03-19）：
- 默认 `legacy` 路径已支持**所有** DraMark 语法（角色、唱段、译配、注释、技术提示、行内标记）
- `micromark` 路径仅支持**行内 token**（`<<...>>`、`$...$`、`{...}`），块级构造（`@`、`=`、`$$`、`<<<`、`%`、`%%`）仍依赖 `legacy` 解析器
- **推荐**：使用 `legacy` 模式获得完整功能；`micromark` 模式目前仅作为实验性特性
- `micromark` 路径下插件不再覆盖 `tree.children`；`legacy` 路径仍保持覆盖行为以复用现有状态机
- `legacy` 已修复 `<<...>>` 在 from-markdown 被拆分为 `text/html/text` 时的漏识别问题
- 在 `$$` 唱段上下文中，`$...$` 会回退为普通文本，不再生成 `inline-song`
- 已验证 `pnpm build`、`pnpm test:run` 与 `pnpm build:web` 全通过（5 个测试文件，42 个用例）

## 2. 目录结构

- errors.ts
  - 错误模型与默认选项处理
- types.ts
  - DraMark 节点类型、警告类型、配置类型
- parser.ts
  - 行级状态机解析核心，产出 DraMarkRoot
- index.ts
  - remark 插件入口，封装 parseDraMark
- tests/
  - 单元与集成测试

## 3. 对外 API

### parseDraMark

输入字符串，返回解析结果：
- tree: 解析树
- warnings: 告警列表
- metadata: 元信息（frontmatter 原文透传 + 最小可用开关）
  - `frontmatterRaw?: string`
  - `translationEnabledFromFrontmatter: boolean`

说明：
- Frontmatter 被视为文档配置层，不属于 DraMark 正文语法本体
- 解析器仅做提取与最小可用判断（例如 `translation.enabled`）
- 字段归一化与业务消费建议由前端/渲染器处理

### core API（新增）

为 Web 编辑器与 VS Code 扩展共享应用层逻辑，新增 `core` 子模块：

- `normalizeFrontmatter(frontmatterRaw)`
  - 归一化 `meta/casting/translation/tech`
  - 保留未知字段到 `extras`
  - 产出非致命 `config diagnostics`
- `createParseViewModel(sourceText, options)` / `toParseViewModel(parseResult)`
  - 输出统一的 `ParseViewModel`
  - 合并 parser warnings 与 config diagnostics
  - 生成基础 outline（heading/character/song/thematic-break）

导入方式：

- `import { normalizeFrontmatter } from 'remark-dramark/core'`
- `import { createParseViewModel } from 'remark-dramark/core'`

### remark 插件

默认导出为 remarkDraMark。

行为：
- 调用 parseDraMark 解析文件内容
- 将 warnings 与 metadata 挂到 file.data.dramark
- 在 strictMode 下，如果存在 warning，抛出首个错误

parserMode 选项：
- `parserMode: 'legacy' | 'micromark'`（**默认 `legacy`**）
- **`legacy`（推荐）**：完整支持所有 DraMark 语法，使用行状态机解析，运行期覆盖 `tree.children`
- `micromark`（实验性）：仅支持行内标记（`<<...>>`、`$...$`、`{...}`）的原生 micromark tokenization；块级构造（`@`、`=`、`$$` 等）仍回退到 legacy 解析器处理，不再覆盖 `tree.children`

使用建议：
- 需要完整 DraMark 功能时，使用默认的 `legacy` 模式
- 仅需行内标记增强的标准 Markdown 处理时，可尝试 `micromark` 模式

## 4. 语法能力支持矩阵

### `legacy` 模式（完整支持）
- frontmatter 提取（作为配置层透传）
- 角色声明：@角色名，支持多角色行声明与情绪注释（[] / 【】）
- 角色上下文台词吞噬
- 全局重置：--- *** ___
- 标题穿透（根级 heading 会结束 song context）
- 唱段容器：$$ ... $$
- 翻译对：= source + target block 收集（仅角色上下文有效）
- 注释：% 行注释、%% 块注释
- 技术提示：<<< >>> 块提示、<< >> 行内提示
- 行内动作：{动作} 与全角｛动作｝
- 行内短唱：$...$（仅在 `spoken` 上下文；`sung` 上下文回退为普通文本）
- 转义字符：\@ \$ \% \{ \} \< \= \>

### `micromark` 模式（实验性）
- 行内标记（micromark 原生 tokenization）：
  - `<<...>>` → `inline-tech-cue`
  - `$...$` → `inline-song`
  - `{...}` / `｛...｝` → `inline-action`
- 块级构造暂不支持，仍由 legacy 解析器兜底处理
- 块级构造包括：frontmatter、角色 `@`、翻译 `=`、唱段 `$$`、块注释 `%%`、块提示 `<<<`、行注释 `%`

## 5. 状态机模型

核心状态：
- 表演状态：global / character
- 音乐状态：spoken / sung

关键切换：
- @ 开启或切换 character
- --- / *** / ___ 退出 character 回到 global
- $$ 在 sung 与非 sung 之间切换
- 根级 heading 在 sung 内部会触发穿透并退出 sung

## 6. Warning 与 strict mode

目前 warning code：
- UNCLOSED_BLOCK_COMMENT
- UNCLOSED_BLOCK_TECH_CUE
- UNCLOSED_SONG_CONTAINER
- TRANSLATION_OUTSIDE_CHARACTER

严格模式：
- `parseDraMark`：始终返回 `warnings`，不会抛错
- `remarkDraMark` 插件：
  - strictMode=false：保留 warning，不中断
  - strictMode=true：发现 warning 即抛出首个错误

## 7. 测试

当前测试覆盖：
- parser.test.ts
  - 角色块解析
  - translation-pair 构建
  - song-container 构建
  - heading/thematicBreak 的 mdast 节点产出
  - translation target 与角色对白的 CommonMark block 保留（list/blockquote）
  - 百分号防误伤
- edge-cases.test.ts
  - 6 条 edge-case 裁决门禁（frontmatter 豁免、容器隔离、song 穿透、translation target block list、百分号词法、inline tech 不跨行）
  - warning 行为覆盖（未闭合 comment/tech cue/song、translation 脱离 character）
- plugin.test.ts
  - 非 strict 收集 warning
  - strict 抛错
  - `micromark` 模式下行内 tokenization 生效（包含“inline tech 不跨行”断言）
  - `micromark` 模式下不覆盖 `tree.children`
- ham.test.ts
  - 解析 example/ham.md 的集成测试

运行方式：
- pnpm test:run
- pnpm build

最近一次本地验证（2026-03-19）：
- `pnpm build && pnpm test:run && pnpm build:web`
- 结果：5 passed files / 42 passed tests，Web 构建通过

## 8. 已知限制

### v0 整体限制
- 自定义节点生态兼容性仍需在真实 remark 链路中持续验证
- 容器隔离已增强为“仅 root-level 行触发 DraMark 指令”，但更完整的 CommonMark 容器语义（复杂列表/引用嵌套）仍有精化空间

### `micromark` 模式限制（实验性）
- **仅支持行内标记的原生 tokenization**（`<<...>>`、`$...$`、`{...}`）
- **块级构造暂未实现 micromark 扩展**，包括：
  - 角色声明 `@...`
  - 翻译对 `= ...`
  - 唱段容器 `$$`
  - 块注释 `%%`
  - 块技术提示 `<<<`
  - 行注释 `%`
- 这些块级构造在 `micromark` 模式下仍由 legacy 解析器兜底处理
- 实现块级 micromark 扩展需要更深入的 micromark flow 解析机制研究（line continuation、container state 等）

## 9. 下一步建议

### 当前推荐（稳定路径）
- **继续使用 `legacy` 模式作为默认选项**，它提供完整的 DraMark 功能
- 增加复杂列表/引用嵌套场景的容器隔离回归测试
- 增加 AST 快照测试，稳定后续重构

### M2 micromark 扩展（未来探索）
- 块级构造的 micromark flow 扩展实现复杂度较高，需要深入研究：
  - Line continuation 机制（处理多行块注释、技术提示等）
  - Container state 管理（确保块级指令只在 root level 触发）
  - 与 CommonMark 块级构造的优先级协调
- 短期优先级的替代方案：保持现有架构，`micromark` 模式仅用于行内标记增强

### 当前实现状态
- M2 已打通插件注入骨架（`src/m2-extensions.ts`）
- 行内标记（`<<...>>` / `$...$` / `{...}`）已完成 micromark inline tokenization + from-markdown bridge
- 块级构造（`@`, `=`, `$$`, `<<<`, `%`, `%%`）仅在 `legacy` 模式下完整支持
- from-markdown 的 handlers 已预留接口，但对应的 micromark tokenizers 未实现
