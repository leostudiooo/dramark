# 技术提示 (Tech Cue)

Tech Cue 用于表达技术调度信息（灯光、音效、麦克风等）。

## 形态概览

| 形态 | 类型 | 语法 | 说明 |
|------|------|------|------|
| **行内 Tech Cue** | Attached Node | `<<内容>>` | 标准 CommonMark，不跨行 |
| **单行块级 Tech Cue** | Structural Block | `<<< 内容 >>>` | 独占一行，行尾闭合 |
| **多行块级 Tech Cue** | Structural Block | `<<< [属性]` ... `>>>` | 可包含行内 Tech Cue |

## 行内 Tech Cue

**语法**：`<<内容>>`

```markdown
@A
你来了。<<LX01 GO>>

@B
<<SFX_THUNDER>> 打雷了！
```

### 规则

- 必须在**同一物理行**内闭合
- 若未闭合，整段降级为普通文本
- 在代码保护区内失效

### 多组匹配

同一行多组 `<<` / `>>` 按**最近配对**规则：

```markdown
<<LX01>> 和 <<LX02>>  # 正确，两组 Tech Cue
```

## 单行块级 Tech Cue

**语法**：`<<<` + 内容 + `>>>`（行尾闭合）

```markdown
@A
台词内容。

<<<LX01 GO, LX02 READY>>> % 独立技术提示

继续台词。
```

这会自动关闭不兼容的块，添加内容后立即关闭。

## 多行块级 Tech Cue

**开启**：`<<<` 或 `<<< 属性头`

**闭合**：`>>>`（主闭合）或 `<<<`（对称回退）

```markdown
<<<
灯光：面光渐暗 <<LX01-FADE>>
音效：雨声入 <<SND-RAIN-01>>
演员移动至 <<MARK-A>> 位置
<<<
```

### 属性头

可选的属性头用于分类：

```markdown
<<< LX
主面光：100%
侧光：80%
>>>
```

### 闭合优先级

1. `>>>` 主闭合（优先级更高）
2. `<<<` 对称回退闭合（仅当未匹配到 `>>>` 时）

```markdown
<<<
<<<
>>>
```

第二行 `<<<` 是内容，第三行 `>>>` 闭合。

### 内部嵌套

- 允许包含**行内 Tech Cue**
- 禁止嵌套块级 Tech Cue（遇到 `<<<` 视为内容）

## Frontmatter 配置

定义 Tech Cue 分类和颜色：

```yaml
---
tech:
  mics:
    - id: HM1
      label: 主麦
  sfx:
    color: "#66ccff"
    entries:
      - id: BGM_ENTER
        desc: 入场音乐
  lx:
    color: "#ff66cc"
    entries:
      - id: SPOT_MAIN
        desc: 面光
  color: "#888888"  # 默认颜色
---
```

匹配规则：取首词，优先匹配分类名，其次匹配 entry id。

## 使用场景

### 灯光提示

```markdown
<<LX: SPOT_PARK 渐起>>

<<<
LX: 
- SPOT_PARK 100%
- SPOT_XIAOTA 50%
>>>
```

### 音效提示

```markdown
<<BGM_PARK_NIGHT GO>>

<<SFX: SFX_THUD>>
```

### 麦克风提示

```markdown
@小帕 <<=HM1>>
你好！

@小塔 <<=HM2>>
嗨！
```

换麦简洁语法（草案）：

| 语法 | 含义 |
|------|------|
| `<<=HM2>>` | 当前角色切到 HM2 |
| `<<角色=HM2>>` | 指定角色切到 HM2 |
| `<<HM1->HM2>>` | 从 HM1 切到 HM2 |

## 注释支持

TechCueBlock 内允许完整注释语法：

```markdown
<<<
灯光 % 这是行注释
音效
%%
这是块注释
%%
>>>
```
