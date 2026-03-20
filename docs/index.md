---
layout: home

hero:
  name: "DraMark"
  text: "戏剧剧本标记语言"
  tagline: 专为戏剧、影视及音乐剧剧本创作设计的纯文本标记语言
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

features:
  - icon: ⌨️
    title: 输入法友好
    details: 核心符号 @, %, =, $ 在中文键盘下可直接打出，保证编剧创作心流不断
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
    title: CommonMark 兼容
    details: 完整的 Markdown 支持，可使用加粗、斜体、列表等标准语法
  - icon: 🔌
    title: 易于集成
    details: 提供 Remark 插件，可轻松集成到各种静态站点生成器和编辑器中
---

## 一个简单的示例

```markdown
---
meta:
  title: 相遇
  author: 剧作家
casting:
  characters:
    - name: 小帕
    - name: 小塔
---

# 第一幕 公园相遇

小塔独自坐在公园的长椅上。

@小塔
又是一个平常的下午。

@小帕 [兴奋地]
你好！我可以坐这里吗？

@小塔
当然可以。

---

夜幕降临。

$$
@小帕 @小塔
= Where do we go from here?
我们将何去何从
= Where do we go from here?
未来又在何方
$$
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

```bash
# 安装 DraMark 解析器
npm install remark-dramark

# 或使用 pnpm
pnpm add remark-dramark
```

然后查看 [快速入门指南](/guide/getting-started) 开始使用！
