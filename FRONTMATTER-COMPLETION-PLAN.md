# Frontmatter 自动补全修复计划

## 问题现状

Frontmatter 内**零补全**。原因链：

1. `completion-provider.ts:229` — `isInsideFrontmatter()` 为 true 时 `return undefined`
2. `yaml-schema.ts` 的 `registerContributor` 注册到 redhat YAML 扩展，但 YAML 扩展只对 `languageId === 'yaml'` 的文档生效；`embeddedLanguages` 只影响语法高亮，不影响语言功能
3. `FRONTMATTER_ROOT_KEYS` / `FRONTMATTER_CHILD_KEYS`（~200 行）是死代码，从未被引用

结论：**redhat YAML 扩展不可能为 dramark 文档的嵌入 YAML 区域提供补全**，必须自行实现。

---

## Phase 1: 激活死代码 + 基本结构

**目标**：让 frontmatter 内的 Ctrl+Space 能弹出 YAML key 补全

### 1.1 改造 `completion-provider.ts`

- 删除 `isInsideFrontmatter()` 的 early return（line 229-231）
- 在 `provideCompletionItems()` 中新增 frontmatter 分支：
  ```
  if (isInsideFrontmatter(document, position)) {
    return collectFrontmatterCompletions(document, position);
  }
  ```
- 新增 `collectFrontmatterCompletions()` 函数，根据光标所在的 YAML 路径层级返回对应补全

### 1.2 实现 YAML 路径推断

新增 `inferYamlPath(document, position)` 函数：
- 从 frontmatter 起始行向下扫描到光标行
- 根据缩进推断当前所在的 YAML 路径（如 `casting.characters[].name`）
- 返回路径数组 `['casting', 'characters']` 或根级别标识

算法：
1. 从 `startLine + 1` 扫描到 `position.line`
2. 每行按 `^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:` 匹配 key
3. 用缩进层级维护路径栈（缩进增大 → push，缩进减小 → pop 到对应层级）
4. `- ` 开头的行表示数组元素，路径栈不变
5. 返回最终的路径栈

### 1.3 利用已有的 `FRONTMATTER_ROOT_KEYS` / `FRONTMATTER_CHILD_KEYS`

- 路径栈为空或只有一级未完成 key → 返回 `FRONTMATTER_ROOT_KEYS`
- 路径栈顶匹配 `FRONTMATTER_CHILD_KEYS` 的某个 key → 返回对应的子 key 列表
- 不匹配 → 返回空（不干扰用户自定义 key）

---

## Phase 2: 对齐补全规格与实际类型

**目标**：补全建议与 `config-normalizer.ts` / `types.ts` 定义的 schema 完全一致

### 2.1 修正 `FRONTMATTER_CHILD_KEYS` 的不一致

| 问题 | 死代码当前值 | 应该对齐到 |
|------|-------------|-----------|
| `translation.render_mode` | `render_mode` | 保留 `render_mode`（`TranslationConfig` 两个都有） |
| `translation.render` | 缺失 | 补充 `render` |
| `tech.keywords` 子项 | `token, label, color` | `token, label`（`TechKeywordEntry` 无 color） |
| `tech` 下的动态分类 | 固定 `sfx`, `lx` | 改为通用提示，不限定具体分类名 |
| `use_frontmatter_from` | 在 `FRONTMATTER_ROOT_KEYS` | 删除（normalizer 不识别，放入 `extras`） |

### 2.2 补充缺失的补全项

- `translation` 子项补充 `render`（`render_mode` 也保留，两个都在 `TranslationConfig` 中）
- `casting.groups.<name>.members` 的补全建议来自 `casting.characters[].name`（从 viewModel.config 获取）
- `tech.mics` 子项对齐 `TechEntry`：`id`, `label`, `desc`（删除当前错误的 `color`）
- `tech` 下非 `mics`/`keywords`/`color` 的 key → 提示为动态分类，子项为 `color` + `entries`（对齐 `TechCategory`）

### 2.3 值补全（可选增强）

- `translation.enabled` → 补全 `true` / `false`
- `casting.characters[].mic` → 补全来自 `tech.mics[].id`
- `casting.characters[].aliases` → 已有 `[]` snippet，保留

---

## Phase 3: 清理与加固

**目标**：移除对 redhat YAML 扩展的无效依赖

### 3.1 移除 `yaml-schema.ts`

- 文件整体删除
- `extension.ts` 中移除 `import` 和 `registerYamlSchema()` 调用
- 理由：`registerContributor` 在当前架构下不可能生效

### 3.2 修改 `package.json`

- `extensionPack` 中的 `redhat.vscode-yaml` → 移除（不再需要）
  - 如果将来想恢复 YAML 智能提示，需要改用 `vscode.languages.registerCompletionItemProvider` + yaml parser 自己做，或改为将 frontmatter 区域虚拟化成独立文档（复杂度高，不做）
- 或者降级为可选推荐：在 `extensionDependencies` 中移除，在 README 中注明推荐安装

### 3.3 添加 Ctrl+Space 触发支持

- 当前 `registerCompletionItemProvider` 只注册了 `@` 和 `<` 两个触发字符
- Ctrl+Space（显式请求补全）也能触发 `provideCompletionItems()`，这由 VSCode 保证
- **不需要额外注册触发字符**，但需确保 frontmatter 分支在显式请求时也能工作
- 测试验证：光标在空行按 Ctrl+Space 应弹出根级 key 列表

---

## Phase 4: 测试

**目标**：关键路径有测试覆盖

### 4.1 单元测试：`inferYamlPath()`

- `apps/vscode-extension` 目前没有测试框架，放在 `src/tests/` 下（与项目现有测试一起）
- 测试用例：
  - 空行 → 根级别
  - `meta:` 的下一行 → `['meta']`
  - `casting.characters:` 的子项 → `['casting', 'characters']`
  - 嵌套缩进回退 → 路径栈正确 pop
  - 数组元素 `- name:` → 路径栈不变

### 4.2 单元测试：`collectFrontmatterCompletions()`

- 根级别 → 返回 4 个 key（meta, casting, translation, tech）
- `translation:` 下一行 → 返回 enabled, source_lang, target_lang, render_mode, render
- 不存在的路径 → 返回空数组
- `casting.characters[].mic` → 如果 config 有 mics 数据，返回 mic id 列表

### 4.3 手动验证清单

- [ ] 打开 .dramark 文件，frontmatter 空行 Ctrl+Space → 弹出 4 个根 key
- [ ] 输入 `cas` → 过滤出 `casting`
- [ ] 在 `translation:` 下一行 Ctrl+Space → 弹出 enabled/source_lang/target_lang/render_mode/render
- [ ] 在 `casting:` 下一行 Ctrl+Space → 弹出 characters/groups
- [ ] 在 `tech:` 下一行 Ctrl+Space → 弹出 mics/keywords/color
- [ ] 正文区域 `@` 补全仍正常工作
- [ ] 正文区域 `<<` 补全仍正常工作
- [ ] 无 frontmatter 的文档中正文补全正常

---

## 涉及的文件

| 文件 | 操作 |
|------|------|
| `apps/vscode-extension/src/completion-provider.ts` | 重写 `provideCompletionItems()`，新增 `collectFrontmatterCompletions()`、`inferYamlPath()`，更新 `FRONTMATTER_ROOT_KEYS`/`FRONTMATTER_CHILD_KEYS` |
| `apps/vscode-extension/src/yaml-schema.ts` | 删除 |
| `apps/vscode-extension/src/extension.ts` | 移除 yaml-schema import 和调用 |
| `apps/vscode-extension/package.json` | 移除 `extensionPack` 中的 `redhat.vscode-yaml` |
| `apps/core/completions.ts` | 不变（只负责正文补全） |
| `src/tests/` | 新增 frontmatter 补全测试文件 |

---

## 不做的事

- **不引入 yaml parser 依赖**做补全 — 用简单的缩进推断即可
- **不实现 YAML 值类型验证** — 由 diagnostics pipeline 负责
- **不保留 redhat YAML 扩展集成** — 当前架构不可行，移除避免误导
- **不做 snippet 补全**（如整个 `casting` 模板）— 范围太大，后续迭代
