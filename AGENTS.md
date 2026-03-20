# AGENTS.md

Instructions for agentic coding agents working in the DraMark repository.

## Project Overview

DraMark (Drama Markdown) is a Remark plugin implementing a Markdown dialect for theater, film, and musical scriptwriting. It extends CommonMark with constructs for character dialogue (`@角色`), song containers (`$$`), translation pairs (`= 原文`), technical cues (`<<cue>>` / `<<<cue>>>`), inline actions (`{动作}`), and comments (`%`).

The package is ESM-only (`"type": "module"` in package.json) using `NodeNext` module resolution.

## Build / Test / Lint Commands

```bash
pnpm build          # Compile TypeScript to dist/ via tsc
pnpm test           # Run all tests in watch mode (Vitest)
pnpm test:run       # Run all tests once (CI mode)
pnpm test:run -- -t "translation"   # Run tests matching a name pattern
pnpm test src/tests/parser.test.ts  # Run a single test file
pnpm dev:web        # Start web app dev server
pnpm build:web      # Build web app
```

There is no linter or formatter configured. Rely on `pnpm build` (strict TS with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`) for correctness checks.

## Architecture

Two parser modes controlled by `parserMode` option:

- **`legacy` (default)**: Custom `parseDraMark()` in `src/parser.ts` — a line-by-line state machine that produces the full AST (character blocks, song containers, translation pairs).
- **`micromark`**: Micromark tokenizer extensions in `src/m2-extensions.ts` for inline markers only; block-level parsing handled by standard remark-parse.

### Core State Machine (legacy mode)

The legacy parser maintains a 2D state at `src/parser.ts:44`:
- **Performance Context**: `global` (stage directions) vs `character` (dialogue)
- **Musical Context**: `spoken` vs `sung` (within `$$` containers)

Key state transitions:
- `@角色名` → enters character context
- `---` or `***` → resets to global context
- `$$` → toggles song container context

### Multipass Architecture

The plugin uses an intentional 3-4 pass pipeline:
1. Micromark marking pass (inline lexical precedence, e.g. `<<...>>`)
2. DraMark marking/protection/structure parse
3. Micromark parse pass (CommonMark/mdast materialization)
4. DraMark restore/de-protect pass (when placeholders are used)

### AST Node Types

Custom MDAST node types defined in `src/types.ts`:

**Block-level**: `character-block`, `song-container`, `translation-pair`, `block-tech-cue`, `comment-line`, `comment-block`, `frontmatter`

**Inline-level**: `inline-action` (`{动作}`), `inline-song` (`$唱词$`), `inline-tech-cue` (`<<cue>>`)

Both inline markers support Unicode brackets: `｛｝` as alternative to `{}`.

### Key Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main plugin export, unified/remark integration |
| `src/parser.ts` | Legacy parser with Phase 1 (lex scan) + Phase 3 (assembly) |
| `src/types.ts` | TS interfaces + mdast module augmentation |
| `src/inline-markers.ts` | Inline marker parsing (`{}`, `$...$`, `<<>>`) for legacy mode |
| `src/m2-extensions.ts` | Micromark tokenizer extensions |
| `src/errors.ts` | `DraMarkParseError` class, `defaultOptions()`, `warningToError()` |
| `src/core/` | Higher-level utilities: config normalizer, diagnostics, view-model, outline |

Tests live in `src/tests/`:

| File | Covers |
|------|--------|
| `parser.test.ts` | Legacy parser unit tests |
| `plugin.test.ts` | Unified plugin integration (legacy + micromark modes) |
| `ham.test.ts` | Full document parsing (`example/ham.md`) |
| `edge-cases.test.ts` | Edge case coverage |
| `scan-segments.test.ts` | Phase 1 lexical scan unit tests |
| `core.test.ts` | Core module utilities |

### Frontmatter & Translation

- Frontmatter is extracted before parsing (`src/parser.ts:194-208`); raw YAML is preserved in `metadata.frontmatterRaw`
- Translation mode is auto-enabled via frontmatter (`translation.enabled: true`) or via `translationEnabled` option
- Translation pairs use `=` prefix for source text followed by target text lines; orphan `=` lines outside character context generate `TRANSLATION_OUTSIDE_CHARACTER` warnings

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
- The `pnpm-lock.yaml` lockfile indicates `pnpm` is the package manager
- When adding dependencies, verify they are already used in the codebase or get explicit approval
- Run `pnpm build` after making changes to verify type correctness
- Comments: `%` for line comments, `%%` for block comments; only included in AST when `includeComments: true`
- Escaping: backslash escapes `\@`, `\$`, `\%`, `\{`, `\}`, `\<`, `\>`, `\=`
- Module resolution: `NodeNext` for ESM output; package is ESM-only (`"type": "module"`)
- No Cursor rules or Copilot instructions are configured in this repo
