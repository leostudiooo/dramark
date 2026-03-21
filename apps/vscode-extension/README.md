# DraMark for VS Code

[DraMark](https://docs.dramark.dev) (Drama Markdown) 的官方 VS Code 扩展，为戏剧、影视及音乐剧剧本创作提供语法高亮、智能提示和预览支持。

## 功能特性

### 🎨 语法高亮

- 角色声明 (`@角色名`) 高亮
- 唱段标记 (`$$`) 特殊着色
- 动作提示 (`{}`) 斜体显示
- 技术提示 (`<<>>`) 醒目颜色
- 注释 (`%`) 灰色显示
- 译配标记 (`=`) 双语区分

### ✨ 智能功能

- **自动补全**：角色名、技术提示代码、情绪标签
- **输入法优化**：自动将中文符号替换为 DraMark 标准标记
  - `《《` → `<<`
  - `》》` → `>>`
  - `￥￥` → `$$`
  - `【【` → `{`
  - `】】` → `}`
- **代码片段**：快速插入常用结构
- **符号跳转**：大纲视图显示角色和场景
- **诊断提示**：语法错误和警告

### 👁️ 实时预览

- 侧边栏实时预览渲染效果
- 支持演员本、导演本、工作本多种视图
- 译配双语对照显示
- 技术提示高亮

## 安装

### 从 VS Code 市场安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` (或 `Cmd+Shift+X` on macOS)
3. 搜索 "DraMark"
4. 点击安装

### 从 VSIX 安装

```bash
code --install-extension dramark-0.1.0.vsix
```

## 快速开始

1. 创建或打开 `.dramark` 或 `.md` 文件
2. 开始编写剧本：

```markdown
---
meta:
  title: 我的剧本
  author: 剧作家
casting:
  characters:
    - name: 小明
    - name: 小红
---

# 第一幕

公园里，阳光明媚。

@小明
你好，小红！

@小红 [开心地]
你好呀！

$$ 合唱

@小明 @小红
一起唱歌吧！
$$
```

3. 使用 `Ctrl+Shift+V` 打开预览

## 配置选项

### 基本设置

| 设置                           | 类型    | 默认值        | 说明               |
| ------------------------------ | ------- | ------------- | ------------------ |
| `dramark.enableIMETricks`      | boolean | `true`        | 启用输入法自动替换 |
| `dramark.preview.renderMode`   | string  | `"bilingual"` | 预览渲染模式       |
| `dramark.preview.showTechCues` | boolean | `true`        | 预览中显示技术提示 |
| `dramark.diagnostics.enabled`  | boolean | `true`        | 启用诊断提示       |

### 渲染模式

- `bilingual`：双语对照（译配模式）
- `source`：仅显示原文
- `target`：仅显示译文
- `script`：标准剧本格式

### 配置示例

```json
{
  "dramark.enableIMETricks": true,
  "dramark.preview.renderMode": "script",
  "dramark.preview.showTechCues": true,
  "dramark.diagnostics.enabled": true,
  "files.associations": {
    "*.dramark": "dramark"
  }
}
```

## 代码片段

### 角色声明

输入 `@` 后按 `Tab`：

```markdown
@${1:角色名} [${2:情绪}]
$0
```

### 唱段

输入 `$$` 后按 `Tab`：

```markdown
$$ ${1:标题}
$0
$$
```

### 译配

输入 `=` 后按 `Tab`：

```markdown
= ${1:原文}
${2:译文}
```

### 技术提示

输入 `<<` 后按 `Tab`：

```markdown
<<${1:LX01} ${2:GO}>>
```

## 键盘快捷键

| 快捷键                              | 命令             |
| ----------------------------------- | ---------------- |
| `Ctrl+Shift+V`                      | 打开侧边预览     |
| `Ctrl+K V`                          | 打开预览标签     |
| `Ctrl+Shift+P` → "DraMark: Preview" | 命令面板打开预览 |

## 语言支持

- 语法高亮
- 括号匹配 (`{}`, `[]`, `<>`)
- 自动缩进
- 折叠区域 (`$$`, `<<< >>>`, `%%`)
- 大纲视图（角色、场景、唱段）

## 诊断信息

扩展会实时检测以下问题：

- 未闭合的唱段 (`$$`)
- 未闭合的块级 Tech Cue (`<<< >>>`)
- 未闭合的块注释 (`%%`)
- 译配标记在角色外使用
- 角色声明格式错误

## 相关链接

- [DraMark 文档](https://docs.dramark.dev/)
- [GitHub 仓库](https://github.com/dramark-md/dramark)
- [问题反馈](https://github.com/dramark-md/dramark/issues)

## 许可证

MIT © DraMark Contributors

注：本扩展依赖仓库中的核心引擎模块（Apache-2.0），具体分层见仓库根目录 README。

注：本扩展依赖仓库中的核心引擎模块（Apache-2.0），具体分层见仓库根目录 README。
