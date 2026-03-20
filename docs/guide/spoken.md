# 念白段落

念白段落用于在唱段中临时插入念白内容。

## 设计理念

DraMark 中存在两种表演模式：

| 模式 | 说明 |
|------|------|
| **念白（Spoken）** | 普通对白，角色之间的对话 |
| **唱段（Sung）** | 音乐表演，包含唱词 |

**GlobalBlock 默认即为念白模式**——处于 GlobalBlock 时，所有内容自然作为念白处理，无需额外标记。

念白段落仅在 SongBlock 内有意义，用于在唱段中临时插入念白场景。

## 语法

**开启**：独占一行的 `!!`

**关闭**：独占一行的 `!!`

```markdown
$$
@Samuel Seabury
Heed not the rabble who scream

!!
@Alexander Hamilton
What?!
!!

@Samuel Seabury
who scream, "Revolution!"
$$
```

## 使用场景

### 1. 唱段中插入短念白

```markdown
$$
@Samuel Seabury
Heed not the rabble who scream

!!
@Alexander Hamilton
What?!
!!

@Samuel Seabury
who scream, "Revolution!"
$$
```

### 2. 唱段中插入长念白场景

```markdown
$$
@Aaron Burr
No one else was in the room where it happened

!!
@Thomas Jefferson
We need a compromise

@James Madison
Something we can all agree on

@Alexander Hamilton
I have a proposal...
!!

@Aaron Burr
The room where it happened
$$
```

## 内部规则

- 念白段落内支持完整的 CommonMark 语法
- 支持所有 DraMark 指令（`@角色`、译配、Tech Cue 等）
- 念白段落关闭后，自动回到之前的 SongBlock 上下文

## 隐式闭合

以下条件自动闭合当前 SpokenSegment：

- `!!`（显式关闭）
- `$$`（关闭整个 SongBlock）
- `#` 根级标题（穿透关闭 SongBlock）
- EOF（文档结束）

## 与 GlobalBlock 的关系

| 上下文 | 表演模式 | 说明 |
|--------|----------|------|
| GlobalBlock | 念白（Spoken） | 默认状态，无需标记 |
| SongBlock | 唱段（Sung） | `$$` 进入 |
| SongBlock → SpokenSegment | 念白（Spoken） | `!!` 临时切换 |

## 完整示例

```markdown
$$
@小塔
这怎么聊
不如问我 为何 这还不跑

!!
@小帕
夜宵先生！

@小塔
别这样叫我...
!!

@小塔
好想立刻醒来
但是现在
$$
```
