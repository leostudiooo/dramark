# DraMark Language Specification

**Version:** 0.3.1  
**Date:** 2026-03-19  
**Status:** Draft

**Changelog (0.3.0 → 0.3.1):**

- 引入**代码保护区（Code Sanctuary）**机制，确立围栏代码块和行内代码为语法黑洞，解决与 C++ 模板/位移操作符的冲突
- 重构 **Tech Cue** 为三层形态：行内 Attached Node（`<<>>`）、单行块级（`<<< >>>`）、多行块级（围栏 `<<<`...`>>>` 或 `<<<`...`<<<`）
- 确立**行尾闭合优先原则（Trailing Rule）**：处于 TechCueBlock 内时，行尾 `>>>` 强制识别为闭合标记，不参与 CommonMark 引用解析
- 新增**裁决九（代码保护区优先）**与**裁决十（Tech Cue 单层块级原则）**

## 目录

1. 概述
2. 与 CommonMark 的关系
3. 核心解析模型：Block Stack
4. 文档配置层 (Frontmatter)
5. 角色与台词 (CharacterBlock)
6. 场景动作与结构分隔 (GlobalBlock)
7. 唱段与音乐容器 (SongBlock)
8. 译配与多语言模式 (TranslationBlock)
9. 技术提示标记 (Tech Cue)
10. 注释
11. 转义字符
12. 解析器实现指引与边缘情况裁决
13. 语法分层与兼容矩阵
14. AST 最小模型
15. 解析器实现架构指引  
    附录 A：向后兼容性说明  
    附录 B：输入法与编辑器体验优化

## 1. 概述

DraMark 是一门专为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言。其核心目标为：

- **少输入法切换 (IME-Friendly)**：核心符号 `@`, `%`, `=`, `$` 在中文键盘下可直接通过 Shift 键打出，保证编剧创作心流不断。
- **结构优先 (Structure over Tags)**：摒弃繁琐的闭合标签，通过明确的块级语法（Block Grammar）定义台词、唱段和舞台动作的作用域。
- **原生译配支持 (Native Translation Workflow)**：内建强大的双语译配工作流，一份源文件可编译为演员本、导演本、工作本。
- **技术与艺术解耦 (Tech vs Performance Separation)**：将舞台监督的 Cue 标记与角色演出文本彻底分离，定义为不参与结构控制的附着节点（或独立技术块）。
- **代码安全 (Code Sanctuary)**：确保在剧本中引用技术文档、代码片段（如科幻题材中的 C++ 模板 `vector<vector<int>>`）时，不会被误解析为标记语法。

## 2. 与 CommonMark 的关系

DraMark 是 CommonMark 的结构扩展方言：

- DraMark 解析器在生成 AST 时，保留所有 CommonMark 的基础区块（如段落、列表、引用块、代码块）。
- 通过语义注入（Semantic Attachment）将 CommonMark 块归属于特定角色或动作节点。
- 所有的 CommonMark 行内格式（如 `*斜体*`、`**加粗**`）在 DraMark 中完全保留。
- **代码保护区**：CommonMark 的围栏代码块（Fenced Code Blocks）和行内代码（Inline Code）具有最高词法优先级，内部所有 DraMark 特殊标记失效。
- YAML Frontmatter 在本规范中被定义为文档配置层（Document Config Layer），用于为编辑器/渲染器/编译器提供配置数据；它不属于 DraMark 正文语法本体。

## 3. 核心解析模型：Block Stack

DraMark 解析器 **必须** 维护一个 Block Stack（块栈）。解析过程遵循：

```
输入流 → Token → Block Stack 操作（关闭/打开）→ AST
```

### 3.1 语法分层

DraMark 语法分为三个层级：

**Structural Blocks（结构块）**：参与栈操作，具有开启/关闭语义和作用域控制

- GlobalBlock（隐式根）
- CharacterBlock
- SongBlock
- TranslationBlock
- TechCueBlock（块级技术提示，v0.3.1 新增）

**Content Blocks（内容块）**：CommonMark 标准区块，作为结构块的内容承载

- 段落、列表、引用块、代码块等

**Attached Nodes（附着节点）**：不参与栈操作，不改变解析状态，附着于最近的语义容器

- TechCue（仅行内 `<< >>`）
- Comment（注释）

### 3.2 Block 嵌套关系

```
GlobalBlock（隐式根）
 ├─ CharacterBlock
 │   └─ TranslationBlock
 │   └─ TechCueBlock（块级）
 ├─ SongBlock
 │   ├─ CharacterBlock
 │   │   └─ TranslationBlock
 │   └─ TechCueBlock（块级）
 └─ TechCueBlock（块级，GlobalBlock 语境下的独立技术说明）
```

### 3.3 统一闭合算法（Deterministic Closing Strategy）

当一个指令触发结构变化时，解析器必须执行：

```python
onToken(T):
  while top(blockStack) is incompatible with T:
    close(top)
  apply(T)
```

**语义层级闭合顺序（从内到外）**：

```
Translation → TechCueBlock（块级）→ Character → Song
```

即：始终先关闭语义最内层，再处理外层结构。

### 3.4 GlobalBlock 内容语义

当解析器不处于 CharacterBlock 或 SongBlock 内时，即处于 GlobalBlock。在此状态下：

- 所有文本被解析为场景动作（Global Action）
- 支持完整的 CommonMark 语法（含代码块）
- 支持所有 Attached Nodes（行内 Tech Cue、Comment）
- 支持 TranslationBlock 与 TechCueBlock（块级）

### 3.5 代码保护区（Code Sanctuary）

**定义**：在 CommonMark 围栏代码块（以 ` ``` ` 或 `~~~` 标识）和行内代码（以 `` ` `` 包裹）内部，所有 DraMark 特殊语法均失效，内容视为**原始文本字面量（Raw Text Literal）**。

**保护范围**：
| 类型 | 起始标记 | 结束标记 | 保护内容 |
|------|----------|----------|----------|
| 围栏代码块 | ` ``` ` 或 `~~~`（及 info string） | 同等长度/类型的围栏标记 | 块内全部文本 |
| 行内代码 | `` ` ``（单个或双个反引号） | 匹配的起始标记 | 标记间全部文本 |

**保护区内失效的语法**：

- `@` 角色声明、`$$` 唱段标记、`=` 译配标记
- `<<...>>` / `<<<...>>>` Tech Cue（包括 C++ 模板语法 `vector<vector<int>>`）
- `%` 注释标记、`{}` 动作提示

**嵌套规则**：

- 围栏代码块内部的所有 DraMark Block 标记均**不触发栈操作**
- 行内代码内部**不识别**任何 DraMark 行内标记

## 4. 文档配置层 (Frontmatter)

文档可由 YAML Frontmatter 块开头，用于提供剧本配置数据。该配置块在解析前优先提取，并交由上层系统消费。

```yaml
---
meta:
  title: 悲惨世界 (Les Misérables)
  locale: zh-CN
  version: 0.3.1
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
      label: 主麦
      color: "#4B8BFF"
---
```

**解析器职责**：

- 必须提取 frontmatter 原文供上层归一化
- 必须透传未知字段（forward-compatible）
- 不负责严格业务 schema 校验或消费端呈现策略

## 5. 角色与台词 (CharacterBlock)

### 5.1 进入角色

**语法**：`@<角色名>[<情绪/状态提示>]` 或 `@<角色名>【<情绪/状态提示>】`

**触发操作**：

```python
close: TranslationBlock, TechCueBlock, CharacterBlock
open: CharacterBlock
```

**多角色声明**：允许同一行多个角色标识（例如 `@peter @bobby [aside]`），按实现约定生成主角色与别名列表。

### 5.2 内容吞噬

一旦进入 CharacterBlock，后续的 CommonMark 区块（段落、列表、引用块等）均作为该角色的台词内容 (Dialogue Content)，直到遇到状态重置指令。

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

```python
close: TranslationBlock, TechCueBlock, CharacterBlock
```

语义：`@@` 作为一个显式的状态边界标记，不生成 AST 节点，仅触发栈关闭操作。

## 6. 场景动作与结构分隔 (GlobalBlock)

### 6.1 结构级标记

**触发 Token**：`---`（水平线）、`#` / `##` 等（ATX 标题）

**触发操作**：

```python
close: TranslationBlock, TechCueBlock, CharacterBlock
```

**特性**：

- 这些标记本身被保留在 AST 中作为文档结构元素
- 仅在根级别生效；在嵌套容器（列表项、引用块）内部不触发状态重置

### 6.2 状态重置示例

```markdown
@冉阿让
我该何去何从？

---

就在此时，警长沙威猛地推开了大门。（⚠️ 已回到 GlobalBlock）
```

## 7. 唱段与音乐容器 (SongBlock)

### 7.1 进入唱段

**语法**：独占一行的 `$$`

**触发操作**：

```python
close: TranslationBlock, TechCueBlock, CharacterBlock
open: SongBlock
```

`$$` 是一个宏观曲目容器。在其内部，DraMark 指令依然运作，但作用域被限制在音乐中。

### 7.2 唱段内部规则

- 遇到 `@角色名`：不退出唱段，仅切换演唱者（支持多角色对唱/合唱）
- 遇到 `---`：不退出唱段，仅将表演状态切回 GlobalBlock（表示间奏或音乐伴奏下的舞台调度）
- 遇到 `<<<`：可开启 TechCueBlock（用于音乐技术提示），闭合后回到 SongBlock 语境

### 7.3 显式退出

**语法**：独占一行的 `$$`

**触发操作**：

```python
close: SongBlock
```

### 7.4 标题穿透（隐式退出）

**触发 Token**：根级别的 `#` 或 `##` 等级别标题

**触发操作**：

```python
close: SongBlock
```

注意：隐式穿透仅在整行且非嵌套的情况下有效。

### 7.5 行内唱段 (Inline Song)

在同行内使用 `$<唱词>$`，用于对白与短促唱词的无缝衔接。

**实现裁决**：在 `$$` 唱段上下文（SongBlock）内，`$...$` 不解析为 inline-song，回退为普通文本，避免嵌套语义冲突。

## 8. 译配与多语言模式 (TranslationBlock)

### 8.1 进入译配

**语法**：`=␠<原文>`（等号后必须跟一个空格）

**触发操作**：

```python
close: TranslationBlock
open: TranslationBlock
```

### 8.2 内容结构

TranslationBlock 包含：

- `source`: 行内文本（原文）
- `target`: 块级节点数组（译文，可包含段落、列表、加粗等格式）

### 8.3 吞噬规则（Target Capture）

TranslationBlock 开启后，后续的所有 CommonMark 区块均作为 target 内容被吞噬，直到遇到闭合触发器。

### 8.4 隐式闭合触发

以下条件自动闭合当前 TranslationBlock：

- 新的 `=␠`（下一句原文开始）
- `@`（切换角色）
- `$$`（进入唱段）
- `<<<`（进入块级 Tech Cue）
- `---` 或 `#`（根级别结构标记）
- EOF（文档结束）

### 8.5 显式退出

**语法**：独占一行的 `=`（不包含其他内容）

**触发操作**：

```python
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
- 其他形式的 `=` → 普通文本，不解析为 DraMark 指令

## 9. 技术提示标记 (Tech Cue)

Tech Cue 用于表达技术调度信息（灯光、音效、麦克风等）。v0.3.1 采用**分层设计**：

### 9.1 语法形态

| 形态                  | 类型             | 语法                               | 参与 Block Stack | 内容特性                                      |
| --------------------- | ---------------- | ---------------------------------- | ---------------- | --------------------------------------------- |
| **行内 Tech Cue**     | Attached Node    | `<<内容>>`                         | **否**           | 标准 CommonMark，不跨行                       |
| **单行块级 Tech Cue** | Structural Block | `<<< 内容 >>>`（行尾闭合）         | **是**           | 标准 CommonMark，独占一行                     |
| **多行块级 Tech Cue** | Structural Block | `<<<` ... `>>>` 或 `<<<` ... `<<<` | **是**           | 标准 CommonMark，可包含行内 Tech Cue 作为标签 |

### 9.2 行内 Tech Cue（Inline Attached）

**语法**：`<<内容>>`

- **闭合规则**：必须在**同一物理行**内闭合，否则整段（从 `<<` 到行尾）降级为普通文本（裁决五）
- **代码保护区**：在围栏代码块 ` ``` ` 或行内代码 `` ` `` 内**失效**（裁决九）
- **嵌套限制**：内部**不允许**再嵌套 `<< >>`

**示例**：

```markdown
@A
你来了。<<LX01 GO>>
```

### 9.3 块级 Tech Cue（Structural Block）

#### 9.3.1 单行形式

**语法**：独占一行，格式为 `<<<` + 内容 + `>>>`（行尾）

**触发操作**：

```python
close: TranslationBlock, CharacterBlock  # 按需关闭不兼容块
open: TechCueBlock
add_content(content)
close: TechCueBlock  # 立即关闭，瞬态块
```

**示例**：

```markdown
@A
台词内容。

<<<LX01 GO, LX02 READY>>> % 独立技术提示

继续台词。
```

#### 9.3.2 多行形式（围栏）

**开启触发**：独占一行的 `<<<`（后仅可接空白或行尾注释 `%`）

**闭合触发**（推荐方案）：

**对称形式（推荐）**：独占一行的 `<<<`

- **理由**：与 CommonMark 完全兼容。单独一行的 `>>>` 会被 CommonMark 解析器误识别为三级引用（`>>>`），造成兼容性问题。
- **闭合优先级**：行首 `<<<` 在 TechCueBlock 内触发对称闭合

**行尾形式（备选）**：末行行尾的 `>>>`（后仅可接空白或注释 `%`）

- **前提**：`>>>` 必须位于行尾，不可独占一行
- **优势**：节省空间，适合单行内容
- **注意**：仅在行尾有效；独占一行会被 CommonMark 引用块解析器拦截

**Block Stack 操作**：

```python
onToken("<<<_LINE"):  # 行首 <<<
  if peek(blockStack) is TechCueBlock:
    # 对称闭合（推荐）
    close(TechCueBlock)
  else:
    # 开启新的 Tech Cue
    while top incompatible with TechCueBlock:
      close(top)
    open(TechCueBlock)

onToken(">>>_TRAILING"):  # 仅行尾 >>>
  if peek(blockStack) is TechCueBlock:
    close(TechCueBlock)
  else:
    # 不在 Tech Cue 内，降级为普通文本
    emit(TEXT(">>>"))
```

#### 9.3.3 内部嵌套规则

**允许**：块级 Tech Cue 内部包含**行内 Tech Cue** `<< ... >>` 作为**标签/细化标记**

```markdown
<<<
灯光：面光渐暗 <<LX01-FADE>>
音效：雨声入 <<SND-RAIN-01>>
演员移动至 <<MARK-A>> 位置
<<<
```

**禁止**：块级 Tech Cue 嵌套其他块级 Tech Cue（开启标记 `<<<` 在 TechCueBlock 内触发**闭合操作**而非嵌套，裁决十）

### 9.4 行尾闭合优先原则（Trailing Rule）

当解析器处于 TechCueBlock 上下文时（栈顶为 TechCueBlock），位于物理行末尾的 `>>>` 序列（后仅可接空白字符或行尾注释 `%`）被识别为闭合标记。但为了确保与 CommonMark 的最大兼容性，**强烈推荐使用对称形式**（`<<<` ... `<<<`）。

### 9.5 麦克风换麦扩展（简洁语法）

应用层可通过简洁语法在 Tech Cue 中识别换麦指令，不依赖关键词配置：

| 语法                | 含义                | 角色来源            | 源麦来源   |
| ------------------- | ------------------- | ------------------- | ---------- |
| `<<=HM2>>`          | 切到 HM2            | 当前 `@角色` 上下文 | 角色默认麦 |
| `<<角色=HM2>>`      | 角色切到 HM2        | 显式指定            | 角色默认麦 |
| `<<HM1->HM2>>`      | 从 HM1 切到 HM2     | 当前 `@角色` 上下文 | 显式指定   |
| `<<角色:HM1->HM2>>` | 角色从 HM1 切到 HM2 | 显式指定            | 显式指定   |

**歧义处理**：若角色名与麦 ID 存在歧义，优先匹配角色名。

## 10. 注释 (Attached Node)

注释是 Attached Node，仅在源文件或特定工作版渲染目标中可见。

### 10.1 行注释

**语法**：`% 注释内容`

**规则**：

- 行首第一个非空字符是 `%` → 整行为注释
- 行内注释：其左侧必须至少包含一个空白字符（即 `␠%`），紧跟在非空白字符后的 `%` 视为普通文本

```markdown
% 这是注释
利润下降了 20% % 这是普通文本，% 前无空格
利润下降了 20 % <- 这是注释，% 前有空格
```

### 10.2 块注释

**语法**：`%%` 独占一行开始，`%%` 独占一行结束。

```markdown
%%
此处为块注释
可包含多行内容
%%
```

## 11. 转义字符

支持使用反斜杠 `\` 转义 DraMark 功能字符，使其降级为普通文本。

**合法转义序列**：`\@`, `\$`, `\{`, `\}`, `\%`, `\<`, `\=`, `\>`, `` \` ``

**示例**：

```markdown
这是一个反斜杠 \@ 字符。 % 显示为 @，不触发角色声明
C++ 模板：vector\<int\> % 显示为 <int>，不触发 Tech Cue
```

## 12. 解析器实现指引与边缘情况裁决

### 裁决一：Frontmatter 预处理豁免权

文档首部的 `---`（YAML 边界符）具有第零优先级。解析器在预处理阶段消耗掉前两个独占行的 `---`，它们**绝对不触发**任何 DraMark 状态重置逻辑。

### 裁决二：容器隔离原则（Container Isolation）

`---`、`#`、`@@`、`=`、`<<<` 等具有状态重置能力的标记，仅在**文档根级别（Root-level）**有效。

如果出现在 CommonMark 嵌套容器（如 `>` 引用块、`-` 列表项）内部，它们受容器隔离保护，**失效并降级为普通文本**。

### 裁决三：单层决策原则（Single Decision Per Line）

每一行 Token 仅触发最高优先级的规则。跨行输入按行序依次应用，后续行可继续触发新的状态迁移。

### 裁决四：Block 关闭统一规则

所有冲突通过 **LIFO close + incompatibility check** 解决。当 Token 与当前栈顶 Block 不兼容时，持续弹出栈顶直到兼容或栈空，然后应用 Token。

**闭合顺序**：`TranslationBlock` → `TechCueBlock` → `CharacterBlock` → `SongBlock`（从内到外）

### 裁决五：Tech Cue 不跨行（修订）

**行内 Tech Cue** `<<...>>`：必须在**同一物理行**内闭合。若当前行扫描到 `<<` 但行尾前未找到匹配的 `>>`，则放弃解析为 Tech Cue，整段序列降级为普通文本。

**单行块级 Tech Cue** `<<<...>>>`：要求 `<<<` 位于行首，`>>>` 位于行尾，中间不得包含换行。

**多行块级 Tech Cue**：开启标记 `<<<` 独占一行，闭合标记：
  - `>>>` 可位于行尾（推荐）或独占一行（为了与 CommonMark 兼容强烈不推荐，但如果读取到应当正确解析）
  - 若使用对称闭合 `<<<`，则必须独占一行

### 裁决六：百分号防误伤

为防止 `%` 误伤日常文本（如"利润下降了 20%"）：

- 行首注释：`%` 是该行第一个非空字符
- 行内注释：其左侧必须至少有一个空白字符

### 裁决七：标题穿透 SongBlock

根级别的 `#` 或 `##` 在 SongBlock 内触发隐式退出（穿透），用于幕/场切换自动结束唱段。

### 裁决八：译配块非对称对齐

TranslationBlock 的 `target` 字段为 `Block[]` 类型，支持多段落、列表等复杂结构，与 `source`（行内文本）形成非对称对齐。渲染器需自行实现拆分对齐策略。

### 裁决九：代码保护区优先（Code Sanctuary Priority）

**编号**：Ruling #9

CommonMark 的围栏代码块（Fenced Code Blocks）和行内代码（Inline Code）具有**最高词法优先级**。

1. 在保护区内，所有 DraMark 特殊语法（包括但不限于 `<<...>>` Tech Cue、`@` 角色声明、`$$` 唱段标记、`=` 译配标记）均**失效**，视为普通文本字面量。
2. Tech Cue 的"词法抢占权"**不适用于**代码保护区。
3. 解析器必须采用多遍扫描或状态感知的单遍解析，确保在识别 Tech Cue 之前已正确标记保护区边界。

**理由**：保证 C++ 模板类 `vector<vector<int>>`、位移操作符 `<<` 等代码语法在剧本中的完整性。

**示例**：

```markdown
% 以下必须原样保留，不产生任何 AST 语义节点
```

template <typename T>
class RolePair {
vector<vector<int>> matrix; % 不触发 Tech Cue
};

```

```

### 裁决十：Tech Cue 单层块级原则（新增）

**编号**：Ruling #10

1. **块级 Tech Cue（单行或多行）不允许嵌套其他块级 Tech Cue**。
2. **行内 Tech Cue 不允许嵌套**（内部 `<<` 视为普通文本）。
3. **块级 Tech Cue 可以包含行内 Tech Cue** 作为内容的一部分（视为标签或细化标记）。
4. 解析器在遇到块级 Tech Cue 开启标记 `<<<` 时，必须检查 Block Stack：
   - 若栈顶已是 TechCueBlock，则执行**闭合操作**（Toggle 语义）；
   - 若栈顶不是 TechCueBlock，则执行**开启操作**。

## 13. 语法分层与兼容矩阵

### 13.1 Token 与 Block 关闭关系

| Token                  | 关闭的 Block（按 LIFO 顺序）                   | 打开的 Block                | 备注                     |
| ---------------------- | ---------------------------------------------- | --------------------------- | ------------------------ |
| `@角色`                | TranslationBlock, TechCueBlock, CharacterBlock | CharacterBlock              | 技术提示需先关闭         |
| `$$`                   | TranslationBlock, TechCueBlock, CharacterBlock | SongBlock                   | -                        |
| `=␠原文`               | TranslationBlock                               | TranslationBlock            | -                        |
| `=`（单行）            | TranslationBlock                               | -                           | -                        |
| `@@`                   | TranslationBlock, TechCueBlock, CharacterBlock | -                           | 显式状态重置             |
| `---` / `#`            | TranslationBlock, TechCueBlock, CharacterBlock | -（保留为 CommonMark 结构） | 结构标记穿透             |
| `<<<`（开启）          | TranslationBlock, TechCueBlock, CharacterBlock | TechCueBlock                | 开启块级 Tech Cue        |
| `>>>`（行尾闭合）      | TechCueBlock                                   | -                           | 仅在 TechCueBlock 内有效 |
| `<<<`（对称闭合）      | TechCueBlock                                   | -                           | 仅在 TechCueBlock 内有效 |
| `$$`（结束）           | SongBlock                                      | -                           | -                        |
| `#`（在 SongBlock 内） | SongBlock                                      | -                           | 标题穿透                 |

### 13.2 语法特性速查

| 特性             | 类型       | 是否入栈 | 显式闭合      | 隐式闭合触发                       |
| ---------------- | ---------- | -------- | ------------- | ---------------------------------- |
| CharacterBlock   | Structural | 是       | `@@`          | `@`, `$$`, `<<<`, `---`, `#`       |
| SongBlock        | Structural | 是       | `$$`          | `#`（穿透）                        |
| TranslationBlock | Structural | 是       | `=`（单行）   | `@`, `$$`, `<<<`, `---`, `#`, `=␠` |
| TechCueBlock     | Structural | 是       | `>>>` / `<<<` | `@`, `$$`, `---`, `#`              |
| TechCue（行内）  | Attached   | 否       | 必须（`>>`）  | -                                  |
| Comment          | Attached   | 否       | 自动          | -                                  |

### 13.3 保护区与语法特性交互矩阵

| 语法特性               | 在围栏代码块内 | 在行内代码内 | 说明                 |
| ---------------------- | -------------- | ------------ | -------------------- |
| CharacterBlock (`@`)   | 失效（文本）   | 失效（文本） | `@角色` 视为字面量   |
| SongBlock (`$$`)       | 失效（文本）   | 失效（文本） | `$$` 视为字面量      |
| TranslationBlock (`=`) | 失效（文本）   | 失效（文本） | `=` 视为字面量       |
| TechCue（块级/行内）   | 失效（文本）   | 失效（文本） | C++ `>>` / `<<` 安全 |
| Comment (`%`)          | 失效（文本）   | 失效（文本） | `%` 视为字面量       |
| Inline Action (`{}`)   | 失效（文本）   | 失效（文本） | `{}` 视为字面量      |
| CommonMark 基础        | 正常生效       | 正常生效     | 代码标记本身生效     |

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
  | TechCueBlock // v0.3.1 新增
  | CommonMarkBlock; // 段落、列表、代码块、引用块等

interface CharacterBlock {
  type: "CharacterBlock";
  character: string;
  aliases?: string[];
  context?: string; // 情绪/状态提示
  children: (Dialogue | AttachedNode | TechCueBlock)[]; // 可包含块级 Tech Cue
}

interface SongBlock {
  type: "SongBlock";
  children: (CharacterBlock | GlobalAction | TechCueBlock | AttachedNode)[];
}

interface TranslationBlock {
  type: "TranslationBlock";
  source: InlineContent[];
  target: Block[]; // Array of Blocks，支持多段落、列表等
}

interface TechCueBlock {
  type: "TechCueBlock";
  variant: "single-line" | "multi-line";
  content: (TechCueInline | TextNode)[]; // 可包含行内 Tech Cue 作为标签
}

interface Dialogue {
  type: "Dialogue";
  content: InlineContent[]; // 包含 CommonMark 行内元素和 InlineAction
}

interface GlobalAction {
  type: "GlobalAction";
  content: Block[]; // CommonMark 区块
}

// 行内 Tech Cue 保持为 Attached Node
interface TechCueInline {
  type: "TechCue";
  variant: "inline";
  content: string; // 纯文本，无嵌套
}

interface Comment {
  type: "Comment";
  variant: "line" | "block";
  content: string;
}

interface InlineAction {
  type: "InlineAction";
  content: string; // 动作描述
}
```

## 15. 解析器实现架构指引

### 15.1 推荐架构：两遍扫描（Two-Pass Parsing）

**Pass 1: 结构识别与保护区标记（Structure & Sanctuary Pass）**

- 输入：原始文本
- 任务：
  1. 提取 YAML Frontmatter（如果存在）
  2. 识别所有 CommonMark 块级结构（段落、列表、围栏代码块等）
  3. **关键**：标记所有围栏代码块和行内代码的位置（行号/偏移量），构建**保护区映射表**（Sanctuary Map）
- 输出：带有保护区标记的块级结构树

**Pass 2: DraMark 语义附着（Semantic Attachment Pass）**

- 输入：Pass 1 生成的块级结构树 + 保护区映射表
- 任务：
  1. 遍历块级结构树
  2. 对于每个块：
     - 若为围栏代码块：原样保留，内容不解析
     - 若为普通块：应用 DraMark 语义解析（识别 `@`, `$$`, `<<<`, `<<...>>` 等），但**跳过**保护区内的 Tech Cue 识别
  3. 维护 Block Stack，处理嵌套关系
- 输出：完整 AST

### 15.2 替代架构：状态感知单遍解析（State-Aware Single Pass）

对于性能敏感场景，Lexer 维护**模式栈（Mode Stack）**：

```rust
enum LexMode {
    Normal,           // 正常 DraMark 模式（识别 Tech Cue）
    FencedCode,       // 围栏代码块内部（所有 DraMark 标记失效）
    InlineCode,       // 行内代码内部
    TechCueBlock,     // 块级 Tech Cue 内部（识别行内 Tech Cue 和闭合标记）
}
```

### 15.3 实现检查清单（Tech Cue 与代码块）

| 测试 ID  | 输入                        | 期望输出                                     | 说明                                              |
| -------- | --------------------------- | -------------------------------------------- | ------------------------------------------------- |
| TC-CB-01 | `<<LX01>>`                  | TechCueInline 节点                           | 正常识别                                          |
| TC-CB-02 | `` `<<LX01>>` ``            | InlineCode 节点                              | 行内代码保护                                      |
| TC-CB-03 | `\n<<LX01>>\n`              | CodeBlock 节点                               | 围栏代码块保护                                    |
| TC-CB-04 | `vector<vector<int>>`       | 普通文本                                     | 非代码区内 C++ 模板（若不在代码块内，按文本处理） |
| TC-CB-05 | `` `vector<vector<int>>` `` | InlineCode 节点                              | 行内代码内模板安全                                |
| TC-CB-06 | `<<< LX01 >>>`              | TechCueBlock (single-line)                   | 单行块级                                          |
| TC-CB-07 | `<<<\n<<LX01>>\n>>>`        | TechCueBlock (multi-line) 内含 TechCueInline | 嵌套行内 Tech Cue                                 |
| TC-CB-08 | `<<<\n<<<\n>>>`             | TechCueBlock 内含文本 `<<<`                  | 对称闭合触发，或文本（取决于实现严格度）          |

## 附录 A：向后兼容性说明

**v0.3.0 → v0.3.1 兼容性**：

- 不含代码块的纯剧本文本：解析结果**一致**
- 含代码块的文档：v0.3.1 更安全，避免 C++ 模板等被误解析
- **破坏性变更**：若 v0.3.0 实现错误地将 `>>>` 作为块级 Tech Cue 闭合标记，v0.3.1 改为行尾优先原则，需更新 Lexer 逻辑

**v0.3.1 解析器要求**：

- 必须实现代码保护区机制
- 必须实现 Tech Cue 的行尾闭合优先原则
- 必须区分行内 Tech Cue（Attached）与块级 Tech Cue（Structural）

## 附录 B：输入法与编辑器体验优化 (IME Tricks)

DraMark 的设计恪守 ASCII 字符底座，但强烈建议各大编辑器（VS Code 插件、Obsidian 插件等）在应用层实现以下**静默映射（IME Tricks）**：

当侦测到用户在全角/中文输入法状态下连续键入以下符号时，应自动替换为 DraMark 标准标记：

| 用户输入 | 自动替换 | 说明                     |
| -------- | -------- | ------------------------ |
| `《《`   | `<<`     | 技术标记起始             |
| `》》`   | `>>`     | 技术标记闭合             |
| `￥￥`   | `$$`     | 唱段标记（Shift+4 连按） |
| `【【`   | `{`      | 动作提示起始             |
| `】】`   | `}`      | 动作提示闭合             |

**DraMark：专为戏剧工作者设计的无干扰语义写作语言。**

**Now with Code Sanctuary Protection & Dual-Mode Tech Cues.**
