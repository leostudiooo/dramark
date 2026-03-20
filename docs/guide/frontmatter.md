# Frontmatter 配置

DraMark 文档可由 YAML Frontmatter 块开头，用于提供剧本配置数据。

## 基本结构

```markdown
---
meta:
  title: 作品标题
  author: 作者名
  locale: zh-CN
  version: "1.0"
---
```

Frontmatter 必须位于文档开头，以 `---` 开始和结束。

## 推荐字段

### meta - 元信息

```yaml
meta:
  title: 悲惨世界 (Les Misérables)    # 作品标题
  author: 克劳德-米歇尔·勋伯格        # 作者/改编者
  locale: zh-CN                       # 默认语言区域
  version: "0.4.0"                    # 文档版本
```

### casting - 角色配置

```yaml
casting:
  characters:
    - name: "冉 阿让"
      actor: 张三
      mic: HM1
      aliases: [24601, 马德兰先生]      # 角色别名
    - name: 沙威
      actor: 李四
      mic: HM2
  groups:
    - name: 学生群像
      members: [安灼拉, 公白飞, 格朗泰尔]
    - name: 合唱团
      members: [全体演员]
```

### translation - 译配配置

```yaml
translation:
  enabled: true                       # 是否开启译配模式
  source_lang: en                     # 原文语言
  target_lang: zh-CN                  # 目标语言
  render_mode: bilingual              # 渲染模式
```

`render_mode` 可选值：
- `bilingual`：双语对照显示
- `source`：仅显示原文
- `target`：仅显示译文

### tech - 技术配置

```yaml
tech:
  mics:                               # 麦克风配置
    - id: HM1
      label: 主麦
      desc: 主角麦克风
    - id: HM2
      label: 备用麦
  
  sfx:                                # 音效分类
    color: "#66ccff"                  # 该分类显示颜色
    entries:
      - id: BGM_ENTER
        label: 入场音乐
        desc: 开场背景音乐
      - id: SFX_THUNDER
        label: 雷声
  
  lx:                                 # 灯光分类
    color: "#ffcc00"
    entries:
      - id: SPOT_MAIN
        label: 面光
  
  color: "#888888"                    # 默认 Tech Cue 颜色
```

### use_frontmatter_from - 外部配置

支持引用外部 YAML 文件作为配置基线：

```yaml
---
use_frontmatter_from: https://example.com/show/frontmatter.yaml
meta:
  title: 本地覆盖标题  # 这会覆盖外部配置中的 title
---
```

**合并策略**：
1. 读取外部文档作为基线配置
2. 将当前文档 Frontmatter 作为覆盖层
3. 对象字段按 key 递归覆盖
4. 数组字段默认整段替换（不做隐式拼接）

**安全建议**：
- 仅允许 `https` 协议
- 支持域名白名单与最大响应体积限制
- 采用可配置超时与缓存 TTL
- 拉取失败时回退到本地 Frontmatter

## 完整示例

```yaml
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
    - name: 小柴
      aliases: [柴]
      mic: B3
tech:
  mics:
    - id: B1
    - id: B2
    - id: B3
  sfx:
    color: "#66ccff"
    entries:
      - id: BGM_ENTER
        desc: 入场音乐
      - id: SFX_THUD
        desc: 手刀敲击声
  lx:
    color: "#ff66cc"
    entries:
      - id: SPOT_PARK
        desc: 公园环境光
---
```

## 自定义字段

所有字段都是可选的，你可以添加任意自定义字段，解析器会透传这些字段供上层应用使用：

```yaml
---
my_app:
  custom_setting: value
  another_config: true
---
```
