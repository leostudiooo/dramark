import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Content, Heading, ThematicBreak } from 'mdast';
import { defaultOptions } from './errors.js';
import { parseInlineContent, transformInlineMarkersInTree } from './inline-markers.js';
import type {
  BlockTechCue,
  CharacterBlock,
  CommentBlock,
  CommentLine,
  DraMarkOptions,
  DraMarkParseResult,
  DraMarkRoot,
  DraMarkRootContent,
  DraMarkWarning,
  FrontmatterBlock,
  SongContainer,
  TranslationPair,
} from './types.js';

// ─── Phase 1 types: Lexical Shield ───────────────────────────────────────────
//
// scanSegments() converts raw input lines into a flat list of ScannedSegments.
// Each segment corresponds to exactly one DraMark block-level construct or a
// run of CommonMark content lines. No DraMark state (character context, song
// context) is tracked here — that belongs to Phase 3 (assembly).

export type ScannedSegment =
  | { kind: 'song-toggle'; lineNo: number }
  | { kind: 'heading'; raw: string; lineNo: number }
  | { kind: 'thematic-break'; lineNo: number }
  | { kind: 'comment-block'; value: string; closed: boolean; lineNo: number }
  | { kind: 'block-tech-cue'; value: string; closed: boolean; lineNo: number }
  | { kind: 'comment-line'; value: string; lineNo: number }
  | { kind: 'character'; name: string; names: string[]; mood?: string; lineNo: number }
  | { kind: 'translation-source'; text: string; lineNo: number }
  | { kind: 'content'; lines: string[]; lineNo: number };

/**
 * Phase 1 — Lexical scan.
 *
 * Walks `lines` starting at `startIndex` and emits one `ScannedSegment` per
 * DraMark block-level directive or per run of content lines. No DraMark
 * semantic state is tracked here. The resulting array is then consumed by
 * `parseDraMark`'s Phase-3 assembler.
 *
 * Exported for independent unit testing.
 */
export function scanSegments(lines: string[], startIndex: number): ScannedSegment[] {
  const segments: ScannedSegment[] = [];
  let index = startIndex;
  let contentBuffer: string[] = [];
  // `contentStartLine` is the 0-based index of the first line currently in
  // `contentBuffer`.  It is kept in sync every time the buffer is flushed and
  // reset.  Adding 1 converts it to the 1-based line number stored on the
  // emitted segment.
  let contentStartLine = startIndex;

  function flushContent(): void {
    if (contentBuffer.length === 0) {
      return;
    }
    segments.push({ kind: 'content', lines: [...contentBuffer], lineNo: contentStartLine + 1 });
    contentBuffer = [];
  }

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const lineNo = index + 1;
    const isRoot = isRootDirectiveLine(rawLine);

    // ── Song container toggle $$
    if (isRoot && trimmed === '$$') {
      flushContent();
      segments.push({ kind: 'song-toggle', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    // ── ATX heading (# … ###### )
    if (isRootHeading(rawLine)) {
      flushContent();
      segments.push({ kind: 'heading', raw: rawLine, lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    // ── Thematic break / context reset --- *** ___
    if (isRootReset(rawLine)) {
      flushContent();
      segments.push({ kind: 'thematic-break', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    // ── Block comment %% … %%
    if (isRoot && trimmed === '%%') {
      flushContent();
      const result = consumeBlockComment(lines, index);
      segments.push({ kind: 'comment-block', value: result.value, closed: result.closed, lineNo });
      index = result.nextIndex;
      contentStartLine = index;
      continue;
    }

    // ── Block tech cue <<< … >>>
    if (isRoot && trimmed.startsWith('<<<')) {
      flushContent();
      const result = consumeBlockTechCue(lines, index);
      segments.push({ kind: 'block-tech-cue', value: result.value, closed: result.closed, lineNo });
      index = result.nextIndex;
      contentStartLine = index;
      continue;
    }

    // ── Line comment % …
    if (isRoot && isLineComment(rawLine)) {
      flushContent();
      segments.push({ kind: 'comment-line', value: rawLine.trim().slice(1).trim(), lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    // ── Character declaration @Name [Mood]
    if (isRoot) {
      const charInfo = parseCharacterDeclaration(trimmed);
      if (charInfo !== null) {
        flushContent();
        segments.push({ kind: 'character', name: charInfo.name, names: charInfo.names, mood: charInfo.mood, lineNo });
        index += 1;
        contentStartLine = index;
        continue;
      }
    }

    // ── Translation source = …
    if (isRoot && trimmed.startsWith('= ')) {
      flushContent();
      segments.push({ kind: 'translation-source', text: trimmed.slice(2).trim(), lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    // ── Regular content line (accumulated into a buffer)
    contentBuffer.push(rawLine);
    index += 1;
  }

  flushContent();
  return segments;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function parseDraMark(input: string, options?: DraMarkOptions): DraMarkParseResult {
  const opts = defaultOptions(options);
  const lines = input.split(/\r?\n/u);
  const warnings: DraMarkWarning[] = [];
  const root: DraMarkRoot = { type: 'root', children: [] };

  // ── Phase 0: Extract YAML frontmatter ────────────────────────────────────
  const frontmatter = consumeFrontmatter(lines);
  let translationFromFrontmatter = false;
  if (frontmatter !== null) {
    translationFromFrontmatter = /translation\s*:\s*[\s\S]*?enabled\s*:\s*true/iu.test(frontmatter.value);
    root.children.push(frontmatter);
  }

  const translationEnabled = opts.translationEnabled || translationFromFrontmatter;
  const startIndex = frontmatter !== null ? frontmatter.endLine + 1 : 0;

  // ── Phase 1: Lexical scan — build flat segment list ──────────────────────
  const segments = scanSegments(lines, startIndex);

  // ── Phase 3: DraMark assembly — apply state machine over segments ─────────
  //
  // "Phase 2" (CommonMark parsing via fromMarkdown) is embedded inside the
  // assembler: content segments are parsed on-demand as they are encountered.

  let inSong = false;
  let currentSong: SongContainer | null = null;
  let currentCharacter: CharacterBlock | null = null;

  function currentContainer(): DraMarkRootContent[] {
    if (currentSong !== null) {
      return currentSong.children as DraMarkRootContent[];
    }
    return root.children;
  }

  function pushNode(node: DraMarkRootContent): void {
    if (currentCharacter !== null) {
      currentCharacter.children.push(node);
    } else {
      currentContainer().push(node);
    }
  }

  let si = 0;
  while (si < segments.length) {
    const seg = segments[si];

    switch (seg.kind) {
      // ── $$ toggle
      case 'song-toggle': {
        if (inSong) {
          inSong = false;
          currentSong = null;
          currentCharacter = null;
        } else {
          const song: SongContainer = { type: 'song-container', children: [] };
          root.children.push(song);
          inSong = true;
          currentSong = song;
          currentCharacter = null;
        }
        si += 1;
        break;
      }

      // ── Heading: always at root, breaks out of song container
      case 'heading': {
        currentCharacter = null;
        if (inSong) {
          inSong = false;
          currentSong = null;
        }
        root.children.push(asHeading(seg.raw));
        si += 1;
        break;
      }

      // ── Thematic break: resets character context; stays inside song container
      case 'thematic-break': {
        currentCharacter = null;
        currentContainer().push(asThematicBreak());
        si += 1;
        break;
      }

      // ── Block comment %%
      case 'comment-block': {
        if (!seg.closed) {
          warnings.push({
            code: 'UNCLOSED_BLOCK_COMMENT',
            message: 'Comment block started with %% but did not close with %%.',
            line: seg.lineNo,
            column: 1,
          });
        }
        if (opts.includeComments) {
          pushNode({ type: 'comment-block', value: seg.value } satisfies CommentBlock);
        }
        si += 1;
        break;
      }

      // ── Block tech cue <<< >>>
      case 'block-tech-cue': {
        if (!seg.closed) {
          warnings.push({
            code: 'UNCLOSED_BLOCK_TECH_CUE',
            message: 'Tech cue block started with <<< but did not close with >>>.',
            line: seg.lineNo,
            column: 1,
          });
        }
        pushNode({ type: 'block-tech-cue', value: seg.value } satisfies BlockTechCue);
        si += 1;
        break;
      }

      // ── Line comment %
      case 'comment-line': {
        if (opts.includeComments) {
          pushNode({ type: 'comment-line', value: seg.value } satisfies CommentLine);
        }
        si += 1;
        break;
      }

      // ── Character declaration @Name [Mood]
      case 'character': {
        const char: CharacterBlock = {
          type: 'character-block',
          name: seg.name,
          names: seg.names,
          mood: seg.mood,
          children: [],
        };
        currentContainer().push(char);
        currentCharacter = char;
        si += 1;
        break;
      }

      // ── Translation source = …
      //
      // Peek at the immediately following segment: if it is a `content`
      // segment, it is the translation target (scanSegments() never emits two
      // adjacent content segments, so there is at most one).  `nextSi` is the
      // index we will resume from after handling both segments.
      case 'translation-source': {
        if (!translationEnabled || currentCharacter === null) {
          warnings.push({
            code: 'TRANSLATION_OUTSIDE_CHARACTER',
            message: 'Translation pair requires translation mode and character context.',
            line: seg.lineNo,
            column: 1,
          });
          // Treat the source line as plain content so it appears in the tree.
          const fallback = parseMarkdownBlocks(`= ${seg.text}`, { allowInlineSong: !inSong });
          for (const block of fallback) {
            pushNode(block);
          }
          si += 1;
          break;
        }

        const nextSi = si + 1;
        const targetSeg =
          nextSi < segments.length && segments[nextSi].kind === 'content'
            ? (segments[nextSi] as Extract<ScannedSegment, { kind: 'content' }>)
            : null;

        const targetBlocks = parseMarkdownBlocks((targetSeg?.lines ?? []).join('\n'), { allowInlineSong: !inSong });
        const pair: TranslationPair = {
          type: 'translation-pair',
          sourceText: seg.text,
          target: targetBlocks,
          children: targetBlocks,
        };
        currentCharacter.children.push(pair);
        // Advance past the translation-source; also skip the content segment if
        // it was consumed as the translation target.
        si = targetSeg !== null ? nextSi + 1 : nextSi;
        break;
      }

      // ── Content block: parse with CommonMark (Phase 2) and attach
      case 'content': {
        const blocks = parseMarkdownBlocks(seg.lines.join('\n'), { allowInlineSong: !inSong });
        for (const block of blocks) {
          pushNode(block);
        }
        si += 1;
        break;
      }

      default:
        si += 1;
    }
  }

  if (inSong) {
    warnings.push({
      code: 'UNCLOSED_SONG_CONTAINER',
      message: 'Song container opened with $$ but no closing $$ was found.',
      line: lines.length,
      column: 1,
    });
  }

  return {
    tree: root,
    warnings,
    metadata: {
      frontmatterRaw: frontmatter?.value,
      translationEnabledFromFrontmatter: translationFromFrontmatter,
    },
  };
}

// ─── Helpers: frontmatter ─────────────────────────────────────────────────────

function consumeFrontmatter(lines: string[]): (FrontmatterBlock & { endLine: number }) | null {
  if (lines.length < 3 || lines[0].trim() !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      return {
        type: 'frontmatter',
        value: lines.slice(1, i).join('\n'),
        endLine: i,
      };
    }
  }
  return null;
}

// ─── Helpers: line classification ────────────────────────────────────────────

function isRootDirectiveLine(line: string): boolean {
  return line.trimStart() === line;
}

function isRootHeading(line: string): boolean {
  return /^#{1,6}\s+/u.test(line);
}

function isRootReset(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed !== line) {
    return false;
  }
  return trimmed === '---' || trimmed === '***' || trimmed === '___';
}

function isLineComment(line: string): boolean {
  const leftTrimmed = line.trimStart();
  if (leftTrimmed.startsWith('%')) {
    return !leftTrimmed.startsWith('%%');
  }
  const idx = line.indexOf('%');
  if (idx <= 0) {
    return false;
  }
  return /\s/u.test(line[idx - 1]);
}

// ─── Helpers: character declaration ──────────────────────────────────────────

function parseCharacterDeclaration(line: string): Pick<CharacterBlock, 'name' | 'names' | 'mood'> | null {
  if (!line.startsWith('@')) {
    return null;
  }

  const moodMatch = line.match(/(?:\[(.+?)\]|【(.+?)】)\s*$/u);
  const mood = (moodMatch?.[1] ?? moodMatch?.[2])?.trim();
  const withoutMood = moodMatch ? line.slice(0, moodMatch.index).trim() : line;

  const names: string[] = [];
  const regex = /@([^@\[【]+)/gu;
  let match = regex.exec(withoutMood);
  while (match !== null) {
    const name = match[1].trim();
    if (name.length > 0) {
      names.push(name);
    }
    match = regex.exec(withoutMood);
  }

  if (names.length === 0) {
    return null;
  }

  return { name: names[0], names, mood };
}

// ─── Helpers: block comment scanning ─────────────────────────────────────────

function consumeBlockComment(lines: string[], start: number): { value: string; closed: boolean; nextIndex: number } {
  const payload: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '%%') {
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    payload.push(lines[i]);
  }
  return { value: payload.join('\n'), closed: false, nextIndex: lines.length };
}

// ─── Helpers: block tech cue scanning ────────────────────────────────────────

function consumeBlockTechCue(lines: string[], start: number): { value: string; closed: boolean; nextIndex: number } {
  const singleLine = lines[start].trim();
  if (singleLine.includes('>>>') && singleLine !== '<<<') {
    const value = singleLine.replace(/^<<<\s*/u, '').replace(/\s*>>>$/u, '');
    return { value, closed: true, nextIndex: start + 1 };
  }

  const payload: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '>>>') {
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    payload.push(lines[i]);
  }
  return { value: payload.join('\n'), closed: false, nextIndex: lines.length };
}

// ─── Helpers: CommonMark block parsing (Phase 2) ─────────────────────────────

function parseMarkdownBlocks(markdown: string, options?: { allowInlineSong?: boolean }): Content[] {
  const tree = fromMarkdown(markdown);
  const blocks = tree.children as Content[];
  for (const block of blocks) {
    transformInlineMarkersInTree(block, { allowInlineSong: options?.allowInlineSong ?? true });
  }
  return blocks;
}

// ─── Helpers: AST node factories ─────────────────────────────────────────────

function asHeading(line: string): Heading {
  const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
  if (headingMatch === null) {
    return {
      type: 'heading',
      depth: 1,
      children: [{ type: 'text', value: line }],
    };
  }

  return {
    type: 'heading',
    depth: headingMatch[1].length as Heading['depth'],
    children: parseInlineContent(headingMatch[2]),
  };
}

function asThematicBreak(): ThematicBreak {
  return { type: 'thematicBreak' };
}
