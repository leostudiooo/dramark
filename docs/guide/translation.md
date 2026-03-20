# 译配模式

DraMark 内建强大的双语译配工作流，支持原文与译文配对显示。

## 启用译配模式

通过 Frontmatter 启用：

```yaml
---
translation:
  enabled: true
  source_lang: en
  target_lang: zh-CN
  render_mode: bilingual
---
```

## 进入译配

**语法**：`=␠<原文>`（等号后必须跟一个空格）

```markdown
@冉阿让
= Who am I?
我是谁？
= Can I conceal myself forevermore?
我能否隐瞒真相，直到永远？
```

## 内容结构

TranslationBlock 包含：

- `source`: 行内文本（原文）
- `target`: 块级节点数组（译文）

译文可以包含多段落、列表等复杂结构：

```markdown
@角色
= First line
第一行译文

第二行译文（同属 target）

- 列表项 1
- 列表项 2

= Second line
第二句的译文
```

## 隐式闭合触发

以下条件自动闭合当前 TranslationBlock：

- 新的 `=␠`（下一句原文开始）
- `@`（切换角色）
- `$$`（进入唱段）
- `<<<`（进入块级 Tech Cue）
- `---` 或 `#`（根级别结构标记）
- EOF（文档结束）

## 显式退出

**语法**：独占一行的 `=`

```markdown
@冉阿让
= Who am I?
我是谁？
= Can I conceal myself forevermore?
我能否隐瞒真相，直到永远？

=
（无需再配对，直接回到普通对白模式）
但我的良心永不允许。
```

## 词法约束

| 形式 | 含义 |
|------|------|
| `=␠` | 译配起始（等号+空格+原文） |
| `=`（独占一行） | 译配退出 |
| 普通文本中的 `=` | 按字面文本保留 |

## 完整示例

```markdown
---
meta:
  title: 译配示例
translation:
  enabled: true
  source_lang: en
  target_lang: zh-CN
---

# 第一首 我在哪儿

$$
@小帕
= Where to find a bite tonight?
哪里会有夜宵呢
= Where's the tasty in my sight?
哪里有好吃的呢
= It always happens in the midnight -- the hunger strikes
到了夜里总是会突然肚子饿
= The stores are closed, I tried the door
便利店已经关门
= The park is empty, searched the floor
公园里也没有人
$$
```

## 注意事项

1. **必须在角色内**：译配对必须在 CharacterBlock 内才有效
2. **空格要求**：`=␠` 等号后必须跟空格
3. **原文单行**：source 是行内文本，不支持多段落
4. **译文丰富**：target 支持任意 CommonMark 块级内容
