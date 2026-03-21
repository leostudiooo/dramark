# 常见问题

## 基础问题

### Q: DraMark 和普通 Markdown 有什么区别？

DraMark 是 CommonMark 的超集。所有普通 Markdown 文件都是合法的 DraMark 文件，但 DraMark 添加了专门针对剧本创作的结构化语法，如角色声明 `@`、唱段标记 `$$`、译配 `=` 等。

### Q: 用什么编辑器写 DraMark？

推荐使用 [VSCode DraMark 扩展](https://marketplace.visualstudio.com/items?itemName=LeoLi.dramark)，支持语法高亮和实时预览。Web 编辑器也正在开发中。

任何支持 Markdown 的编辑器也可以用来编写 DraMark 文件。

### Q: 如何预览渲染效果？

1. 使用 VSCode 扩展直接在编辑器中预览
2. 使用 Web 编辑器（开发中）
3. DraMark 源码本身设计为人类可读，也可直接阅读

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
$$ 小帕饿饿歌
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?

@小塔
什么情况
谁告诉我 这是 什么情况
$$
```

### Q: 译配模式必须在角色内吗？

是的，译配标记 `=␠` 必须在 CharacterBlock 内才有效。在角色块外使用会产生 `TRANSLATION_OUTSIDE_CHARACTER` 警告。

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

DraMark 解析器输出 AST（MDAST 扩展），可以转换为：
- HTML
- PDF（通过渲染器）
- JSON（AST 序列化）
- 其他自定义格式

## 贡献与反馈

### Q: 如何报告问题或提出建议？

请通过 GitHub Issues 提交。

### Q: 可以贡献代码吗？

欢迎！请查看 GitHub 上的贡献指南。
