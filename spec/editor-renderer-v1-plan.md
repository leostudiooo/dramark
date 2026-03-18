# DraMark Editor/Renderer v1 Plan (Web + VS Code, Legacy-First)

## Summary
Build a shared `core` package on top of current `parseDraMark` output, then ship two clients: a Web editor and a VS Code extension.
v1 is text-first editing with full-document debounced parse, Actor Script rendering as default, and `legacy` parser runtime as the only production semantic engine.

## Key Changes
- Shared architecture (single source of truth):
  - `sourceText` is canonical state.
  - On debounce (e.g., 150–250ms), run `parseDraMark(sourceText, options)` and produce `ParseViewModel`.
  - `ParseViewModel` includes: AST, warnings, metadata, outline, character blocks, translation pairs, song sections.
- New internal interfaces (core):
  - `EditorDocumentState`: `{ sourceText, parseResult, diagnostics, renderProfile }`.
  - `RenderProfile` (v1): `actor` only, but shape supports future `director`/`bilingual`.
  - `RendererNodeModel`: normalized renderer-friendly node projection from DraMark AST (no mutation of parser AST).
- Web app shell:
  - Left pane plain-text editor, right pane Actor Script preview.
  - Warning panel with line/column jump.
  - Outline panel (scenes/headings/characters) derived from AST.
- VS Code extension shell:
  - Document change listener + debounced parse.
  - Diagnostics from warnings (`UNCLOSED_*`, `TRANSLATION_OUTSIDE_CHARACTER`).
  - Preview webview rendering Actor Script using same core renderer.
- Runtime policy:
  - `legacy` parser only in v1 production path.
  - `micromark` remains non-user-facing experimental track; no runtime toggle in v1 UI.

## Test Plan
- Core unit tests:
  - AST → `RendererNodeModel` mapping for `character-block`, `translation-pair`, `song-container`, comments, tech cues.
  - Render profile behavior for Actor Script (e.g., technical/comment layers hidden by default).
  - Warning-to-diagnostics mapping keeps exact line/column.
- Integration tests:
  - Web: edit text → debounced parse → preview updates; warning jump targets correct lines.
  - VS Code: document change emits diagnostics and updates preview model.
  - Large document smoke: repeated edits do not break state consistency.
- Compatibility tests:
  - Use `example/ham.md` as baseline fixture to verify stable outline + actor rendering structure.
  - Regression test ensuring `parseDraMark(strictMode=true)` still does not throw in core path.

## Assumptions and Defaults
- v1 is text-first, not AST-authoring; no structural rewrite/save from AST.
- Full reparse + debounce is acceptable for v1 performance.
- Actor Script is the only user-facing render mode in v1.
- `legacy` runtime is required for complete DraMark semantics; micromark migration is deferred to later milestones.
- Existing parser package API remains unchanged; editor/renderer is an additive layer around current parser output.
