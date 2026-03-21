# 快速入门

本指南将帮助你在 5 分钟内开始使用 DraMark 编写剧本。

## 什么是 DraMark？

DraMark（Drama Markdown）是一门专为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言。它是 [CommonMark](https://commonmark.org/) 的结构扩展方言，这意味着：

- 所有标准 Markdown 语法都可用（加粗、斜体、列表等）
- 学习曲线平缓，如果你会写 Markdown，就能快速上手 DraMark

## 基础语法速览

### 1. 角色与台词

使用 `@` 声明角色，后续内容都是该角色的台词：

```dramark
@小帕
晚上好呀夜宵先生。

@小塔
晚上好？夜宵？
```

角色声明必须独占一行。可以用 `[情绪]` 附加情绪提示：

```dramark
@小帕 [惊喜地]
人类 人类
竟然是没见过的人类
```

### 2. 场景动作

不在任何角色名下的普通文本就是场景动作（舞台指示）：

```dramark
众人四下，小塔到长椅上躺着。小幽把椅子挪到上场区前。

@小帕
真好喝！
```

一旦用 `@` 进入角色后，后续内容都会被当作该角色的台词。如果需要在台词之间插入场景动作，必须先用 `@@` 退出角色模式：

```dramark
@小帕
真好喝！
@@

小塔往左挪一个位置。<<BGM_ENTER STOP>>

@小帕
晚上好呀夜宵先生。
```

没有 `@@` 的话，"小塔往左挪一个位置"会被当作小帕的台词。这个概念对新手很关键——**`@` 进入角色，`@@` 退出角色**。

### 3. 唱段

使用 `$$` 标记唱段，`$$` 后可跟标题：

```dramark
$$ 小帕饿饿歌
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?
= 哪里有好吃的呢
Where's the tasty in my sight?
$$
```

### 4. 动作提示

使用 `{}` 在台词中插入行内动作提示：

```dramark
@小帕 [哼]
{起身}
作为提供 夜宵的回赠
我可以满足 你一个愿望
```

### 5. 退出角色与场景分隔

使用 `@@` 退出角色模式，回到全局（可写场景动作）：

```dramark
@小帕
真好喝！
@@

小塔往左挪一个位置。<<BGM_ENTER STOP>>

@小帕
晚上好呀夜宵先生。
```

使用 `---` 分隔场景（也会重置为全局模式）：

```dramark
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?
$$

---

小帕发现了躺着的小塔。

@小帕 [惊喜地]
人类 人类
```

### 6. 译配模式

使用 `= 原文` 标记原文行，下一行写译文：

```dramark
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?
= 哪里有好吃的呢
Where's the tasty in my sight?
```

译配需在角色块内，且需在 Frontmatter 中设置 `translation` 配置。

### 7. 技术提示

行内技术提示使用 `<<>>`：

```dramark
<<BGM_ENTER GO>> <<LX: SPOT_PARK 渐起>>
```

块级技术提示使用 `<<< >>>`：

```dramark
<<<
LX: SPOT_DUO 灯光变化同时打亮二人。
>>>
```

### 8. 注释

行首 `%` 表示注释（默认不在 AST 中显示）：

```dramark
% 独光 小帕往上场区前方椅子走，后续搬到长椅处。
```

## 完整示例

更完整的示例请查看 [《在公园的长椅上睡大觉》第二幕剧本](/examples/showcase)。

## 下一步

- 了解 [基础概念](/guide/concepts)
- 深入学习 [角色与台词语法](/guide/character)
- 学习 [唱段](/guide/song)、[译配模式](/guide/translation)、[技术提示](/guide/tech-cue)
- 查看 [完整剧本示例](/examples/showcase)

## 编辑器

推荐使用 [VSCode DraMark 扩展](https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark) 进行编写和预览。Web 编辑器正在开发中。
