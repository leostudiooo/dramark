# DraMark Language Specification

**Version**: 0.3.0 (pre-v1)  
**Date**: 2026-03-19  
**Status**: Official Release

## 目录

1. [概述](#1-概述)
2. [与 CommonMark 的关系](#2-与-commonmark-的关系)
3. [核心解析模型：Block Stack](#3-核心解析模型block-stack)
4. [文档配置层 (Frontmatter)](#4-文档配置层-frontmatter)
5. [角色与台词 (CharacterBlock)](#5-角色与台词-characterblock)
6. [场景动作与结构分隔 (GlobalBlock)](#6-场景动作与结构分隔-globalblock)
7. [唱段与音乐容器 (SongBlock)](#7-唱段与音乐容器-songblock)
8. [译配与多语言模式 (TranslationBlock)](#8-译配与多语言模式-translationblock)
9. [技术提示标记 (Attached Node)](#9-技术提示标记-attached-node)
10. [注释](#10-注释)
11. [转义字符](#11-转义字符)
12. [解析器实现指引与边缘情况裁决](#12-解析器实现指引与边缘情况裁决)
13. [语法分层与兼容矩阵](#13-语法分层与兼容矩阵)
14. [AST 最小模型](#14-ast-最小模型)
15. [附录：输入法与编辑器体验优化](#15-附录输入法与编辑器体验优化)

---

## 1. 概述

DraMark 是一门专为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言。其核心目标为：

1. **少输入法切换 (IME-Friendly)**：核心符号 `@`, `%`, `=` 在中文键盘下可直接通过 Shift 键打出，保证编剧创作心流不断。
2. **结构优先 (Structure over Tags)**：摒弃繁琐的闭合标签，通过明确的块级语法（Block Grammar）定义台词、唱段和舞台动作的作用域。
3. **原生译配支持 (Native Translation Workflow)**：内建强大的双语译配工作流，一份源文件可编译为演员本、导演本、工作本。
4. **技术工作流融合 (Tech Workflow Integration)**：将技术提示与艺术创作无缝集成，提升整体创作效率。

---

## 2. 与 CommonMark 的关系

DraMark 是 CommonMark 的结构扩展方言：

- DraMark 解析器在生成 AST 时，**保留**所有 CommonMark 的基础区块（如段落、列表、引用块）。
- 通过**语义注入（Semantic Attachment）**将 CommonMark 块归属于特定角色或动作节点。
- 所有的 CommonMark 行内格式（如 `*斜体*`、`**加粗**`）在 DraMark 中完全保留。

YAML Frontmatter 在本规范中被定义为**文档配置层（Document Config Layer）**，用于为编辑器/渲染器/编译器提供配置数据；它不属于 DraMark 正文语法本体。

---

## 3. 核心解析模型：Block Stack

DraMark 解析器 **必须** 维护一个 **Block Stack（块栈）**。解析过程遵循：

```
输入流 → Token → Block Stack 操作（关闭/打开）→ AST
```

### 3.1 语法分层

DraMark 语法分为三个层级：

1. **Structural Blocks（结构块）**：参与栈操作，具有开启/关闭语义和作用域控制
   - `GlobalBlock`（隐式根）
   - `CharacterBlock`
   - `SongBlock`
   - `TranslationBlock`

2. **Content Blocks（内容块）**：CommonMark 标准区块，作为结构块的内容承载
   - 段落、列表、引用块、代码块等

3. **Attached Nodes（附着节点）**：不参与栈操作，不改变解析状态，附着于最近的语义容器
   - `TechCue`（技术提示）
   - `Comment`（注释）

### 3.2 Block 嵌套关系

```
GlobalBlock（隐式根）
 ├─ CharacterBlock
 │   └─ TranslationBlock
 └─ SongBlock
     └─ CharacterBlock
         └─ TranslationBlock
```

### 3.3 统一闭合算法（Deterministic Closing Strategy）

当一个指令触发结构变化时，解析器必须执行：

```python
onToken(T):
  while top(blockStack) is incompatible with T:
    close(top)
  apply(T)
```

**语义层级闭合顺序**（从内到外）：

```
Translation → Character → Song
```

即：**始终先关闭语义最内层，再处理外层结构。**

### 3.4 GlobalBlock 内容语义

当解析器不处于 `CharacterBlock` 或 `SongBlock` 内时，即处于 `GlobalBlock`。在此状态下：

- 所有文本被解析为**场景动作（Global Action）**
- 支持完整的 CommonMark 语法
- 支持所有 Attached Nodes（Tech Cue、Comment）
- 支持 `TranslationBlock`（无角色语境的独立译配）

---

## 4. 文档配置层 (Frontmatter)

文档可由 YAML Frontmatter 块开头，用于提供剧本配置数据。该配置块在解析前优先提取，并交由上层系统消费。

```yaml
---
meta:
  title: 悲惨世界 (Les Misérables)
  locale: zh-CN
  version: 0.3.0
casting:
  characters:
    - name: 冉阿让
      actor: 张三
      mic: HM1
      aliases: [24601]
translation:
  enabled: true
  source_lang: en
  target_lang: zh-CN
  render: bilingual
tech:
  mics:
    - id: HM1
      label: Hamlet 主麦
      color: "#4B8BFF"
  keywords:
    - token: blackout
      label: 黑场
---
```

### 4.1 解析器职责

- **必须**提取 frontmatter 原文供上层归一化
- **必须**透传未知字段（forward-compatible）
- **不负责**严格业务 schema 校验或消费端呈现策略

---

## 5. 角色与台词 (CharacterBlock)

### 5.1 进入角色

**语法**：`@<角色名>[<情绪/状态提示>]` 或 `@<角色名>【<情绪/状态提示>】`

**触发操作**：
```
close: TranslationBlock, CharacterBlock
open: CharacterBlock
```

**多角色声明**：允许同一行多个角色标识（例如 `@peter @bobby [aside]`），按实现约定生成主角色与别名列表。

### 5.2 内容吞噬

一旦进入 `CharacterBlock`，后续的 CommonMark 区块（段落、列表、引用块等）均作为该角色的**台词内容 (Dialogue Content)**，直到遇到状态重置指令。

```markdown
@哈姆雷特
我有两个选择：

- 生
- 还是死
```

### 5.3 动作提示 (Inline Action)

台词内部的身体动作使用 `{}` 包裹。全角 `｛｝` 与半角 `{}` 等价。

**语法**：`你给我出去！{指着大门}`

### 5.4 显式退出

**语法**：独占一行的 `@@`（不包含其他文本）

**触发操作**：
```
close: TranslationBlock, CharacterBlock
```

**语义**：`@@` 作为一个显式的状态边界标记，不生成 AST 节点，仅触发栈关闭操作。

---

## 6. 场景动作与结构分隔 (GlobalBlock)

### 6.1 结构级标记

**触发 Token**：`---`（水平线）、`#` / `##` 等（ATX 标题）

**触发操作**：
```
close: TranslationBlock, CharacterBlock
```

**特性**：
- 这些标记本身被保留在 AST 中作为文档结构元素
- **仅在根级别生效**；在嵌套容器（列表项、引用块）内部不触发状态重置

### 6.2 状态重置示例

```markdown
@冉阿让
我该何去何从？

---

就在此时，警长沙威猛地推开了大门。（⚠️ 已回到 GlobalBlock）
```

---

## 7. 唱段与音乐容器 (SongBlock)

### 7.1 进入唱段

**语法**：独占一行的 `$$`

**触发操作**：
```
close: TranslationBlock, CharacterBlock
open: SongBlock
```

`$$` 是一个**宏观曲目容器**。在其内部，DraMark 指令依然运作，但作用域被限制在音乐中。

### 7.2 唱段内部规则

- **遇到 `@角色名`**：不退出唱段，仅切换演唱者（支持多角色对唱/合唱）
- **遇到 `---`**：不退出唱段，仅将表演状态切回 `GlobalBlock`（表示间奏或音乐伴奏下的舞台调度）

### 7.3 显式退出

**语法**：独占一行的 `$$`

**触发操作**：
```
close: SongBlock
```

### 7.4 标题穿透（隐式退出）

**触发 Token**：根级别的 `#` 或 `##` 等级别标题

**触发操作**：
```
close: SongBlock
```

**注意**：隐式穿透仅在整行且非嵌套的情况下有效。

### 7.5 行内唱段 (Inline Song)

在同行内使用 `$<唱词>$`，用于对白与短促唱词的无缝衔接。

**实现裁决**：在 `$$` 唱段上下文（`SongBlock`）内，`$...$` **不解析为 inline-song**，回退为普通文本，避免嵌套语义冲突。

---

## 8. 译配与多语言模式 (TranslationBlock)

### 8.1 进入译配

**语法**：`=␠<原文>`（等号后必须跟一个空格）

**触发操作**：
```
close: TranslationBlock
open: TranslationBlock
```

### 8.2 内容结构

`TranslationBlock` 包含：
- **source**: 行内文本（原文）
- **target**: 块级节点数组（译文，可包含段落、列表、加粗等格式）

### 8.3 吞噬规则（Target Capture）

`TranslationBlock` 开启后，后续的所有 CommonMark 区块均作为 **target** 内容被吞噬，直到遇到闭合触发器。

### 8.4 隐式闭合触发

以下条件自动闭合当前 `TranslationBlock`：

1. 新的 `=␠`（下一句原文开始）
2. `@`（切换角色）
3. `$$`（进入唱段）
4. `---` 或 `#`（根级别结构标记）
5. EOF（文档结束）

### 8.5 显式退出

**语法**：独占一行的 `=`（不包含其他内容）

**触发操作**：
```
close: TranslationBlock
```

**示例**：

```markdown
@冉阿让
= Who am I?
我是谁？
= Can I conceal myself?
我能否隐瞒真相？

=
（无需再配对，直接回到普通对白模式）
但我的良心永不允许。
```

### 8.6 词法约束（严格）

- `=␠` → 译配起始（等号+空格+原文）
- `=`（独占一行）→ 译配退出
- 其他形式的 `=` → 普通文本，**不解析**为 DraMark 指令

---

## 9. 技术提示标记 (Attached Node)

Tech Cue 是一种**附着型语义节点（Attached Node）**，用于表达技术调度信息（灯光、音效、麦克风等）。

**核心特性**：
- **不参与 Block Stack**，不触发任何 Block 的开启或关闭
- **不改变解析状态**
- **可出现在任意 Block 内**或 `GlobalBlock` 中
- 解析后附着于最近的语义容器（Block 或 Inline 位置）

### 9.1 行内技术标记

**语法**：`<<内容>>`

**附着位置**：当前 inline flow（通常是段落或台词）

```markdown
@A
你来了。<<LX01 GO>>
```

### 9.2 块级技术标记

**语法**：`<<<内容>>>`（独占一行或多行）

**附着位置**：当前 Block（`CharacterBlock` 内属于该角色语境，`GlobalBlock` 内属于场景动作，`SongBlock` 内属于唱段技术提示，仅决定附着位置，实际上这三种情况没有语义区别）

```markdown
@A
你来了。
<<<
LX01 GO
SFX Thunder.mp3
>>> % 这是一个块级技术提示，附着于当前角色的语境中
你知道我等你等了多久吗？{厉声}  % 这句话仍然属于角色台词，只是在技术提示之后
```

### 9.3 解析规则

1. **必须显式闭合**：未闭合的 `<<` 或 `<<<` 降级为普通文本
2. **严禁跨行**：行内标记 `<<...>>` 内部不允许包含换行符（`\n`）
3. **词法抢占权**：Tech Cue 具有超越 HTML 解析的优先权，一旦匹配，内部文本作为普通文本处理，不参与 HTML 解析

### 9.4 麦克风换麦扩展（简洁语法）

应用层可通过简洁语法在 Tech Cue 中识别换麦指令，**不依赖关键词配置**：

| 语法 | 含义 | 角色来源 | 源麦来源 |
|------|------|----------|----------|
| `<<=HM2>>` | 切到 HM2 | 当前 `@角色` 上下文 | 角色默认麦 |
| `<<角色=HM2>>` | 角色切到 HM2 | 显式指定 | 角色默认麦 |
| `<<HM1->HM2>>` | 从 HM1 切到 HM2 | 当前 `@角色` 上下文 | 显式指定 |
| `<<角色:HM1->HM2>>` | 角色从 HM1 切到 HM2 | 显式指定 | 显式指定 |

**歧义处理**：若角色名与麦 ID 存在歧义，优先匹配角色名。

---

## 10. 注释 (Attached Node)

注释是另一种 **Attached Node**，仅在源文件或特定工作版渲染目标中可见。

### 10.1 行注释

**语法**：`% 注释内容`

**规则**：
- 行首第一个非空字符是 `%` → 整行为注释
- 行内注释：其**左侧必须至少包含一个空白字符**（即 `␠%`），紧跟在非空白字符后的 `%` 视为普通文本

```markdown
% 这是注释
利润下降了 20%    % 这是普通文本，% 前无空格
利润下降了 20 %   % 这是注释，% 前有空格
```

### 10.2 块注释

**语法**：`%%` 独占一行开始，`%%` 独占一行结束。

```markdown
%%
此处为块注释
可包含多行内容
%%
```

---

## 11. 转义字符

支持使用反斜杠 `\` 转义 DraMark 功能字符，使其降级为普通文本。

**合法转义序列**：`\@`, `\$`, `\{`, `\}`, `\%`, `\<`, `\=`, `\>`

---

## 12. 解析器实现指引与边缘情况裁决

### 裁决一：Frontmatter 预处理豁免权

文档首部的 `---`（YAML 边界符）具有第零优先级。解析器在预处理阶段消耗掉前两个独占行的 `---`，它们**绝对不触发**任何 DraMark 状态重置逻辑。

### 裁决二：容器隔离原则（Container Isolation）

`---`、`#`、`@@`、`=` 等具有状态重置能力的标记，**仅在文档根级别（Root-level）有效**。

如果出现在 CommonMark 嵌套容器（如 `>` 引用块、`-` 列表项）内部，它们受容器隔离保护，**失效并降级为普通文本**。

### 裁决三：单层决策原则（Single Decision Per Line）

每一行 Token 仅触发**最高优先级**的规则。跨行输入按行序依次应用，后续行可继续触发新的状态迁移。

### 裁决四：Block 关闭统一规则

所有冲突通过 **LIFO close + incompatibility check** 解决。当 `Token` 与当前栈顶 `Block` 不兼容时，持续弹出栈顶直到兼容或栈空，然后应用 `Token`。

### 裁决五：Tech Cue 不跨行

行内标记 `<<...>>` 内部不允许包含换行符。若当前行扫描到了 `<<` 但行尾前未找到匹配的 `>>`，则放弃解析为 Tech Cue，降级为普通文本。

### 裁决六：百分号防误伤

为防止 `%` 误伤日常文本（如“利润下降了 20%”）：
- 行首注释：`%` 是该行第一个非空字符
- 行内注释：其左侧必须至少有一个空白字符

---

## 13. 语法分层与兼容矩阵

### 13.1 Token 与 Block 关闭关系

| Token | 关闭的 Block（按 LIFO 顺序） | 打开的 Block |
|-------|---------------------------|-------------|
| `@角色` | `TranslationBlock`, `CharacterBlock` | `CharacterBlock` |
| `$$` | `TranslationBlock`, `CharacterBlock` | `SongBlock` |
| `=␠原文` | `TranslationBlock` | `TranslationBlock` |
| `=`（单行） | `TranslationBlock` | - |
| `@@` | `TranslationBlock`, `CharacterBlock` | - |
| `---` / `#` | `TranslationBlock`, `CharacterBlock` | -（保留为 CommonMark 结构） |
| `$$`（结束） | `SongBlock` | - |
| `#`（在 SongBlock 内） | `SongBlock` | -（保留为标题） |

### 13.2 语法特性速查

| 特性 | 类型 | 是否入栈 | 显式闭合 | 隐式闭合触发 |
|------|------|---------|---------|-------------|
| `CharacterBlock` | Structural | 是 | `@@` | `@`, `$$`, `---`, `#` |
| `SongBlock` | Structural | 是 | `$$` | `#`（穿透） |
| `TranslationBlock` | Structural | 是 | `=`（单行） | `@`, `$$`, `---`, `#`, `=␠` |
| `TechCue` | Attached | 否 | 必须（`>>`/`>>>`） | - |
| `Comment` | Attached | 否 | 自动（行尾/块结束） | - |

---

## 14. AST 最小模型

```typescript
interface Document {
  frontmatter: any;
  blocks: Block[];
}

type Block = 
  | GlobalAction
  | CharacterBlock
  | SongBlock
  | TranslationBlock
  | CommonMarkBlock; // 段落、列表、引用块等

interface CharacterBlock {
  type: "CharacterBlock";
  character: string;
  context?: string; // 情绪/状态提示
  children: (Dialogue | AttachedNode)[];
}

interface SongBlock {
  type: "SongBlock";
  children: (CharacterBlock | GlobalAction | AttachedNode)[];
}

interface TranslationBlock {
  type: "TranslationBlock";
  source: InlineContent[];
  target: Block[]; // Array of Blocks，支持多段落、列表等
}

interface Dialogue {
  type: "Dialogue";
  content: InlineContent[]; // 包含 CommonMark 行内元素和 InlineAction
}

interface GlobalAction {
  type: "GlobalAction";
  content: Block[]; // CommonMark 区块
}

interface TechCue {
  type: "TechCue";
  variant: "inline" | "block";
  content: string;
}

interface Comment {
  type: "Comment";
  variant: "line" | "block";
  content: string;
}
```

---

## 15. 附录：输入法与编辑器体验优化 (IME Tricks)

DraMark 的设计恪守 ASCII 字符底座，但强烈建议各大编辑器（VS Code 插件、Obsidian 插件等）在应用层实现以下静默映射（IME Tricks）：

当侦测到用户在全角/中文输入法状态下连续键入以下符号时，应**自动替换**为 DraMark 标准标记：

1. **技术标记**：输入 `《《` 自动转为 `<<`，输入 `》》` 自动转为 `>>`。
2. **唱段标记**：输入 `￥￥`（Shift+4 连按）自动转为 `$$`。
3. **动作提示**：输入 `【【` 自动转为 `{`，输入 `】】` 自动转为 `}`。

---

**DraMark：专为戏剧工作者设计的无干扰语义写作语言。**