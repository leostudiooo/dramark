# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

NEVER ADD "Co-author: Claude" TO COMMIT MESSAGES. This file is for internal use only and should not be referenced in commit messages or documentation.

## Project Overview

DraMark (Drama Markdown) is a Remark plugin for a Markdown dialect designed for theater, film, and musical scriptwriting. It extends CommonMark with constructs for character dialogue, song containers, translation pairs, technical cues (lighting/sound), and stage directions.

## Build & Development Commands

```bash
# Build the TypeScript project
bun build

# Run all tests in watch mode
bun test

# Run all tests once (for CI)
bun test:run

# Run a specific test file
bun test src/tests/parser.test.ts

# Run tests matching a specific pattern
bun test -- -t "translation"
```

## Architecture

### Parser Dual-Mode Architecture

The plugin operates in two parser modes controlled by `parserMode` option:

- **`legacy` mode (default)**: Uses the custom `parseDraMark()` function in [parser.ts](src/parser.ts) which implements a line-by-line state machine parser. This parses the full document structure including character blocks, song containers, and translation pairs.

- **`micromark` mode**: Uses [m2-extensions.ts](src/m2-extensions.ts) to register micromark tokenizer extensions for inline markers only (actions, songs, tech cues). Block-level constructs are parsed by standard remark-parse. In this mode, the plugin does not replace `tree.children` but enriches the AST via micromark tokenizers.

### Core State Machine Model

The legacy parser in [parser.ts](src/parser.ts:44) maintains a 2D state:
- **Performance Context**: `global` (stage directions) vs `character` (dialogue)
- **Musical Context**: `spoken` vs `sung` (within `$$` containers)

Key state transitions:
- `@角色名` → enters character context
- `---` or `***` → resets to global context
- `$$` → toggles song container context

### AST Node Types

The parser produces custom MDAST node types defined in [types.ts](src/types.ts):

**Block-level**: `character-block`, `song-container`, `translation-pair`, `block-tech-cue`, `comment-line`, `comment-block`, `frontmatter`

**Inline-level**: `inline-action` (`{动作}`), `inline-song` (`$唱词$`), `inline-tech-cue` (`<<cue>>`)

TypeScript module augmentation for mdast is at [types.ts](src/types.ts:102-118).

### Translation Pair Handling

Translation pairs use `=` prefix for source text (original language) followed by target text lines:

```markdown
@Character
= Original English line
译配后的中文台词
= Next original line
下一句译配
```

Translation mode is auto-enabled via frontmatter (`translation.enabled: true`) or explicitly via `translationEnabled` option. In [parser.ts](src/parser.ts:150-167), orphan `=` lines outside character context generate warnings.

### Inline Marker Parsing

Inline markers are processed in two ways:
1. Legacy mode: [inline-markers.ts](src/inline-markers.ts:21) parses `{动作}`, `$唱词$`, `<<tech>>` via regex scanning
2. Micromark mode: [m2-extensions.ts](src/m2-extensions.ts:131-259) implements state machine tokenizers for the same markers

Both support Unicode brackets: `｛｝` as alternative to `{}`.

### Error Handling

Warnings (defined in [types.ts](src/types.ts:76-85)) are collected during parsing:
- `UNCLOSED_BLOCK_COMMENT`, `UNCLOSED_BLOCK_TECH_CUE`, `UNCLOSED_SONG_CONTAINER`
- `TRANSLATION_OUTSIDE_CHARACTER`

In `strictMode`, warnings are thrown as `DraMarkParseError` (see [errors.ts](src/errors.ts:25-27)).

## Key Source Files

| File | Purpose |
|------|---------|
| [src/index.ts](src/index.ts) | Main plugin export, unified/remark integration |
| [src/parser.ts](src/parser.ts) | Legacy parser implementation with state machine |
| [src/types.ts](src/types.ts) | TypeScript interfaces and mdast type augmentation |
| [src/inline-markers.ts](src/inline-markers.ts) | Inline marker parsing for legacy mode |
| [src/m2-extensions.ts](src/m2-extensions.ts) | Micromark tokenizer extensions |
| [src/errors.ts](src/errors.ts) | Error classes and options handling |

## Testing Patterns

Tests use Vitest and are organized by concern:
- [parser.test.ts](src/tests/parser.test.ts) - Legacy parser unit tests
- [plugin.test.ts](src/tests/plugin.test.ts) - Unified plugin integration tests, includes micromark mode tests
- [ham.test.ts](src/tests/ham.test.ts) - Full document parsing (loads [example/ham.md](example/ham.md))
- [edge-cases.test.ts](src/tests/edge-cases.test.ts) - Edge case coverage

Test utilities: Use `parseDraMark(input, options)` for direct parser access or `unified().use(remarkParse).use(remarkDraMark)` for plugin testing.

## Important Implementation Notes

- **Frontmatter**: Extracted before parsing ([parser.ts](src/parser.ts:194-208)); raw YAML is preserved in `metadata.frontmatterRaw` for upstream normalization
- **Comments**: `%` for line comments, `%%` for block comments; only included in AST when `includeComments: true`
- **Escaping**: Backslash escapes `\@`, `\$`, `\%`, `\{`, `\}`, `\<`, `\>`, `\=`
- **Module Resolution**: Uses `NodeNext` for ESM output; package is ESM-only (`"type": "module"`)
