# 配置参考

## Frontmatter 字段

### meta

作品元信息。

```yaml
meta:
  title: string          # 作品标题
  author: string         # 作者/改编者
  locale: string         # 默认语言区域，如 zh-CN
  version: string        # 文档版本
```

### casting

角色配置。

```yaml
casting:
  characters:
    - name: string       # 角色名
      actor: string      # 演员名（可选）
      mic: string        # 麦克风 ID（可选）
      aliases: string[]  # 别名列表（可选）
  groups:
    - name: string       # 分组名
      members: string[]  # 成员列表
```

### translation

译配配置。

```yaml
translation:
  enabled: boolean       # 是否开启译配模式
  source_lang: string    # 原文语言代码
  target_lang: string    # 目标语言代码
  render_mode: string    # 渲染模式：bilingual | source | target
```

### tech

技术配置。

```yaml
tech:
  mics:                  # 麦克风设备（保留字段，数组结构）
    - id: string
      label: string
      desc: string
  
  {category}:            # 动态分类（除 mics 外）
    color: string        # 显示颜色
    entries:             # 条目列表
      - id: string
        label: string
        desc: string
  
  color: string          # 默认 Tech Cue 颜色
```

### use_frontmatter_from

外部 Frontmatter 引用。

```yaml
use_frontmatter_from: string  # URL 或文件路径
```

## 解析器选项

### parserMode

解析器模式。

- `legacy`（默认）：使用自定义状态机解析器
- `micromark`：使用 micromark 扩展

### translationEnabled

是否启用译配模式。若 Frontmatter 已设置，以此为准。

### includeComments

是否在 AST 中包含注释节点。默认 `false`。

### strictMode

严格模式。启用时，遇到警告会抛出错误。默认 `false`。

## 使用示例

### Node.js

```javascript
import { parseDraMark } from 'dramark';

const result = parseDraMark(source, {
  parserMode: 'legacy',
  translationEnabled: true,
  includeComments: false,
  strictMode: false
});

console.log(result.tree);
console.log(result.warnings);
console.log(result.metadata);
```

### Unified / Remark

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDraMark from 'remark-dramark';

const result = await unified()
  .use(remarkParse)
  .use(remarkDraMark, {
    parserMode: 'legacy',
    translationEnabled: true
  })
  .process(source);
```
