import type { Content, Paragraph } from 'mdast';
import { defaultOptions } from './errors.js';
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
  InlineAction,
  InlineSongSegment,
  InlineTechCue,
  SongContainer,
  TranslationPair,
} from './types.js';

interface ParseState {
  inSong: boolean;
  currentSong: SongContainer | null;
  currentCharacter: CharacterBlock | null;
}

export function parseDraMark(input: string, options?: DraMarkOptions): DraMarkParseResult {
  const opts = defaultOptions(options);
  const lines = input.split(/\r?\n/u);
  const warnings: DraMarkWarning[] = [];
  const root: DraMarkRoot = { type: 'root', children: [] };

  let index = 0;
  const frontmatter = consumeFrontmatter(lines);
  let translationFromFrontmatter = false;
  if (frontmatter !== null) {
    translationFromFrontmatter = /translation\s*:\s*[\s\S]*?enabled\s*:\s*true/iu.test(frontmatter.value);
    root.children.push(frontmatter);
    index = frontmatter.endLine + 1;
  }

  const translationEnabled = opts.translationEnabled || translationFromFrontmatter;

  const state: ParseState = {
    inSong: false,
    currentSong: null,
    currentCharacter: null,
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const rootDirectiveLine = isRootDirectiveLine(rawLine);
    const lineNo = index + 1;

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    if (rootDirectiveLine && trimmed === '$$') {
      if (state.inSong) {
        state.inSong = false;
        state.currentSong = null;
        state.currentCharacter = null;
      } else {
        if (!opts.allowNestedSongContainers && state.currentSong !== null) {
          warnings.push({
            code: 'NESTED_SONG_CONTAINER',
            message: 'Nested song containers are disabled by default.',
            line: lineNo,
            column: 1,
          });
        }
        const song: SongContainer = { type: 'song-container', children: [] };
        root.children.push(song);
        state.inSong = true;
        state.currentSong = song;
        state.currentCharacter = null;
      }
      index += 1;
      continue;
    }

    if (isRootHeading(rawLine)) {
      state.currentCharacter = null;
      if (state.inSong) {
        state.inSong = false;
        state.currentSong = null;
      }
      pushNode(root, state, asHeadingParagraph(trimmed));
      index += 1;
      continue;
    }

    if (isRootReset(rawLine)) {
      state.currentCharacter = null;
      pushNode(root, state, asRuleParagraph(trimmed));
      index += 1;
      continue;
    }

    if (rootDirectiveLine && trimmed === '%%') {
      const block = consumeBlockComment(lines, index);
      if (opts.includeComments) {
        pushNode(root, state, block.node);
      }
      if (!block.closed) {
        warnings.push({
          code: 'UNCLOSED_BLOCK_COMMENT',
          message: 'Comment block started with %% but did not close with %%.',
          line: lineNo,
          column: 1,
        });
      }
      index = block.nextIndex;
      continue;
    }

    if (rootDirectiveLine && trimmed.startsWith('<<<')) {
      const blockCue = consumeBlockTechCue(lines, index);
      pushNode(root, state, blockCue.node);
      if (!blockCue.closed) {
        warnings.push({
          code: 'UNCLOSED_BLOCK_TECH_CUE',
          message: 'Tech cue block started with <<< but did not close with >>>.',
          line: lineNo,
          column: 1,
        });
      }
      index = blockCue.nextIndex;
      continue;
    }

    if (rootDirectiveLine && isLineComment(rawLine)) {
      if (opts.includeComments) {
        const comment: CommentLine = {
          type: 'comment-line',
          value: rawLine.trim().slice(1).trim(),
        };
        pushNode(root, state, comment);
      }
      index += 1;
      continue;
    }

    const character = rootDirectiveLine ? parseCharacterDeclaration(trimmed) : null;
    if (character !== null) {
      state.currentCharacter = character;
      currentContainer(root, state).push(character);
      index += 1;
      continue;
    }

    if (rootDirectiveLine && trimmed.startsWith('= ')) {
      if (!translationEnabled || state.currentCharacter === null) {
        warnings.push({
          code: 'TRANSLATION_OUTSIDE_CHARACTER',
          message: 'Translation pair requires translation mode and character context.',
          line: lineNo,
          column: 1,
        });
        pushNode(root, state, paragraphFromLine(rawLine));
        index += 1;
        continue;
      }
      const pair = consumeTranslationPair(lines, index);
      state.currentCharacter.children.push(pair.node);
      index = pair.nextIndex;
      continue;
    }

    pushNode(root, state, paragraphFromLine(rawLine));
    index += 1;
  }

  if (state.inSong) {
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
      translationEnabledFromFrontmatter: translationFromFrontmatter,
    },
  };
}

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

function parseCharacterDeclaration(line: string): CharacterBlock | null {
  if (!line.startsWith('@')) {
    return null;
  }

  const moodMatch = line.match(/\[(.+?)\]\s*$/u);
  const mood = moodMatch?.[1]?.trim();
  const withoutMood = moodMatch ? line.slice(0, moodMatch.index).trim() : line;

  const names: string[] = [];
  const regex = /@([^@\[]+)/gu;
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

  return {
    type: 'character-block',
    name: names[0],
    names,
    mood,
    children: [],
  };
}

function consumeBlockComment(lines: string[], start: number): { node: CommentBlock; closed: boolean; nextIndex: number } {
  const payload: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '%%') {
      return {
        node: { type: 'comment-block', value: payload.join('\n') },
        closed: true,
        nextIndex: i + 1,
      };
    }
    payload.push(lines[i]);
  }
  return {
    node: { type: 'comment-block', value: payload.join('\n') },
    closed: false,
    nextIndex: lines.length,
  };
}

function consumeBlockTechCue(lines: string[], start: number): { node: BlockTechCue; closed: boolean; nextIndex: number } {
  const singleLine = lines[start].trim();
  if (singleLine.includes('>>>') && singleLine !== '<<<') {
    const value = singleLine.replace(/^<<<\s*/u, '').replace(/\s*>>>$/u, '');
    return {
      node: { type: 'block-tech-cue', value },
      closed: true,
      nextIndex: start + 1,
    };
  }

  const payload: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '>>>') {
      return {
        node: { type: 'block-tech-cue', value: payload.join('\n') },
        closed: true,
        nextIndex: i + 1,
      };
    }
    payload.push(lines[i]);
  }

  return {
    node: { type: 'block-tech-cue', value: payload.join('\n') },
    closed: false,
    nextIndex: lines.length,
  };
}

function consumeTranslationPair(lines: string[], start: number): { node: TranslationPair; nextIndex: number } {
  const sourceLine = lines[start].trim().slice(2).trim();
  const targetLines: string[] = [];

  let index = start + 1;
  while (index < lines.length) {
    const candidate = lines[index];
    const trimmed = candidate.trim();
    const rootDirectiveLine = isRootDirectiveLine(candidate);

    if (rootDirectiveLine && trimmed.startsWith('= ')) {
      break;
    }
    if (rootDirectiveLine && trimmed.startsWith('@')) {
      break;
    }
    if (rootDirectiveLine && trimmed === '$$') {
      break;
    }
    if (isRootHeading(candidate)) {
      break;
    }
    if (isRootReset(candidate)) {
      break;
    }

    targetLines.push(candidate);
    index += 1;
  }

  const blocks = parseTargetBlocks(targetLines);
  return {
    node: {
      type: 'translation-pair',
      sourceText: sourceLine,
      target: blocks,
      children: blocks,
    },
    nextIndex: index,
  };
}

function parseTargetBlocks(lines: string[]): Content[] {
  const blocks: Content[] = [];
  const chunk: string[] = [];

  const flush = (): void => {
    if (chunk.length === 0) {
      return;
    }
    const value = chunk.join('\n').trim();
    if (value.length > 0) {
      blocks.push(paragraphFromLine(value));
    }
    chunk.length = 0;
  };

  for (const line of lines) {
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    chunk.push(line);
  }
  flush();

  return blocks;
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

function isRootDirectiveLine(line: string): boolean {
  return line.trimStart() === line;
}

function paragraphFromLine(line: string): Paragraph {
  const cleanLine = stripInlineComment(line);
  return {
    type: 'paragraph',
    children: parseInlineContent(cleanLine),
  };
}

function stripInlineComment(line: string): string {
  const idx = line.indexOf('%');
  if (idx < 0) {
    return line;
  }
  if (idx === 0) {
    return '';
  }
  return /\s/u.test(line[idx - 1]) ? line.slice(0, idx).trimEnd() : line;
}

function parseInlineContent(line: string): Paragraph['children'] {
  const nodes: Paragraph['children'] = [];
  let cursor = 0;

  const pushText = (value: string): void => {
    if (value.length > 0) {
      nodes.push({ type: 'text', value });
    }
  };

  while (cursor < line.length) {
    const actionStart = findNextToken(line, cursor, ['{', '｛', '$', '<']);
    if (actionStart < 0) {
      pushText(unescapeDraMark(line.slice(cursor)));
      break;
    }

    pushText(unescapeDraMark(line.slice(cursor, actionStart)));

    const token = line[actionStart];
    if (token === '{' || token === '｛') {
      const closeChar = token === '{' ? '}' : '｝';
      const close = line.indexOf(closeChar, actionStart + 1);
      if (close > actionStart) {
        const value = line.slice(actionStart + 1, close);
        nodes.push({ type: 'inline-action', value } satisfies InlineAction);
        cursor = close + 1;
        continue;
      }
      pushText(unescapeDraMark(line.slice(actionStart, actionStart + 1)));
      cursor = actionStart + 1;
      continue;
    }

    if (token === '$') {
      const close = line.indexOf('$', actionStart + 1);
      if (close > actionStart + 1) {
        const value = line.slice(actionStart + 1, close);
        nodes.push({ type: 'inline-song', value } satisfies InlineSongSegment);
        cursor = close + 1;
        continue;
      }
      pushText('$');
      cursor = actionStart + 1;
      continue;
    }

    if (token === '<' && line[actionStart + 1] === '<') {
      const close = line.indexOf('>>', actionStart + 2);
      if (close > actionStart + 1) {
        const value = line.slice(actionStart + 2, close);
        nodes.push({ type: 'inline-tech-cue', value } satisfies InlineTechCue);
        cursor = close + 2;
        continue;
      }
      pushText('<<');
      cursor = actionStart + 2;
      continue;
    }

    pushText(unescapeDraMark(line.slice(actionStart, actionStart + 1)));
    cursor = actionStart + 1;
  }

  return nodes;
}

function unescapeDraMark(value: string): string {
  return value.replace(/\\([@$%{}<>=])/gu, '$1');
}

function findNextToken(line: string, start: number, tokens: string[]): number {
  let best = -1;
  for (const token of tokens) {
    const index = line.indexOf(token, start);
    if (index < 0) {
      continue;
    }
    if (index > 0 && line[index - 1] === '\\') {
      continue;
    }
    if (best < 0 || index < best) {
      best = index;
    }
  }
  return best;
}

function currentContainer(root: DraMarkRoot, state: ParseState): DraMarkRootContent[] {
  if (state.currentSong !== null) {
    return state.currentSong.children as DraMarkRootContent[];
  }
  return root.children;
}

function pushNode(root: DraMarkRoot, state: ParseState, node: DraMarkRootContent): void {
  if (state.currentCharacter !== null) {
    state.currentCharacter.children.push(node);
    return;
  }
  currentContainer(root, state).push(node);
}

function asHeadingParagraph(line: string): Paragraph {
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: line }],
  };
}

function asRuleParagraph(line: string): Paragraph {
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: line }],
  };
}