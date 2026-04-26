# AGENTS.md

Instructions for agentic coding agents working in the DraMark repository.

**Generated:** 2026-04-24
**Commit:** 70db26b
**Branch:** vscode-plugin-enhc

## Project Overview

DraMark (Drama Markdown) is a Remark plugin implementing a Markdown dialect for theater, film, and musical scriptwriting. It extends CommonMark with constructs for character dialogue (`@角色`), song containers (`$$`), translation pairs (`= 原文`), technical cues (`<<cue>>` / `<<<cue>>>`), inline actions (`{动作}`), and comments (`%`).

The package is ESM-only (`"type": "module"` in package.json) using `NodeNext` module resolution.

## Build / Test / Lint Commands

```bash
bun build            # Compile TypeScript to dist/ via tsc
bun test             # Run all tests in watch mode (Vitest)
bun test:run         # Run all tests once (CI mode)
bun test:run -- -t "translation"   # Run tests matching a name pattern
bun test src/tests/parser.test.ts  # Run a single test file
bun dev:web          # Start web app dev server
bun build:web        # Build web app
```

There is no linter or formatter configured. Rely on `bun build` (strict TS with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`) for correctness checks.

## Architecture

**Current mainline**: micromark-only + DraMark multipass. The `legacy` parser mode still exists in `src/parser.ts` but the plugin entry (`src/index.ts`) no longer exposes a mode switch — it always registers micromark extensions and uses the multipass pipeline.

### Multipass Pipeline (3–4 passes)

The parser intentionally splits work across passes to avoid conflicts between CommonMark and DraMark token boundaries:

| Pass | Input | Output | Responsibility |
|------|-------|--------|----------------|
| Pass 0 | Raw text | frontmatter metadata + body slice | Extract YAML frontmatter; preserve raw YAML in `metadata.frontmatterRaw` |
| Pass 1 | Body text | Inline lexical boundaries | Lock `<<...>>`, `$...$`, `{...}` boundaries so CommonMark does not consume them |
| Pass 2 | Line stream + boundaries | Block Stack segments | Root-level triggers (`@`, `$$`, `!!`, `=`, `%`, `<<<`) and deterministic close order |
| Pass 3 | Segment markdown | CommonMark mdast blocks | Materialize paragraphs, lists, blockquotes, code blocks, etc. |
| Pass 4 (optional) | Intermediate tree with placeholders | Final AST | Restore protected blocks so code-sanctuary literals are not lost |

Key invariants:
- Code sanctuary (fenced code / inline code) takes priority — DraMark markers inside code are literal.
- Block Stack close order: Translation → Character → Song.
- Root-level directives require no leading whitespace (indented lines are never DraMark triggers).

### AST Node Types

Custom MDAST node types defined in `src/types.ts`:

**Block-level**: `character-block`, `song-container`, `translation-pair`, `block-tech-cue`, `comment-line`, `comment-block`, `frontmatter`

**Inline-level**: `inline-action` (`{动作}`), `inline-song` (`$唱词$`), `inline-tech-cue` (`<<cue>>`), `inline-spoken`

Both inline markers support Unicode brackets: `｛｝` as alternative to `{}`.

### Key Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main plugin export, unified/remark integration |
| `src/parser.ts` | Multipass parser: Pass 0 (frontmatter) + Pass 2 (block-stack assembly) |
| `src/types.ts` | TS interfaces + mdast module augmentation |
| `src/inline-markers.ts` | Legacy inline marker helpers (historical compat, not the main path) |
| `src/m2-extensions.ts` | Micromark tokenizer extensions + from-markdown bridge (Pass 1 & 3) |
| `src/errors.ts` | `DraMarkParseError`, `defaultOptions()`, `warningToError()` |
| `src/core/` | Higher-level utilities: config normalizer, diagnostics, view-model, outline |

Tests live in `src/tests/`:

| File | Covers |
|------|--------|
| `parser.test.ts` | Parser unit tests (multipass + legacy) |
| `plugin.test.ts` | Unified plugin integration tests |
| `ham.test.ts` | Full document parsing (`example/ham.md`) |
| `edge-cases.test.ts` | Edge case coverage |
| `scan-segments.test.ts` | Phase 1 lexical scan unit tests |
| `core.test.ts` | Core module utilities |

### Frontmatter & Translation

- Frontmatter is extracted before parsing (`src/parser.ts` frontmatter slice logic); raw YAML is preserved in `metadata.frontmatterRaw`
- Translation mode is auto-enabled via frontmatter (`translation.enabled: true`) or via `translationEnabled` option
- Translation pairs use `=` prefix for source text followed by target text lines; orphan `=` lines outside character context generate `TRANSLATION_OUTSIDE_CHARACTER` warnings
- `translation.render_mode` is an optional hint (e.g. `bilingual`); interactive consumers may override it at runtime

## Code Style

### Imports
- Use ESM `import` with `.js` extensions: `import { parseDraMark } from './parser.js';`
- Type-only imports use `import type { ... }` syntax
- Prefer named exports; the plugin uses `export default remarkDraMark` only for the main entry

### Formatting
- 2-space indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in multiline constructs
- No trailing whitespace; files end with a newline

### Types
- Strict TypeScript (`"strict": true` in tsconfig)
- All exported functions must have explicit parameter and return types
- Use `satisfies` operator for type-checked object literals (e.g., `satisfies CommentBlock`)
- Custom AST node types defined in `src/types.ts` with mdast module augmentation at bottom of file
- Discriminated unions for segment/node types (e.g., `ScannedSegment` uses `kind` as discriminator)

### Naming Conventions
- Files: kebab-case (`inline-markers.ts`, `m2-extensions.ts`)
- Interfaces/Types: PascalCase (`DraMarkParseResult`, `CharacterBlock`)
- Functions: camelCase (`parseDraMark`, `scanSegments`, `transformInlineMarkersInTree`)
- Constants: camelCase (`defaultOptions`)
- Warning codes: UPPER_SNAKE_CASE (`UNCLOSED_SONG_CONTAINER`, `TRANSLATION_OUTSIDE_CHARACTER`)

### Error Handling
- `DraMarkParseError` extends `Error` with `line`, `column`, `code` fields (see `src/errors.ts`)
- Parser collects `DraMarkWarning[]` during parsing; returned in `result.warnings`
- In `strictMode`, first warning is thrown as `DraMarkParseError` via `warningToError()`
- Default options are merged through `defaultOptions()` helper — always use it instead of manual `??` chains

### Testing Patterns
- Use `import { describe, expect, it } from 'vitest'` (no globals needed since vitest config has `globals: true`)
- Test files are excluded from TypeScript compilation (`tsconfig.json` excludes `**/*.test.ts`)
- For parser tests: call `parseDraMark(input, options?)` directly and assert on `result.tree`, `result.warnings`, `result.metadata`
- For plugin tests: use `unified().use(remarkParse).use(remarkDraMark)` pipeline
- Join multi-line inputs with `.join('\n')` for readability in test fixtures

### AST Construction
- Content segments are parsed through `fromMarkdown()` from `mdast-util-from-markdown`, then post-processed by `transformInlineMarkersInTree()`
- Use `satisfies` when creating typed AST nodes: `{ type: 'comment-line', value: seg.value } satisfies CommentLine`
- The parser uses a flat segment list (Phase 1) consumed by a state machine assembler (Phase 3); CommonMark parsing (Phase 2) is embedded on-demand inside Phase 3

### General Guidelines
- Do NOT add comments unless explicitly asked
- Follow existing code patterns in neighboring files before introducing new ones
- The package manager is **bun** (lockfile: `bun.lockb`); workspace config via `"workspaces"` in root `package.json`
- When adding dependencies, verify they are already used in the codebase or get explicit approval
- Run `bun build` after making changes to verify type correctness
- Comments: `%` for line comments, `%%` for block comments; only included in AST when `includeComments: true`
- Escaping: backslash escapes `\@`, `\$`, `\%`, `\{`, `\}`, `\<`, `\>`, `\=`
- Module resolution: `NodeNext` for ESM output; package is ESM-only (`"type": "module"`)
- No Cursor rules or Copilot instructions are configured in this repo

## Anti-Patterns (Explicitly Forbidden)

- **No legacy mode in plugin**: `src/index.ts` always uses micromark-only multipass; do not reintroduce a `parserMode` switch
- **No manual `??` chains for options**: Always use `defaultOptions()` helper from `src/errors.ts`
- **No inline character declarations**: `DEPRECATED_INLINE_CHARACTER_DECLARATION` — character declarations must be standalone lines
- **No comments in code**: Do NOT add comments unless explicitly asked
- **No `Co-author: Claude` in commits**: Explicitly forbidden per `CLAUDE.md`
- **No CJS / `.cjs` imports**: ESM-only; all imports must use `.js` extensions
- **No type suppression**: Never use `as any`, `@ts-ignore`, `@ts-expect-error`
- **No empty catch blocks**: All errors must be handled explicitly
