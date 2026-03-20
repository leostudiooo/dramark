# 常见问题

## 基础问题

### Q: DraMark 和普通 Markdown 有什么区别？

DraMark 是 CommonMark 的超集。所有普通 Markdown 文件都是合法的 DraMark 文件，但 DraMark 添加了专门针对剧本创作的结构化语法，如角色声明 `@`、唱段标记 `$$`、译配 `=` 等。

### Q: 用什么编辑器写 DraMark 最好？

任何支持 Markdown 的编辑器都可以。推荐使用：
- VS Code + Markdown 插件
- Obsidian
- Typora

建议配置文件关联，将 `.dramark` 文件识别为 Markdown。

### Q: 如何预览渲染效果？

DraMark 是文本格式，你可以：
1. 使用 DraMark 解析器转换为 HTML
2. 使用 CLI 工具生成 PDF
3. 直接阅读源码，DraMark 的设计就是便于人类直接阅读

## 语法问题

### Q: 角色名可以包含空格吗？

可以。推荐使用引号包裹：

```dramark
@"冉 阿让"
台词内容
```

也可以不加引号（首尾空白会被裁剪）：

```dramark
@  冉 阿让
台词内容
```

### Q: 如何在台词中包含 @ 符号？

使用转义：`\@`

```dramark
@角色
我的邮箱是 user\@example.com
```

### Q: 唱段内可以切换角色吗？

可以，不会退出唱段：

```dramark
$$
@角色A
唱词...

@角色B
对唱...
$$
```

### Q: 译配模式必须在角色内吗？

是的，译配标记 `=␠` 必须在 CharacterBlock 内才有效。

## 技术问题

### Q: 如何集成到自己的项目中？

```javascript
import { parseDraMark } from 'dramark';

const result = parseDraMark(source);
// result.tree - AST
// result.warnings - 警告列表
// result.metadata - 元数据
```

或使用 Unified 插件：

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDraMark from 'remark-dramark';

const result = await unified()
  .use(remarkParse)
  .use(remarkDraMark)
  .process(source);
```

### Q: 代码块内的 Tech Cue 会被识别吗？

不会，代码保护区内所有 DraMark 语法均失效：

````dramark
```cpp
vector<vector<int>> matrix;  // 不会触发 Tech Cue
```
````

### Q: 支持哪些输出格式？

DraMark 解析器输出 AST，可以转换为：
- HTML
- PDF（通过 Puppeteer 等工具）
- JSON（AST 序列化）
- 其他自定义格式

## 贡献与反馈

### Q: 如何报告问题或提出建议？

请通过 GitHub Issues 提交：
- Bug 报告
- 功能建议
- 文档改进

### Q: 可以贡献代码吗？

欢迎！请查看 GitHub 上的贡献指南。
