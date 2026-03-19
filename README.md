# 🎭 戏码 DraMark

> DraMark: **Dra**ma **Mark**down
> 中文名“戏码”寓意剧本创作的“代码”，同时也暗含“一场戏”的意思，强调其作为剧本创作工具的核心定位。

专为戏剧、影视及音乐剧设计的纯文本标记语言，助力剧本创作、排练和演出的全流程。

## 亮点

1. **少输入法切换 (Few IME Switch)** — 核心符号 `@`, `%`, `=` 在中文键盘下可直接通过 Shift 键打出，保证编剧创作心流不断
2. **结构优先 (Structure over Tags)** — 通过块级语法（Block Grammar）定义台词、唱段和舞台动作的作用域，无需闭合标签
3. **原生译配支持 (Native Dual-track)** — 内建译配工作支持，可单语或双语渲染，满足从引进到原创的多样化需求
4. **唱段与念白切换** — 唱段内可通过 `!!` 临时插入念白段落，音乐剧剧本创作更自然
5. **技术标记 (Tech Cues)** — 支持行内 `<<>>` 与块级 `<<< >>>` 技术提示，助力剧本与舞台设计的无缝对接
6. **兼容 CommonMark** — 作为 CommonMark 的超集方言，保留所有基础格式（如 `*斜体*`、`**加粗**`、列表、引用等）
7. **一份源文件，多种剧本** — 通过角色分组与译配配置，一份 DraMark 文件可编译为演员本、导演本、工作本等多种版本

## 快速示例

```markdown
---
meta:
  title: 悲惨世界 (Les Misérables)
  author: 维克多·雨果 (Victor Hugo)
  locale: zh-CN
translation:
  enabled: true
  source_lang: en
  target_lang: zh-CN
  render_mode: bilingual
casting:
  characters:
    - name: 冉阿让
      actor: 张三
      mic: HM1
      aliases: [24601]
  groups:
    principals:
      members: [冉阿让]
tech:
  mics:
    - id: HM1
      label: Hamlet 主麦
      color: "#4B8BFF"
  sfx:
    - id: SND_THUNDER
      file: thunder.mp3
      desc: 雷声
  lx:
    - id: LX01
      desc: 冷白顶光
      color: "#E6EEFF"
  keywords:
    - token: blackout
      label: 黑场
      color: "#111111"
---

@冉阿让
= Who am I?
我是谁？
= Can I conceal myself for evermore?
我能否永远把我自己隐藏？
假装我不再是过去的那个我？

---

警长贾维尔猛地推开了大门。

@贾维尔[怒吼]
你跑不掉了！{拔剑}

$$
@珂赛特
= In my life, there is so much I do not understand.
人生中有太多我不明白的事——
$$
```

## 核心语法速查

| 符号           | 用途                      | 示例                   | 当前实现（main） |
| -------------- | ------------------------- | ---------------------- | ---------------- |
| `@角色名`      | 角色声明，进入台词模式    | `@哈姆雷特`            | 已支持 |
| `@"角色 名"`   | 含空格姓名（推荐引号）    | `@"冉 阿让"`           | 规范目标（尚未完整支持） |
| `@A @B [情绪]` | 多角色声明（主名+别名）   | `@peter @bobby [aside]`| 已支持（未加引号解析） |
| `@@`           | 显式退出角色模式          | `@@`                   | 规范目标（尚未支持） |
| `---`          | 场景切分 / 重置为全局动作 | `---`                  | 已支持 |
| `% 注释`       | 行注释（译配注、直译）    | `% 直译：我是谁？`     | 已支持（root-level 指令） |
| `%% ... %%`    | 块注释                    |                        | 已支持 |
| `= 原文`       | 译配模式：标记原文行      | `= To be or not to be` | 已支持 |
| `=`            | 显式退出译配模式          |                        | 规范目标（尚未支持） |
| `$$`           | 唱段容器（音乐剧）        | `$$ ... $$`            | 已支持 |
| `$$ 标题`      | 带标题的唱段              | `$$ My Shot`           | 已支持 |
| `!!`           | 念白段落（唱段内切换）    | `!! ... !!`            | 已支持 |
| `$唱词$`       | 行内短唱（对白上下文）    | `今天$我要飞翔$`       | 已支持 |
| `{动作}`       | 行内身体动作提示          | `给我出去！{指着门}`   | 已支持 |
| `<<LX01 GO>>`  | 行内技术 Cue              | `<<SND: Thunder.mp3>>` | 已支持 |
| `<<< ... >>>`  | 块级技术 Cue              |                        | 部分支持（`>>>` 主闭合） |

## 更新日志

### v0.4.1

- `$$` 唱段开启标记允许后跟空格与文本，作为歌曲标题/说明（如 `$$ My Shot`），存储在 `SongBlock.title` 字段
- 新增念白标记 `!!`：在唱段内开启/关闭念白段落，`!!` 关闭后自动回到唱段上下文
- 明确 GlobalBlock 语义：默认状态即为"念白"，无需额外标记

说明：角色声明独占行、引号空格姓名、`@@` 与 `=` 显式退出等条目已在规范定义，但当前 main 分支尚未完整实现，详见下文“实现对齐说明”。

### v0.4.0

- 规范 Frontmatter 传递模型：解析器必须原样透传 YAML 文本，应用层使用 YAML parser 解析
- 新增 `use_frontmatter_from` 外部配置引用（应用层实现）
- `translation.render` 调整为 `translation.render_mode`

### v0.3.1

- 新增块级 Tech Cue（`<<< ... >>>` / `<<< ... <<<`）
- 代码保护区（围栏代码块与行内代码）内所有 DraMark 标记失效

## 开发命令

- `pnpm test:run`：运行解析器与插件测试
- `pnpm build`：构建核心包
- `pnpm dev:web`：启动 Web MVP 开发服务
- `pnpm build:web`：构建 Web MVP

## 与 CommonMark 的关系

DraMark 是 CommonMark 的超集方言。所有 CommonMark 格式（`*斜体*`、`**加粗**`、列表、引用等）完全保留。

## Frontmatter 配置

DraMark 支持通过标准的 YAML frontmatter 定义剧本元信息、角色清单、译配配置和技术资源字典。解析器会提取 frontmatter 原文，并提供最小可用的元信息（如 `translation.enabled`）供上层消费。

Frontmatter 作为文档配置层存在，不属于 DraMark 正文语法本体；解析后通常交由前端/渲染器消费。

推荐配置命名空间：`meta`、`casting`、`translation`、`tech`。其中 `translation.render` 已更名为 `translation.render_mode`。`group` 仅在 `casting.groups` 定义，正文 `@` 不重复声明分组；`tech` 推荐使用 `mics/sfx/lx/keywords` 四类字典（同类内 `id` 唯一，未知字段可透传）。

兼容策略：默认不要求角色 `id`。在不重名场景下，`@角色` 匹配和 `casting.groups.*.members` 均可直接按 `name` 生效；仅在重名或跨系统关联时建议补 `id`。

角色元信息可选字段：`actor?`（演员名）与 `mic?`（默认麦克风，通常也是开场麦，建议引用 `tech.mics[].id`）。

换麦扩展建议在 app/扩展层实现（非 parser 强制语法）：可通过 `tech.micDirectives` 与 `tech.defaultMicBehavior` 自定义关键词和默认行为。

## 实现对齐说明（main）

- 语言规范以 Block Stack 为目标模型，当前 `legacy` 解析器仍是“分段扫描 + 汇编”实现路径。
- 已实现：`$$` 标题、`!!` 念白段落、`inline-spoken`、frontmatter 原文透传、root-level 容器隔离（通过顶格指令门禁实现）。
- 尚未实现的规范条目：`@@`、单行 `=` 显式退出译配、角色声明独占行校验、引号角色名完整解析、外部 frontmatter 拉取相关 warning 码。
- 当前 warning code 仅有 4 个：`UNCLOSED_BLOCK_COMMENT`、`UNCLOSED_BLOCK_TECH_CUE`、`UNCLOSED_SONG_CONTAINER`、`TRANSLATION_OUTSIDE_CHARACTER`。
- `micromark` 模式目前只做行内 tokenization；块级语义仍不由 micromark 产出自定义节点。

## 规范文档

详见 [**DraMark Language Specification**](spec/spec.md)，包含：

- Block Stack 解析模型详解（规范目标模型）
- 完整的边缘情况裁决 (Edge Cases)
- 解析器实现指引
- 输入法与编辑器体验优化建议

## 许可证

[Apache License 2.0](LICENSE)

Copyright (c) 2026 DraMark Contributors
