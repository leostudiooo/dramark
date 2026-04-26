# 🎭 戏码 DraMark

> DraMark: **Dra**ma **Mark**down  
> 中文名“戏码”寓意剧本创作的“代码”，同时也暗含“一场戏”的意思，强调其作为剧本创作工具的核心定位。

专为戏剧、影视及音乐剧设计的纯文本标记语言，助力剧本创作、排练和演出的全流程。

文件扩展名：`.dra.md`, `.dramark`, `.drm` （推荐前两种）

文档：[https://docs.dramark.dev](https://docs.dramark.dev)

![VS Code 插件渲染预览](https://github.com/user-attachments/assets/580e7ed2-d38c-4e26-8014-b6baaf3f21e4)

🥳 第一版可用的 VS Code 插件已上线 [Marketplace](https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark) 和 Release 0.0.1！

## 亮点

1. **少输入法切换 (Few IME Switch)** — 核心符号 `@`, `%`, `=` 在中文键盘下可直接通过 Shift 键打出，保证编剧创作心流不断
2. **结构优先 (Structure over Tags)** — 通过块级语法（Block Grammar）定义台词、唱段和舞台动作的作用域，无需闭合标签
3. **原生译配支持 (Native Dual-track)** — 内建译配工作支持，可单语或双语渲染，满足从引进到原创的多样化需求
4. **唱段与念白切换** — 唱段内可通过 `!!` 临时插入念白段落，音乐剧剧本创作更自然
5. **技术标记 (Tech Cues)** — 支持行内 `<<>>` 与块级 `<<< >>>` 技术提示，助力剧本与舞台设计的无缝对接
6. **兼容 CommonMark** — 作为 CommonMark 的超集方言，保留所有基础格式（如 `*斜体*`、`**加粗**`、列表、引用等）
7. **一份源文件，多种剧本** — 通过角色分组与译配配置，一份 DraMark 文件可编译为演员本、导演本、工作本等多种版本

## 快速示例

🤖 如果您是 LLM 或 AI Agent，请阅读 [给 LLM/AI Agent 的 DraMark 语法指南](docs/guide/llm-syntax-guide.md)。

更完整的示例请查看 [《在公园的长椅上睡大觉》第二幕剧本](examples/where-the-bench-remembers.dramark)。感谢[@小橘猫\_zzz](https://space.bilibili.com/33539494)老师提供的授权和大力支持！

```dramark
---
meta:
  title: 牡丹亭·游园惊梦
  author: 汤显祖 (1550-1616)
  locale: zh-CN
  translation:
    enabled: true
    source_lang: zh-CN
    target_lang: en
    render_mode: bilingual
casting:
  characters:
    - name: 杜丽娘
      mic: M1
    - name: 春香
      mic: M2
    - name: 柳梦梅
      mic: M3
tech:
  mics:
    - id: M1
      label: 丽娘主麦
    - id: M2
      label: 春香主麦
    - id: M3
      label: 柳梦梅主麦
  sfx:
    - id: BGM_GARDEN
      desc: 花园背景音乐
  lx:
    - id: LX_MOON
      desc: 月光效果
      color: "#E6EEFF"
---

@杜丽娘
= 原来姹紫嫣红开遍
  What a riot of crimson and violet bloom!
= 似这般都付与断井颓垣
  Yet all this splendor goes to waste, abandoned in the ruined garden wall.
= 良辰美景奈何天
  Such a fair dawn, such gentle skies—
= 赏心乐事谁家院
  Yet where, I ask, is joy to be found?

---

@@

花园中，春光烂漫。杜丽娘携春香游园。

@春香
小姐，你看这园中景色，好不热闹！

@杜丽娘
{缓步前行，若有所思}
春香，我往日不知春色如许……
```

## 核心语法速查

| 符号           | 用途                      | 示例                    | 当前实现（main）                       |
| -------------- | ------------------------- | ----------------------- | -------------------------------------- |
| `@角色名`      | 角色声明，进入台词模式    | `@哈姆雷特`             | 已支持                                 |
| `@"角色 名"`   | 含空格姓名（推荐引号）    | `@"冉 阿让"`            | 已支持                                 |
| `@A @B [情绪]` | 多角色声明（主名+别名）   | `@peter @bobby [aside]` | 已支持                                 |
| `@@`           | 显式退出角色模式          | `@@`                    | 已支持                                 |
| `---`          | 场景切分 / 重置为全局动作 | `---`                   | 已支持                                 |
| `% 注释`       | 行注释（译配注、直译）    | `% 直译：我是谁？`      | 已支持（root-level 指令）              |
| `%% ... %%`    | 块注释                    |                         | 已支持                                 |
| `= 原文`       | 译配模式：标记原文行      | `= To be or not to be`  | 已支持                                 |
| `=`            | 显式退出译配模式          |                         | 已支持                                 |
| `$$`           | 唱段容器（音乐剧）        | `$$ ... $$`             | 已支持                                 |
| `$$ 标题`      | 带标题的唱段              | `$$ My Shot`            | 已支持                                 |
| `!!`           | 念白段落（唱段内切换）    | `!! ... !!`             | 已支持                                 |
| `$唱词$`       | 行内短唱（对白上下文）    | `今天$我要飞翔$`        | 已支持                                 |
| `{动作}`       | 行内身体动作提示          | `给我出去！{指着门}`    | 已支持                                 |
| `<<LX01 GO>>`  | 行内技术 Cue              | `<<SND: Thunder.mp3>>`  | 已支持                                 |
| `<<< ... >>>`  | 块级技术 Cue              |                         | 已支持（`>>>` 主闭合，`<<<` 回退闭合） |

## 更新日志

### v0.4.1

- `$$` 唱段开启标记允许后跟空格与文本，作为歌曲标题/说明（如 `$$ My Shot`），存储在 `SongBlock.title` 字段
- 新增念白标记 `!!`：在唱段内开启/关闭念白段落，`!!` 关闭后自动回到唱段上下文
- 明确 GlobalBlock 语义：默认状态即为"念白"，无需额外标记
- VSCode 预览支持运行时配置覆盖（译配模式/布局/主题等）；`translation.render_mode` 作为可选默认提示，不是强制前置条件
- VSCode frontmatter 自动补全默认关闭（保留正文 DraMark 补全）

说明：以上语法在当前 main 分支已基本落地；规范中仍有少量条目（主要是外部 frontmatter 拉取与块级 micromark 迁移）处于后续阶段。

### v0.4.0

- 规范 Frontmatter 传递模型：解析器必须原样透传 YAML 文本，应用层使用 YAML parser 解析
- 新增 `use_frontmatter_from` 外部配置引用（应用层实现）
- `translation.render` 调整为 `translation.render_mode`

### v0.3.1

- 新增块级 Tech Cue（`<<< ... >>>` / `<<< ... <<<`）
- 代码保护区（围栏代码块与行内代码）内所有 DraMark 标记失效

## 开发命令

- `bun test:run`：运行解析器与插件测试
- `bun build`：构建核心包
- `bun build:vscode`：构建 VS Code 扩展
- `bun build:vscode:vsix`：打包 VSIX（调用扩展目录 `package:vsix`）
- `bun dev:web`：启动 Web MVP 开发服务
- `bun build:web`：构建 Web MVP

## 与 CommonMark 的关系

DraMark 是 CommonMark 的超集方言。所有 CommonMark 格式（`*斜体*`、`**加粗**`、列表、引用等）完全保留。

## Frontmatter 配置

DraMark 支持通过标准的 YAML frontmatter 定义剧本元信息、角色清单、译配配置和技术资源字典。解析器会提取 frontmatter 原文，并提供最小可用的元信息（如 `translation.enabled`）供上层消费。

Frontmatter 作为文档配置层存在，不属于 DraMark 正文语法本体；解析后通常交由前端/渲染器消费。

推荐配置命名空间：`meta`、`casting`、`translation`、`tech`。其中 `translation.render` 已更名为 `translation.render_mode`。`group` 仅在 `casting.groups` 定义，正文 `@` 不重复声明分组；`tech` 推荐使用 `mics/sfx/lx/keywords` 四类字典（同类内 `id` 唯一，未知字段可透传）。

`translation.render_mode` 是可选渲染提示字段（如 `bilingual`）。解析器不会将其视为语法前置条件；交互式前端/扩展可由运行时设置覆盖该值（例如预览面板中的译配模式切换）。在无头渲染/导出场景，可优先读取该字段作为默认输出策略。

兼容策略：默认不要求角色 `id`。在不重名场景下，`@角色` 匹配和 `casting.groups.*.members` 均可直接按 `name` 生效；仅在重名或跨系统关联时建议补 `id`。

角色元信息可选字段：`actor?`（演员名）与 `mic?`（默认麦克风，通常也是开场麦，建议引用 `tech.mics[].id`）。

换麦扩展当前为草案，建议在 app/扩展层实现（非 parser 强制语法）：可通过 `tech.micDirectives` 与 `tech.defaultMicBehavior` 自定义关键词和默认行为。
parser 识别 Tech Cue 外层边界并保留其 payload 原文；payload 内基础 DraMark/CommonMark 语义可按既有规则正常解析，但扩展关键词解释仍由 app/扩展层处理。

## 实现对齐说明（main）

- 语言规范以 Block Stack 为目标模型；main 分支已移除 legacy 集成路径，统一为 micromark-only + DraMark multipass。
- multipass 不是“性能优化”，而是正确性约束。单遍解析会在以下位置产生冲突：
  1. `<<...>>`、`$...$`、`{...}` 可能被 CommonMark 词法路径提前消费。
  2. Block Stack 闭合顺序（Translation/Character/Song）会被行内容器污染。
  3. 代码保护区（fence/inline code）中的 DraMark 标记若误识别会污染 AST。
  4. 若先做 DraMark 再做 CommonMark，列表/引用/代码块容易退化成普通段落。
- 当前管线采用 3-4 pass（运行时允许折叠阶段）：

| Pass           | 输入               | 输出                          | 职责                                          |
| -------------- | ------------------ | ----------------------------- | --------------------------------------------- |
| Pass 0         | 原始文本           | frontmatter 元数据 + 正文切片 | frontmatter 原文透传与最小开关判定            |
| Pass 1         | 正文文本           | micromark 词法边界            | 先锁定行内标记边界，避免 `<<...>>` 等被吞掉   |
| Pass 2         | 行流 + 词法边界    | Block Stack 结构段            | 执行 `@/$$/!!/=/%/<<<` 的根级触发与确定性闭合 |
| Pass 3         | 各结构段 markdown  | CommonMark mdast 内容块       | 保留 paragraph/list/blockquote/code 等结构    |
| Pass 4（可选） | 含保护占位的中间树 | 最终 AST                      | 还原保护块，确保代码保护区字面量不丢失        |

- 已实现：`$$` 标题、`!!` 念白段落、`inline-spoken`、`@@`、单行 `=` 退出译配、角色声明独占行校验（strict/compat）、引号角色名、frontmatter 原文透传、root-level 容器隔离（通过顶格指令门禁实现）。
- 当前 parser warning code：`UNCLOSED_BLOCK_COMMENT`、`UNCLOSED_BLOCK_TECH_CUE`、`UNCLOSED_SONG_CONTAINER`、`TRANSLATION_OUTSIDE_CHARACTER`、`CHARACTER_DECLARATION_NOT_STANDALONE`、`INVALID_CHARACTER_NAME`、`DEPRECATED_INLINE_CHARACTER_DECLARATION`、`EXTERNAL_FRONTMATTER_FETCH_FAILED`、`EXTERNAL_FRONTMATTER_PARSE_FAILED`。
- 尚未实现的规范条目仅剩外部 frontmatter 拉取执行链路（应用层能力，不属于 parser 语法层强制行为）。
- 调试能力：可通过 `parseDraMark(..., { multipassDebug: true })` 输出 pass0/pass1/pass2 快照，便于排查词法抢占与结构闭合问题。
- 可选开关：`pass4Restore` 默认开启；可显式关闭以对比 pass4 还原阶段行为。插件模式下同样可在 `file.data.dramark.multipassDebug` 读取到 pass4 状态。

## 规范文档

详见 [**DraMark Language Specification**](spec/spec.md)，包含：

- Block Stack 解析模型详解（规范目标模型）
- 完整的边缘情况裁决 (Edge Cases)
- 解析器实现指引
- 输入法与编辑器体验优化建议

## 许可证

本仓库按目录分层授权：

| 路径                                    | 许可证        |
| --------------------------------------- | ------------- |
| `/`（核心发布包）、`src/`、`apps/core/` | Apache-2.0    |
| `apps/vscode-extension/`                | MIT           |
| `apps/web/`                             | AGPL-3.0-only |
| `docs/`、`spec/`                        | CC BY 4.0     |

详见各目录下的 `LICENSE` 文件与根目录 `NOTICE`。
