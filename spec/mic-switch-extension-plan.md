# 麦克风分配/换麦语法扩展计划（前端可配置解析，非核心语法硬编码）

## Summary
在不改动 DraMark 核心 parser 语法的前提下，为 app/扩展新增“换麦指令识别层”。
该层由前端读取 `frontmatter.tech` 的可配置关键词与默认行为，识别换麦指令并生成结构化 `MicEvent`，用于时间线、提示和一键筛选。
v1 不做 group 级换麦指令，避免“组内逐人麦位”歧义；仍支持按角色逐条声明。

## Key Changes
- 解析归属与边界：
  - `parseDraMark` 保持现状，不新增强制关键词语法。
  - app/扩展自行解析 `<<...>>` 内容识别换麦指令。
  - 2026-03-19 补充：legacy parser 已保证 `<<...>>` 在常见 html-split 词法场景下仍归一化为 `inline-tech-cue`；应用层可优先消费该节点。
- 指令输入形态：
  - **行内 tech cue**：`<<...>>` 内使用简洁语法（`=`, `->`）。
  - **行间 tech cue**：独占行的 `<<< ... >>>` 块提示，同样使用简洁语法。
    - 单行形式：`<<<role:HM1->HM2>>>`
    - 多行形式：
      ```
      <<<
      role1=HM1
      role2:HM2
      >>>
      ```
- 配置模型（frontmatter，允许缺省与自定义）：
  - `tech.defaultMicBehavior`：默认目标解析策略（例如“省略 target 时绑定当前角色”）。
  - `tech.mics[]` 继续作为可用麦池字典；未知字段透传。
  - `casting.characters[].actor?` 与 `casting.characters[].mic?` 作为可选角色元信息（用于排练视图和默认分配）。
- 事件模型（前端内部类型）：
  - `MicEvent`: `{ line, raw, action: 'switch', targetRoleName, fromMic?, toMic, source: 'inline-cue'|'tech-block' }`
  - `targetRoleName` 缺省时：在角色上下文内自动绑定当前角色；无上下文则发 warning 并忽略。
  - `fromMic` 缺省时可回退到角色 `mic`（默认麦，若有）。
- 角色匹配策略（兼容简化）：
  - 默认按 `name` 匹配角色。
  - 重名时建议在 frontmatter 提供 `id` 并在前端消歧；无 `id` 不阻断，仅 warning。
- v1 明确不做：
  - `@group` 直接换麦语法。
  - parser 内硬编码固定英文关键词。

## Test Plan
- 识别层单测：
  - 简洁语法（`=`, `->`）正确识别为 `MicEvent`。
  - 行内 cue（`<<...>>`）与行间 cue（`<<< ... >>>`）均可解析。
  - 省略 target 时在角色上下文自动绑定当前角色。
  - 非角色上下文省略 target 触发 `MicDiagnostic`。
  - 重名角色无 `id` 时给 warning，不抛错。
- 集成测试（app/扩展）：
  - 编辑文本后，换麦事件面板实时更新。
  - 按角色筛选时可看到该角色全部换麦事件。
  - 含未知关键词时保持正文渲染不受影响，仅记录诊断。
- 回归测试：
  - 现有 DraMark 文档（无换麦指令）解析结果和渲染行为不变。

## Assumptions and Defaults
- 默认行为：`targetRoleName` 可缺省，且在角色上下文内自动使用当前 `@角色`。
- 默认不要求角色 `id`；非重名场景直接按名字完成匹配。
- group 级换麦延后到后续版本，如需支持将通过“显式 member->mic 映射”再引入。
- 该能力先落在 app/扩展层，待关键词体系稳定后再评估是否下沉到 parser 正式节点。
- `$$` 上下文中的 `$...$` 会按普通文本处理，不应与换麦 cue 识别流程产生冲突。
