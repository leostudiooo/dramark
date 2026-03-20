# 快速入门

本指南将帮助你在 5 分钟内开始使用 DraMark 编写剧本。

## 什么是 DraMark？

DraMark（Drama Markdown）是一门专为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言。它是 [CommonMark](https://commonmark.org/) 的结构扩展方言，这意味着：

- 所有标准 Markdown 语法都可用（加粗、斜体、列表等）
- 学习曲线平缓，如果你会写 Markdown，就能快速上手 DraMark
- 有丰富的工具生态支持

## 基础语法速览

### 1. 角色与台词

使用 `@` 声明角色，后续内容都是该角色的台词：

```markdown
@哈姆雷特
生存还是毁灭，这是个问题。

@奥菲利亚
殿下！
```

### 2. 场景动作

不在任何角色名下的普通文本就是场景动作（舞台指示）：

```markdown
哈姆雷特独自一人在城墙上徘徊，月光洒在他的身上。

@哈姆雷特
（自言自语）
我的母亲...
```

### 3. 唱段

使用 `$$` 标记唱段：

```markdown
$$
@汉密尔顿
我绝不会放弃这个机会！
我不会放弃，我的机会！
$$
```

### 4. 动作提示

使用 `{}` 在台词中插入动作提示：

```markdown
@哈姆雷特
{拔剑}
来吧，毒剑！
```

### 5. 场景分隔

使用 `---` 分隔场景：

```markdown
第一场景结束。

---

第二场景开始。
```

## 完整示例

下面是一个完整的 DraMark 剧本示例：

```markdown
---
meta:
  title: 公园相遇
  author: 新手剧作家
---

# 第一幕

公园里，夕阳西下。

@路人甲 [低声]
你看那个人，已经在长椅上坐了一下午了。

@路人乙
别多管闲事，走吧。

---

夜幕降临。

@神秘人
{缓缓抬头}
终于等到你了。

$$
@神秘人
= I've been waiting for you
我终于等到你
= In this park, at this hour
在这公园，在这时刻
$$
```

## 下一步

- 了解 [基础概念](/guide/concepts)
- 深入学习 [角色与台词语法](/guide/character)
- 查看 [完整剧本示例](/examples/showcase)

## 常见问题

### Q: DraMark 和普通 Markdown 有什么区别？

DraMark 是 CommonMark 的超集。所有普通 Markdown 文件都是合法的 DraMark 文件，但 DraMark 添加了专门针对剧本创作的结构化语法，如角色声明 `@`、唱段标记 `$$` 等。

### Q: 用什么编辑器写 DraMark 最好？

任何支持 Markdown 的编辑器都可以。推荐使用：
- VS Code + Markdown 插件
- Obsidian
- Typora

### Q: 如何预览渲染效果？

DraMark 是文本格式，你可以：
1. 使用 DraMark 解析器转换为 HTML
2. 使用集成工具（如我们的 CLI 工具）生成 PDF
3. 直接阅读源码，DraMark 的设计就是便于人类直接阅读
