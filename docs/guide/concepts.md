# 基础概念

理解 DraMark 的核心概念有助于你更高效地编写剧本。

## Block Stack 解析模型

DraMark 使用 **Block Stack（块栈）** 模型来管理剧本结构。想象一叠盘子，每个盘子代表一种块级结构：

```
GlobalBlock（全局块 - 隐式根）
  ├─ CharacterBlock（角色块）
  │   └─ TranslationBlock（译配块）
  ├─ SongBlock（唱段块）
  │   ├─ CharacterBlock（角色块）
  │   └─ SpokenSegment（念白段落）
  └─ TechCueBlock（技术提示块）
```

### 三种块类型

1. **Structural Blocks（结构块）**：参与栈操作，具有开启/关闭语义
   - GlobalBlock（隐式根，默认状态）
   - CharacterBlock（角色块）
   - SongBlock（唱段块）
   - SpokenSegment（念白段落）
   - TranslationBlock（译配块）
   - TechCueBlock（块级技术提示）

2. **Content Blocks（内容块）**：CommonMark 标准区块
   - 段落、列表、引用块、代码块等

3. **Attached Nodes（附着节点）**：不参与栈操作
   - 行内 Tech Cue `<<...>>`
   - 注释

## 解析上下文

### 表演上下文

DraMark 有两种表演模式：

| 上下文 | 说明 | 标记 |
|--------|------|------|
| **念白（Spoken）** | 普通对白、场景动作 | 默认状态，无需标记 |
| **唱段（Sung）** | 音乐表演，包含唱词 | `$$` 进入唱段模式 |

### 作用域上下文

| 上下文 | 说明 | 进入方式 |
|--------|------|----------|
| **Global** | 全局/场景级别 | 默认状态，或 `---` 重置 |
| **Character** | 角色台词 | `@角色名` |
| **Song** | 唱段容器 | `$$` |

## 状态转换

当解析器遇到特定标记时，会触发块栈的关闭和打开操作：

| 标记 | 关闭的块（按顺序） | 打开的块 |
|------|-------------------|----------|
| `@角色` | Comment, TechCue, Translation, Character | CharacterBlock |
| `$$` | Comment, TechCue, Translation, Character | SongBlock |
| `!!` | Comment, TechCue, Translation, Character | SpokenSegment |
| `=␠原文` | Translation | TranslationBlock |
| `---` / `#` | Comment, TechCue, Translation, Character | -（重置到 Global） |
| `@@` | Comment, TechCue, Translation, Character | -（显式退出） |

### 统一闭合算法

当一个指令触发结构变化时，解析器执行：

```
while 栈顶块与当前指令不兼容:
    关闭栈顶块
应用当前指令
```

这确保了 **LIFO（后进先出）** 的闭合顺序，从内到外依次关闭。

## 代码保护区

在 CommonMark 的围栏代码块和行内代码内部，所有 DraMark 特殊语法均失效：

````markdown
```cpp
// 这里的 @、$$、<< >> 都是普通文本
vector<vector<int>> matrix;  // 不触发 Tech Cue
```
````

| 类型 | 起始标记 | 结束标记 |
|------|----------|----------|
| 围栏代码块 | ` ``` ` 或 `~~~` | 同等长度/类型的围栏标记 |
| 行内代码 | `` ` `` | 匹配的起始标记 |

保护区内的失效语法：
- `@` 角色声明
- `$$` 唱段标记
- `=` 译配标记
- `<<...>>` / `<<<...>>>` Tech Cue
- `%` 注释
- `{}` 动作提示

## 容器隔离原则

具有状态重置能力的标记（`---`、`#`、`@@`、`=`、`<<<` 等）仅在 **文档根级别** 有效。

如果出现在 CommonMark 嵌套容器（如引用块、列表项）内部，它们会**失效并降级为普通文本**：

```markdown
> 这是一个引用块
> ---
> 这里的 --- 不会触发场景分隔
```

## 单层决策原则

每一行 Token 仅触发最高优先级的规则。跨行输入按行序依次应用，后续行可继续触发新的状态迁移。

这意味着解析器每行只做一次决策，不会同时触发多个冲突的规则。
