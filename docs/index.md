---
layout: home

hero:
  name: "DraMark"
  text: "戏码"
  tagline: 为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言 (Public Beta)
  image:
    src: /logo.svg
    alt: DraMark
  actions:
    - theme: brand
      text: 快速入门
      link: /guide/getting-started
    - theme: alt
      text: 查看示例
      link: /examples/showcase
    - theme: alt
      text: 🤖 给 LLM/AI Agent 的指南
      link: /guide/llm-syntax-guide
    - theme: brand
      text: VS Code 插件
      link: https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark

features:
  - icon: ⌨️
    title: 输入法友好
    details: 核心符号 @, %, = 在中文键盘下可直接打出，保证编剧创作心流不断
  - icon: 🎭
    title: 结构优先
    details: 摒弃繁琐的闭合标签，通过明确的块级语法定义台词、唱段和舞台动作的作用域
  - icon: 🌐
    title: 原生译配支持
    details: 内建强大的双语译配工作流，一份源文件可编译为演员本、导演本、工作本
  - icon: 🎬
    title: 技术标记
    details: 支持灯光、音响等技术提示的原生标记，助力剧本与舞台设计的无缝对接
  - icon: 📝
    title: Markdown 方言
    details: 完整的 CommonMark 支持，可使用加粗、斜体、列表等标准语法
  - icon: 🔌
    title: VS Code 扩展
    details: 提供 VS Code 扩展，支持语法高亮、实时预览和译配模式切换
    link: https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark
---

## 一个简单的示例

```dramark
---
meta:
  title: 在公园的长椅上睡大觉
  author: 小橘猫_zzz
  locale: zh-CN
translation:
  source_lang: zh-CN
  target_lang: en
casting:
  characters:
    - name: 小帕
      aliases: [帕]
      mic: B1
    - name: 小塔
      aliases: [塔]
      mic: B2
tech:
  mics:
    - id: B1
    - id: B2
---

# 02 相遇小帕

<<BGM_ENTER GO>> <<LX: SPOT_PARK 渐起>>

众人四下，小塔到长椅上躺着。

$$ 小帕饿饿歌
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?
= 哪里有好吃的呢
Where's the tasty in my sight?
$$

---

@小帕 [惊喜地]
人类 人类
竟然是没见过的人类

@小帕
{蹲下，捧起小塔的手｜小塔醒来}
那我 还在 忍耐什么
吃饱再说

@小帕
真好喝！
@@

@小塔
晚上好？夜宵？
```

## 为什么选择 DraMark？

### 少输入法切换

编剧创作时需要频繁输入中文，DraMark 的所有特殊符号（`@`、`$`、`%`、`=`）都可以通过中文键盘的 Shift 键直接打出，无需切换输入法。

### 结构清晰

DraMark 使用块级结构组织剧本内容：
- `@角色名` 进入角色台词模式
- `$$` 开启/关闭唱段
- `---` 场景分隔
- `=` 开启译配对

### 专业功能内置

- **角色管理**：通过 Frontmatter 定义角色列表、别名、麦克风分配
- **技术提示**：原生支持灯光、音效等技术标记 `<<LX01 GO>>`
- **译配模式**：双语对照，原文译文配对显示
- **动作提示**：行内动作标记 `{起身走向台前}`

## 开始使用

查看 [快速入门指南](/guide/getting-started) 开始使用！

推荐安装 [VSCode DraMark 扩展](https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark) 获得最佳编写体验。
