# 编辑器体验优化

DraMark 的设计恪守 ASCII 字符底座，但建议在编辑器应用层实现以下**静默映射（IME Tricks）**。

## 输入法自动替换

当侦测到用户在全角/中文输入法状态下连续键入以下符号时，自动替换为 DraMark 标准标记：

| 用户输入 | 自动替换 | 说明 |
|----------|----------|------|
| `《《` | `<<` | 技术标记起始 |
| `》》` | `>>` | 技术标记闭合 |
| `￥￥` | `$$` | 唱段标记 |
| `【【` | `{` | 动作提示起始 |
| `】】` | `}` | 动作提示闭合 |

### 为什么需要替换？

中文输入法下：
- 按 `Shift + ,` 输出 `《`
- 按 `Shift + 4` 输出 `￥`
- 按 `[` 输出 `【`

通过自动替换，编剧无需切换输入法即可使用 DraMark 核心语法。

## 推荐的编辑器配置

### VS Code

推荐插件：
- Markdown All in One
- 自定义 DraMark 语法高亮

配置示例：

```json
{
  "files.associations": {
    "*.dramark": "markdown"
  },
  "[markdown]": {
    "editor.quickSuggestions": {
      "other": true,
      "comments": false,
      "strings": true
    }
  }
}
```

### Obsidian

使用 Markdown 格式，建议：
- 创建 `.dramark` 文件关联
- 自定义 CSS 增强角色名高亮

### 通用建议

1. **文件扩展名**：使用 `.dramark` 或 `.md`
2. **编码**：UTF-8
3. **换行符**：LF（Unix 风格）

## 语法高亮建议

为编辑器添加 DraMark 语法高亮：

```yaml
# 角色名
pattern: "^@[^\\s\\[]+"
color: "#5f67ee"
fontWeight: "bold"

# 唱段标记
pattern: "^\\$\\$"
color: "#2d8cf0"

# 动作提示
pattern: "\\{[^}]+\\}"
color: "#888888"
fontStyle: "italic"

# 技术提示
pattern: "<<[^>]+>>"
color: "#ff9900"

# 注释
pattern: "%.*$"
color: "#999999"
fontStyle: "italic"
```

## 代码片段（Snippets）

### VS Code Snippets

```json
{
  "DraMark Character": {
    "prefix": "@",
    "body": ["@${1:角色名} [${2:情绪}]", "$0"],
    "description": "角色声明"
  },
  "DraMark Song": {
    "prefix": "$$",
    "body": ["$$ ${1:标题}", "$0", "$$"],
    "description": "唱段"
  },
  "DraMark Translation": {
    "prefix": "=",
    "body": ["= ${1:原文}", "${2:译文}"],
    "description": "译配对"
  }
}
```

## 预览工具

DraMark 文件可以直接预览：

1. **本地预览**：使用 VitePress 或自定义渲染器
2. **GitHub**：作为 Markdown 文件渲染
3. **导出**：使用 CLI 工具导出为 PDF/HTML

## 移动设备支持

DraMark 的 ASCII 基础设计使其在移动设备上易于输入：
- 符号键盘即可访问所有核心语法
- 无需特殊输入法
