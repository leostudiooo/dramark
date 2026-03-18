# DraMark Editor/Renderer v1 Plan (Web + VS Code, Legacy-First)

## Summary
Build a shared `core` package on top of current `parseDraMark` output, then ship two clients: a Web editor and a VS Code extension.
v1 is text-first editing with full-document debounced parse, Actor Script rendering as default, and `legacy` parser runtime as the only production semantic engine.
Frontmatter is treated as a document config layer (not DraMark core grammar): parser extracts raw payload + minimal flags, while app/extension normalize and consume config.

## Key Changes
- Shared architecture (single source of truth):
  - `sourceText` is canonical state.
  - On debounce (e.g., 150–250ms), run `parseDraMark(sourceText, options)` and produce `ParseViewModel`.
  - `ParseViewModel` includes: AST, warnings, metadata, outline, character blocks, translation pairs, song sections.
  - `ParseViewModel.metadata` uses parser-provided `frontmatterRaw?: string` and `translationEnabledFromFrontmatter`.
- New internal interfaces (core):
  - `EditorDocumentState`: `{ sourceText, parseResult, diagnostics, renderProfile }`.
  - `RenderProfile` (v1): `actor` only, but shape supports future `director`/`bilingual`.
  - `RendererNodeModel`: normalized renderer-friendly node projection from DraMark AST (no mutation of parser AST).
  - `DocumentConfig` (app-level, normalized from frontmatter): `{ meta?, casting?, translation?, tech?, extras }`.
  - `casting` modeling rule:
    - group definitions live only in `casting.groups`.
    - `@角色` parsing does not carry group metadata.
    - group expansion (`@husbands` → members) is resolved in app/extension from `casting.groups`.
    - default lookup key is `name`; `id` is optional and only required for disambiguation in duplicate-name scenarios.
  - `tech` modeling rule:
    - normalize `mics/sfx/lx/keywords` dictionaries.
    - enforce per-category id uniqueness in diagnostics (non-fatal).
  - `normalizeFrontmatter(frontmatterRaw)` utility:
    - Accepts raw YAML string from parser metadata.
    - Normalizes recommended namespaces: `meta`, `casting`, `translation`, `tech`.
    - Preserves unknown fields in `extras` (forward-compatible).
    - Emits non-fatal config diagnostics for obvious type mismatches.
- Web app shell:
  - Left pane plain-text editor, right pane Actor Script preview.
  - Warning panel with line/column jump.
  - Outline panel (scenes/headings/characters) derived from AST.
  - Config side-panel reads normalized `DocumentConfig` (角色分组、译配策略、技术字典仅展示/消费，不反向改写正文语法).
  - 渲染器要求（2026-03-19 更新）：
    - `song-container` 内部必须递归渲染真实 `character-block`，不得降级为占位符。
    - 行内 `inline-tech-cue` 必须可视化展示（例如 cue chip），不可丢失为普通 HTML 片段。
    - `$$` 上下文中 `$...$` 默认按普通文本渲染（与 parser 行为一致）。
- VS Code extension shell:
  - Document change listener + debounced parse.
  - Diagnostics from warnings (`UNCLOSED_*`, `TRANSLATION_OUTSIDE_CHARACTER`).
  - Preview webview rendering Actor Script using same core renderer.
  - Extension diagnostics merges parser warnings + config diagnostics from `normalizeFrontmatter`.
- Runtime policy:
  - `legacy` parser only in v1 production path.
  - `micromark` remains non-user-facing experimental track; no runtime toggle in v1 UI.

## Test Plan
- Core unit tests:
  - AST → `RendererNodeModel` mapping for `character-block`, `translation-pair`, `song-container`, comments, tech cues.
  - Render profile behavior for Actor Script (e.g., technical/comment layers hidden by default).
  - Warning-to-diagnostics mapping keeps exact line/column.
  - `normalizeFrontmatter` tests:
    - parse recommended namespaces (`meta/casting/translation/tech`) correctly.
    - unknown fields are preserved in `extras`.
    - obvious type errors produce config diagnostics without blocking render.
    - group single-source rule: only `casting.groups` drives grouping behavior.
    - non-duplicate names work without ids for both `@role` lookup and group-member lookup.
    - `tech` category id collisions produce warnings, not hard failures.
- Integration tests:
  - Web: edit text → debounced parse → preview updates; warning jump targets correct lines.
  - Web: `song-container` 内 `character-block` 正常渲染，且不会出现 `[character-block]` 占位符退化。
  - Web: `<<...>>` 在 legacy 解析链路下稳定渲染为 cue（包含底层 html-split 场景）。
  - Web: `$$` 内 `$...$` 不生成 `inline-song`，回退普通文本。
  - VS Code: document change emits diagnostics and updates preview model.
  - Frontmatter present/absent does not change body parse semantics; only config view/behavior updates.
  - `translation.enabled` from normalized config remains compatible with parser metadata behavior.
  - Group filter flow: selecting one person or one group returns expected line subset.
  - `@group` alias resolution behaves deterministically from normalized `casting.groups`.
  - Large document smoke: repeated edits do not break state consistency.
- Compatibility tests:
  - Use `example/ham.md` as baseline fixture to verify stable outline + actor rendering structure.
  - Regression test ensuring `parseDraMark(strictMode=true)` still does not throw in core path.
  - Regression test ensuring `frontmatterRaw` passthrough is available to app/extension normalization pipeline.

## Assumptions and Defaults
- v1 is text-first, not AST-authoring; no structural rewrite/save from AST.
- Full reparse + debounce is acceptable for v1 performance.
- Actor Script is the only user-facing render mode in v1.
- `legacy` runtime is required for complete DraMark semantics; micromark migration is deferred to later milestones.
- Parser keeps a minimal metadata contract (`frontmatterRaw`, `translationEnabledFromFrontmatter`) and does not enforce strict frontmatter schema.
- Existing parser package remains body-semantic focused; frontmatter business validation lives in app/extension layer.
