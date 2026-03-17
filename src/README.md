# DraMark Parser 开发文档

## 1. 目标

本目录实现了 DraMark 的 remark 插件与解析核心，当前版本为 v0。

当前目标：
- 可以解析核心语法并输出结构化树
- 可以作为 unified/remark 插件接入处理链
- 支持 warning 与 strict mode 报错

## 2. 目录结构

- errors.ts
  - 错误模型与默认选项处理
- types.ts
  - DraMark 节点类型、警告类型、配置类型
- parser.ts
  - 行级状态机解析核心，产出 DraMarkRoot
- index.ts
  - remark 插件入口，封装 parseDraMark
- tests/
  - 单元与集成测试

## 3. 对外 API

### parseDraMark

输入字符串，返回解析结果：
- tree: 解析树
- warnings: 告警列表
- metadata: 元信息（例如 frontmatter 的 translation 开关）

### remark 插件

默认导出为 remarkDraMark。

行为：
- 调用 parseDraMark 解析文件内容
- 将 warnings 与 metadata 挂到 file.data.dramark
- 在 strictMode 下，如果存在 warning，抛出首个错误

## 4. 当前支持的语法能力

- frontmatter 提取
- 角色声明：@角色名，支持多角色行声明与情绪注释（[] / 【】）
- 角色上下文台词吞噬
- 全局重置：--- *** ___
- 标题穿透（根级 heading 会结束 song context）
- 唱段容器：$$ ... $$
- 翻译对：= source + target block 收集（仅角色上下文有效）
- 注释：% 行注释、%% 块注释
- 技术提示：<<< >>> 块提示、<< >> 行内提示
- 行内动作：{动作} 与全角｛动作｝
- 行内短唱：$...$
- 转义字符：\@ \$ \% \{ \} \< \= \>

## 5. 状态机模型

核心状态：
- 表演状态：global / character
- 音乐状态：spoken / sung

关键切换：
- @ 开启或切换 character
- --- / *** / ___ 退出 character 回到 global
- $$ 在 sung 与非 sung 之间切换
- 根级 heading 在 sung 内部会触发穿透并退出 sung

## 6. Warning 与 strict mode

目前 warning code：
- UNCLOSED_BLOCK_COMMENT
- UNCLOSED_BLOCK_TECH_CUE
- UNCLOSED_SONG_CONTAINER
- TRANSLATION_OUTSIDE_CHARACTER

严格模式：
- `parseDraMark`：始终返回 `warnings`，不会抛错
- `remarkDraMark` 插件：
  - strictMode=false：保留 warning，不中断
  - strictMode=true：发现 warning 即抛出首个错误

## 7. 测试

当前测试覆盖：
- parser.test.ts
  - 角色块解析
  - translation-pair 构建
  - song-container 构建
  - heading/thematicBreak 的 mdast 节点产出
  - translation target 与角色对白的 CommonMark block 保留（list/blockquote）
  - 百分号防误伤
- edge-cases.test.ts
  - 6 条 edge-case 裁决门禁（frontmatter 豁免、容器隔离、song 穿透、translation target block list、百分号词法、inline tech 不跨行）
  - warning 行为覆盖（未闭合 comment/tech cue/song、translation 脱离 character）
- plugin.test.ts
  - 非 strict 收集 warning
  - strict 抛错
- ham.test.ts
  - 解析 example/ham.md 的集成测试

运行方式：
- pnpm test:run
- pnpm build

## 8. 已知限制（v0）

- 仍是行级解析器，不是 micromark 扩展
- 虽已完成 mdast 模块增强并收敛插件边界断言，但自定义节点生态兼容性仍需在真实 remark 链路中持续验证
- 容器隔离已增强为“仅 root-level 行触发 DraMark 指令”，但更完整的 CommonMark 容器语义（复杂列表/引用嵌套）仍有精化空间
- inline 自定义标记（`{}` / `$...$` / `<<...>>`）目前通过 fromMarkdown 后处理注入，词法优先级与容器语义仍待在 micromark 扩展阶段根治

## 9. 下一步建议

- 引入 micromark 扩展与 from-markdown bridge
- 增加复杂列表/引用嵌套场景的容器隔离测试与实现（进一步贴近 CommonMark）
- 增加 AST 快照测试，稳定后续重构
