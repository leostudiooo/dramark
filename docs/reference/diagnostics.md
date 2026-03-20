# 诊断码参考

DraMark 解析器在解析过程中可能产生以下诊断信息。

## 警告级别

| 诊断码 | 级别 | 说明 |
|--------|------|------|
| UNCLOSED_SONG_CONTAINER | warning | 未闭合的唱段容器 |
| UNCLOSED_BLOCK_TECH_CUE | warning | 未闭合的块级 Tech Cue |
| UNCLOSED_BLOCK_COMMENT | warning | 未闭合的块注释 |
| TRANSLATION_OUTSIDE_CHARACTER | warning | 译配标记出现在角色块外 |
| CHARACTER_DECLARATION_NOT_STANDALONE | warning | 角色声明未独占一行 |
| INVALID_CHARACTER_NAME | warning | 无效的角色名 |
| DEPRECATED_INLINE_CHARACTER_DECLARATION | warning | 使用已弃用的行内角色声明 |
| EXTERNAL_FRONTMATTER_FETCH_FAILED | warning | 外部 Frontmatter 拉取失败 |
| EXTERNAL_FRONTMATTER_PARSE_FAILED | warning | 外部 Frontmatter 解析失败 |

## 诊断码详情

### UNCLOSED_SONG_CONTAINER

文档结束时存在未闭合的 `$$` 唱段。

```dramark
$$
@角色
唱词...
% 缺少闭合的 $$
```

### UNCLOSED_BLOCK_TECH_CUE

存在未闭合的块级 Tech Cue。

```dramark
<<<
灯光提示
% 缺少闭合的 >>> 或 <<<
```

### UNCLOSED_BLOCK_COMMENT

存在未闭合的块注释。

```dramark
%%
注释开始
% 缺少闭合的 %%
```

### TRANSLATION_OUTSIDE_CHARACTER

译配标记 `=␠` 出现在角色块外。

```dramark
= 原文  % 错误：不在角色内
译文
```

### CHARACTER_DECLARATION_NOT_STANDALONE

角色声明行包含非附着内容。

```dramark
@角色名 台词内容  % 错误：应独占一行
```

### INVALID_CHARACTER_NAME

角色名为空或无效。

```dramark
@   % 错误：空角色名
```

### DEPRECATED_INLINE_CHARACTER_DECLARATION

使用了已弃用的行内角色声明语法。

```dramark
@角色 台词  % 已弃用，应改为独占一行
```

### EXTERNAL_FRONTMATTER_FETCH_FAILED

无法拉取 `use_frontmatter_from` 指向的外部资源。

### EXTERNAL_FRONTMATTER_PARSE_FAILED

外部 Frontmatter 拉取成功但 YAML 解析失败。

## 在代码中处理诊断

```javascript
import { parseDraMark } from 'dramark';

const result = parseDraMark(source);

// 检查警告
for (const warning of result.warnings) {
  console.log(`${warning.code}: ${warning.message}`);
  console.log(`  at line ${warning.line}, column ${warning.column}`);
}

// 严格模式
const strictResult = parseDraMark(source, { strictMode: true });
// 第一个警告会作为错误抛出
```
