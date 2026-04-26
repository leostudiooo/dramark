import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Content, Heading, PhrasingContent, ThematicBreak } from 'mdast';
import { defaultOptions } from './errors.js';
import { getDraMarkFromMarkdownOptions } from './m2-extensions.js';
import type {
  BlockTechCue,
  CharacterBlock,
  CommentBlock,
  CommentLine,
  DraMarkMetadata,
  DraMarkOptions,
  DraMarkParseResult,
  DraMarkRoot,
  DraMarkRootContent,
  DraMarkWarning,
  FrontmatterBlock,
  SongContainer,
  SpokenSegment,
  TranslationPair,
} from './types.js';

type CharacterScan = {
  name: string;
  names: string[];
  mood?: string;
  remainder: string;
  attachmentsMarkdown?: string;
  commentText?: string;
  invalidName: boolean;
};

export type ScannedSegment =
  | { kind: 'song-toggle'; title?: string; lineNo: number }
  | { kind: 'spoken-toggle'; lineNo: number }
  | { kind: 'heading'; raw: string; lineNo: number }
  | { kind: 'thematic-break'; lineNo: number }
  | { kind: 'comment-block'; value: string; closed: boolean; lineNo: number }
  | { kind: 'block-tech-cue'; value: string; closed: boolean; lineNo: number }
  | { kind: 'comment-line'; value: string; lineNo: number }
  | ({ kind: 'character'; raw: string; lineNo: number } & CharacterScan)
  | { kind: 'character-exit'; lineNo: number }
  | { kind: 'translation-source'; text: string; lineNo: number }
  | { kind: 'translation-exit'; lineNo: number }
  | { kind: 'content'; lines: string[]; lineNo: number };

type RootFrame = {
  kind: 'root';
  children: DraMarkRootContent[];
};

type SongFrame = {
  kind: 'song';
  node: SongContainer;
  lineNo: number;
};

type SpokenFrame = {
  kind: 'spoken';
  node: SpokenSegment;
  lineNo: number;
};

type CharacterFrame = {
  kind: 'character';
  node: CharacterBlock;
  lineNo: number;
};

type TranslationFrame = {
  kind: 'translation';
  node: TranslationPair;
  lineNo: number;
  targetChunks: string[];
  attached: DraMarkRootContent[];
};

type StackFrame = RootFrame | SongFrame | SpokenFrame | CharacterFrame | TranslationFrame;

type FenceState = {
  marker: '`' | '~';
  minLength: number;
};

type ProtectedLiteralMap = Record<string, string>;

type Pass2ScanResult = {
  segments: ScannedSegment[];
  protectedLiterals: ProtectedLiteralMap;
};

const markdownParseOptions = getDraMarkFromMarkdownOptions();

const protectedLiteralPrefix = '__DRAMARK_PROTECTED_LITERAL_';
const protectedLiteralSuffix = '__';

export function scanSegments(lines: string[], startIndex: number): ScannedSegment[] {
  return scanSegmentsWithProtectedLiterals(lines, startIndex).segments;
}

function scanSegmentsWithProtectedLiterals(lines: string[], startIndex: number): Pass2ScanResult {
  const segments: ScannedSegment[] = [];
  const protectedLiterals: ProtectedLiteralMap = {};
  let index = startIndex;
  let contentBuffer: string[] = [];
  let contentStartLine = startIndex;
  let fenceState: FenceState | null = null;
  let protectedLiteralId = 0;

  function nextProtectedLiteralPlaceholder(): string {
    const placeholder = `${protectedLiteralPrefix}${protectedLiteralId}${protectedLiteralSuffix}`;
    protectedLiteralId += 1;
    return placeholder;
  }

  function protectLiteral(value: string): string {
    const placeholder = nextProtectedLiteralPlaceholder();
    protectedLiterals[placeholder] = value;
    return placeholder;
  }

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

    if (fenceState !== null) {
      if (isFenceCloseLine(rawLine, fenceState)) {
        contentBuffer.push(rawLine);
        fenceState = null;
      } else {
        contentBuffer.push(protectLiteral(rawLine));
      }
      index += 1;
      continue;
    }

    if (isRoot) {
      const openingFence = parseFenceOpen(rawLine);
      if (openingFence !== null) {
        contentBuffer.push(rawLine);
        fenceState = openingFence;
        index += 1;
        continue;
      }
    }

    if (isRoot && (trimmed === '$$' || trimmed.startsWith('$$ '))) {
      flushContent();
      const title = trimmed.length > 3 ? trimmed.slice(3).trim() : undefined;
      segments.push({ kind: 'song-toggle', title: title || undefined, lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRoot && trimmed === '!!') {
      flushContent();
      segments.push({ kind: 'spoken-toggle', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRootHeading(rawLine)) {
      flushContent();
      segments.push({ kind: 'heading', raw: rawLine, lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRootReset(rawLine)) {
      flushContent();
      segments.push({ kind: 'thematic-break', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRoot && trimmed === '%%') {
      flushContent();
      const result = consumeBlockComment(lines, index);
      segments.push({ kind: 'comment-block', value: result.value, closed: result.closed, lineNo });
      index = result.nextIndex;
      contentStartLine = index;
      continue;
    }

    if (isRoot && trimmed.startsWith('<<<')) {
      flushContent();
      const result = consumeBlockTechCue(lines, index);
      segments.push({ kind: 'block-tech-cue', value: result.value, closed: result.closed, lineNo });
      index = result.nextIndex;
      contentStartLine = index;
      continue;
    }

    if (isRoot) {
      const comment = splitLineComment(rawLine);
      if (comment !== null) {
        if (comment.leadingContent !== undefined) {
          contentBuffer.push(comment.leadingContent);
          flushContent();
        } else {
          flushContent();
        }
        segments.push({ kind: 'comment-line', value: comment.commentText, lineNo });
        index += 1;
        contentStartLine = index;
        continue;
      }
    }

    if (isRoot && trimmed === '@@') {
      flushContent();
      segments.push({ kind: 'character-exit', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRoot && trimmed.startsWith('@')) {
      const character = parseCharacterLine(trimmed);
      if (character !== null) {
        flushContent();
        segments.push({
          kind: 'character',
          raw: trimmed,
          lineNo,
          ...character,
        });
        index += 1;
        contentStartLine = index;
        continue;
      }
    }

    if (isRoot && trimmed.startsWith('= ')) {
      flushContent();
      segments.push({ kind: 'translation-source', text: trimmed.slice(2).trim(), lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    if (isRoot && trimmed === '=') {
      flushContent();
      segments.push({ kind: 'translation-exit', lineNo });
      index += 1;
      contentStartLine = index;
      continue;
    }

    contentBuffer.push(rawLine);
    index += 1;
  }

  flushContent();
  return {
    segments,
    protectedLiterals,
  };
}

export function parseDraMark(input: string, options?: DraMarkOptions): DraMarkParseResult {
  const opts = defaultOptions(options);
  const pass1MarkedInput = runPass1MicromarkMarking(input);
  const lines = pass1MarkedInput.split(/\r?\n/u);
  const warnings: DraMarkWarning[] = [];
  const root: DraMarkRoot = { type: 'root', children: [] };

  const frontmatterPass = runPass0FrontmatterExtraction(lines, root);
  const translationEnabled = opts.translationEnabled || frontmatterPass.translationEnabledFromFrontmatter;
  const pass2 = runPass2LexicalScan(lines, frontmatterPass.startIndex);
  const segments = pass2.segments;

  const stack: StackFrame[] = [{ kind: 'root', children: root.children }];

  function hasFrame(kind: StackFrame['kind']): boolean {
    return stack.some((frame) => frame.kind === kind);
  }

  function isInSungContext(): boolean {
    return hasFrame('song') && !hasFrame('spoken');
  }

  function currentStructuralChildren(): DraMarkRootContent[] {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const frame = stack[i];
      if (frame.kind === 'translation') {
        continue;
      }
      if (frame.kind === 'root') {
        return frame.children;
      }
      return frame.node.children;
    }
    return root.children;
  }

  function topTranslationFrame(): TranslationFrame | null {
    const top = stack[stack.length - 1];
    return top?.kind === 'translation' ? top : null;
  }

  function topCharacterFrame(): CharacterFrame | null {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const frame = stack[i];
      if (frame.kind === 'character') {
        return frame;
      }
    }
    return null;
  }

  function nearestSongFrame(): SongFrame | null {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const frame = stack[i];
      if (frame.kind === 'song') {
        return frame;
      }
    }
    return null;
  }

  function addNode(node: DraMarkRootContent): void {
    const translation = topTranslationFrame();
    if (translation !== null) {
      translation.attached.push(node);
      return;
    }
    currentStructuralChildren().push(node);
  }

  function finalizeTranslation(frame: TranslationFrame): void {
    const markdown = frame.targetChunks.join('\n');
    const targetBlocks = markdown.length > 0 ? parseMarkdownBlocks(markdown, { inSongContext: isInSungContext() }) : [];
    frame.node.target = targetBlocks;
    frame.node.children = [...targetBlocks, ...frame.attached];
  }

  function closeTopFrame(): void {
    if (stack.length <= 1) {
      return;
    }
    const frame = stack.pop();
    if (frame?.kind === 'translation') {
      finalizeTranslation(frame);
    }
  }

  function closeKinds(kinds: Set<StackFrame['kind']>): void {
    while (stack.length > 1 && kinds.has(stack[stack.length - 1].kind)) {
      closeTopFrame();
    }
  }

  function closeThrough(kind: StackFrame['kind']): boolean {
    while (stack.length > 1) {
      if (stack[stack.length - 1].kind === kind) {
        closeTopFrame();
        return true;
      }
      closeTopFrame();
    }
    return false;
  }

  function closeAllToRoot(): void {
    while (stack.length > 1) {
      closeTopFrame();
    }
  }

  function pushLiteralContent(line: string): void {
    const translation = topTranslationFrame();
    if (translation !== null) {
      translation.targetChunks.push(line);
      return;
    }

    const blocks = parseMarkdownBlocks(line, { inSongContext: isInSungContext() });
    for (const block of blocks) {
      currentStructuralChildren().push(block);
    }
  }

  function openCharacterFromSegment(seg: Extract<ScannedSegment, { kind: 'character' }>): CharacterFrame {
    const character: CharacterBlock = {
      type: 'character-block',
      name: seg.name,
      names: seg.names,
      mood: seg.mood,
      children: [],
    };
    currentStructuralChildren().push(character);
    const frame: CharacterFrame = { kind: 'character', node: character, lineNo: seg.lineNo };
    stack.push(frame);
    return frame;
  }

  for (const seg of segments) {
    switch (seg.kind) {
      case 'song-toggle': {
        if (hasFrame('song')) {
          closeThrough('song');
        } else {
          closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
          const song: SongContainer = { type: 'song-container', title: seg.title, children: [] };
          currentStructuralChildren().push(song);
          stack.push({ kind: 'song', node: song, lineNo: seg.lineNo });
        }
        break;
      }

      case 'spoken-toggle': {
        if (!hasFrame('song')) {
          pushLiteralContent('!!');
          break;
        }

        if (hasFrame('spoken')) {
          closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
          closeThrough('spoken');
        } else {
          closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
          const songFrame = nearestSongFrame();
          if (songFrame !== null) {
            const spoken: SpokenSegment = { type: 'spoken-segment', children: [] };
            songFrame.node.children.push(spoken);
            stack.push({ kind: 'spoken', node: spoken, lineNo: seg.lineNo });
          }
        }
        break;
      }

      case 'heading': {
        closeAllToRoot();
        root.children.push(asHeading(seg.raw));
        break;
      }

      case 'thematic-break': {
        closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
        currentStructuralChildren().push(asThematicBreak());
        break;
      }

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
          addNode({ type: 'comment-block', value: seg.value } satisfies CommentBlock);
        }
        break;
      }

      case 'block-tech-cue': {
        closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
        if (!seg.closed) {
          warnings.push({
            code: 'UNCLOSED_BLOCK_TECH_CUE',
            message: 'Tech cue block started with <<< but did not close with >>> or <<<.',
            line: seg.lineNo,
            column: 1,
          });
        }
        const blockTechCueChildren = parseBlockTechCuePayload(seg.value, opts);
        addNode({
          type: 'block-tech-cue',
          value: seg.value,
          children: blockTechCueChildren,
        } satisfies BlockTechCue);
        break;
      }

      case 'comment-line': {
        if (opts.includeComments) {
          addNode({ type: 'comment-line', value: seg.value } satisfies CommentLine);
        }
        break;
      }

      case 'character-exit': {
        closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
        break;
      }

      case 'character': {
        if (seg.invalidName || seg.names.length === 0) {
          warnings.push({
            code: 'INVALID_CHARACTER_NAME',
            message: 'Character declaration has an empty or invalid character name.',
            line: seg.lineNo,
            column: 1,
          });
          pushLiteralContent(seg.raw);
          break;
        }

        if (seg.remainder.length > 0 && opts.characterDeclarationMode === 'strict') {
          warnings.push({
            code: 'CHARACTER_DECLARATION_NOT_STANDALONE',
            message: 'Character declaration must be standalone except inline tech cue or trailing comment.',
            line: seg.lineNo,
            column: 1,
          });
          pushLiteralContent(seg.raw);
          break;
        }

        closeKinds(new Set<StackFrame['kind']>(['translation', 'character']));
        const characterFrame = openCharacterFromSegment(seg);

        if (seg.attachmentsMarkdown !== undefined && seg.attachmentsMarkdown.length > 0) {
          const blocks = parseMarkdownBlocks(seg.attachmentsMarkdown, { inSongContext: isInSungContext() });
          characterFrame.node.children.push(...blocks);
        }

        if (seg.commentText !== undefined && opts.includeComments) {
          characterFrame.node.children.push({ type: 'comment-line', value: seg.commentText } satisfies CommentLine);
        }

        if (seg.remainder.length > 0 && opts.characterDeclarationMode === 'compat') {
          warnings.push({
            code: 'DEPRECATED_INLINE_CHARACTER_DECLARATION',
            message: 'Inline character declaration is deprecated; put dialogue on the next line.',
            line: seg.lineNo,
            column: 1,
          });
          const blocks = parseMarkdownBlocks(seg.remainder, { inSongContext: isInSungContext() });
          characterFrame.node.children.push(...blocks);
        }

        break;
      }

      case 'translation-source': {
        if (!translationEnabled || topCharacterFrame() === null) {
          warnings.push({
            code: 'TRANSLATION_OUTSIDE_CHARACTER',
            message: 'Translation pair requires translation mode and character context.',
            line: seg.lineNo,
            column: 1,
          });
          pushLiteralContent(`= ${seg.text}`);
          break;
        }

        closeKinds(new Set<StackFrame['kind']>(['translation']));
        const character = topCharacterFrame();
        if (character === null) {
          break;
        }

        const pair: TranslationPair = {
          type: 'translation-pair',
          sourceText: seg.text,
          target: [],
          children: [],
        };
        character.node.children.push(pair);
        stack.push({
          kind: 'translation',
          node: pair,
          lineNo: seg.lineNo,
          targetChunks: [],
          attached: [],
        });
        break;
      }

      case 'translation-exit': {
        closeKinds(new Set<StackFrame['kind']>(['translation']));
        break;
      }

      case 'content': {
        const translation = topTranslationFrame();
        if (translation !== null) {
          translation.targetChunks.push(seg.lines.join('\n'));
          break;
        }

        const blocks = parseMarkdownBlocks(seg.lines.join('\n'), {
          inSongContext: isInSungContext(),
        });
        currentStructuralChildren().push(...blocks);
        break;
      }

      default:
        break;
    }
  }

  if (hasFrame('song')) {
    warnings.push({
      code: 'UNCLOSED_SONG_CONTAINER',
      message: 'Song container opened with $$ but no closing $$ was found.',
      line: lines.length,
      column: 1,
    });
  }

  closeAllToRoot();
  const pass4 = runPass4RestoreProtectedBlocks(root, {
    enabled: opts.pass4Restore,
    protectedLiterals: pass2.protectedLiterals,
  });

  const metadata: DraMarkMetadata = {
    frontmatterRaw: frontmatterPass.frontmatter?.value,
    translationEnabledFromFrontmatter: frontmatterPass.translationEnabledFromFrontmatter,
  };

  if (opts.multipassDebug) {
    metadata.multipassDebug = {
      pass0: {
        hasFrontmatter: frontmatterPass.frontmatter !== null,
        startIndex: frontmatterPass.startIndex,
      },
      pass1: {
        markedInput: pass1MarkedInput,
      },
      pass2: {
        segments: segments.map((segment) => ({ kind: segment.kind, lineNo: segment.lineNo })),
      },
      pass4: {
        enabled: opts.pass4Restore,
        executed: pass4.executed,
        restoredNodeCount: pass4.restoredNodeCount,
      },
    };
  }

  return {
    tree: root,
    warnings,
    metadata,
  };
}

function runPass1MicromarkMarking(input: string): string {
  // In unified + remarkParse flow this pass is executed by micromark extensions.
  // parseDraMark standalone keeps it as identity to preserve the multipass contract.
  return input;
}

function runPass0FrontmatterExtraction(lines: string[], root: DraMarkRoot): {
  frontmatter: (FrontmatterBlock & { endLine: number }) | null;
  translationEnabledFromFrontmatter: boolean;
  startIndex: number;
} {
  const frontmatter = consumeFrontmatter(lines);
  let translationEnabledFromFrontmatter = false;
  if (frontmatter !== null) {
    translationEnabledFromFrontmatter = /translation\s*:\s*[\s\S]*?enabled\s*:\s*true/iu.test(frontmatter.value);
    root.children.push(frontmatter);
  }

  return {
    frontmatter,
    translationEnabledFromFrontmatter,
    startIndex: frontmatter !== null ? frontmatter.endLine + 1 : 0,
  };
}

function runPass2LexicalScan(lines: string[], startIndex: number): Pass2ScanResult {
  return scanSegmentsWithProtectedLiterals(lines, startIndex);
}

function runPass4RestoreProtectedBlocks(root: DraMarkRoot, options: {
  enabled: boolean;
  protectedLiterals: ProtectedLiteralMap;
}): {
  executed: boolean;
  restoredNodeCount: number;
} {
  if (!options.enabled) {
    return { executed: false, restoredNodeCount: 0 };
  }

  if (Object.keys(options.protectedLiterals).length === 0) {
    return { executed: true, restoredNodeCount: 0 };
  }

  return {
    executed: true,
    restoredNodeCount: restoreProtectedLiteralsInTree(root, options.protectedLiterals),
  };
}

function restoreProtectedLiteralsInTree(node: unknown, protectedLiterals: ProtectedLiteralMap): number {
  if (node === null || typeof node !== 'object') {
    return 0;
  }

  let restoredNodeCount = 0;

  if (isCodeLikeNode(node)) {
    const restored = restoreProtectedLiteralsInText(node.value, protectedLiterals);
    if (restored !== node.value) {
      node.value = restored;
      restoredNodeCount += 1;
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      restoredNodeCount += restoreProtectedLiteralsInTree(item, protectedLiterals);
    }
    return restoredNodeCount;
  }

  for (const value of Object.values(node)) {
    restoredNodeCount += restoreProtectedLiteralsInTree(value, protectedLiterals);
  }

  return restoredNodeCount;
}

function restoreProtectedLiteralsInText(value: string, protectedLiterals: ProtectedLiteralMap): string {
  let restored = value;
  for (const [placeholder, literal] of Object.entries(protectedLiterals)) {
    if (!restored.includes(placeholder)) {
      continue;
    }
    restored = restored.split(placeholder).join(literal);
  }
  return restored;
}

function isCodeLikeNode(node: object): node is { type: 'code' | 'inlineCode'; value: string } {
  const candidate = node as { type?: unknown; value?: unknown };
  return (candidate.type === 'code' || candidate.type === 'inlineCode') && typeof candidate.value === 'string';
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

function splitLineComment(line: string): { leadingContent?: string; commentText: string } | null {
  const leftTrimmed = line.trimStart();
  if (leftTrimmed.startsWith('%')) {
    if (leftTrimmed.startsWith('%%')) {
      return null;
    }
    return { commentText: leftTrimmed.slice(1).trim() };
  }
  const markerMatch = line.match(/\s%(?!%)/u);
  if (!markerMatch || markerMatch.index === undefined) {
    return null;
  }
  const markerIndex = markerMatch.index + markerMatch[0].length - 1;
  const leadingContent = line.slice(0, markerIndex).trimEnd();
  if (leadingContent.length === 0) {
    return null;
  }
  return {
    leadingContent,
    commentText: line.slice(markerIndex + 1).trim(),
  };
}

function parseFenceOpen(line: string): FenceState | null {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^(`{3,}|~{3,})/u);
  if (match === null) {
    return null;
  }
  const marker = match[1][0] as '`' | '~';
  return {
    marker,
    minLength: match[1].length,
  };
}

function isFenceCloseLine(line: string, state: FenceState): boolean {
  const trimmed = line.trim();
  if (trimmed.length < state.minLength) {
    return false;
  }
  if (!trimmed.startsWith(state.marker.repeat(state.minLength))) {
    return false;
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== state.marker) {
      return false;
    }
  }
  return true;
}

function parseCharacterLine(line: string): CharacterScan | null {
  if (!line.startsWith('@') || line === '@@') {
    return null;
  }

  const moodInfo = extractMood(line);
  const head = moodInfo.text;
  const names: string[] = [];
  let cursor = 0;
  let invalidName = false;

  while (cursor < head.length) {
    if (head[cursor] !== '@') {
      break;
    }
    cursor += 1;
    while (cursor < head.length && /\s/u.test(head[cursor])) {
      cursor += 1;
    }

    const parsed = parseCharacterName(head, cursor);
    if (parsed === null) {
      invalidName = true;
      break;
    }

    if (parsed.value.length === 0) {
      invalidName = true;
      break;
    }

    names.push(parsed.value);
    if (parsed.invalid) {
      invalidName = true;
      break;
    }

    cursor = parsed.next;
    while (cursor < head.length && /\s/u.test(head[cursor])) {
      cursor += 1;
    }

    if (cursor < head.length && head[cursor] === '@') {
      continue;
    }
    break;
  }

  const tail = head.slice(cursor).trim();
  let remainder = '';
  let attachmentsMarkdown: string | undefined;
  let commentText: string | undefined;
  if (tail.length > 0) {
    const parsedAttachments = parseCharacterAttachments(tail);
    if (parsedAttachments === null) {
      remainder = tail;
    } else {
      attachmentsMarkdown = parsedAttachments.inlineMarkdown;
      commentText = parsedAttachments.commentText;
    }
  }

  return {
    name: names[0] ?? '',
    names,
    mood: moodInfo.mood,
    remainder,
    attachmentsMarkdown,
    commentText,
    invalidName: invalidName || names.length === 0,
  };
}

function parseCharacterName(text: string, start: number): { value: string; next: number; invalid: boolean } | null {
  if (start >= text.length) {
    return null;
  }

  const open = text[start];
  if (open === '"' || open === '“') {
    const close = open === '"' ? '"' : '”';
    let cursor = start + 1;
    let value = '';
    while (cursor < text.length) {
      const ch = text[cursor];
      if (ch === '\\' && cursor + 1 < text.length) {
        const next = text[cursor + 1];
        value += next;
        cursor += 2;
        continue;
      }
      if (ch === close) {
        return { value: value.trim(), next: cursor + 1, invalid: false };
      }
      value += ch;
      cursor += 1;
    }
    return { value: '', next: text.length, invalid: true };
  }

  let cursor = start;
  while (cursor < text.length) {
    const ch = text[cursor];
    if (ch === '@' || ch === '[' || ch === '【') {
      break;
    }
    cursor += 1;
  }

  return {
    value: text.slice(start, cursor).trim(),
    next: cursor,
    invalid: false,
  };
}

function parseCharacterAttachments(text: string): { inlineMarkdown: string; commentText?: string } | null {
  let cursor = 0;
  const cues: string[] = [];
  let commentText: string | undefined;

  while (cursor < text.length) {
    while (cursor < text.length && /\s/u.test(text[cursor])) {
      cursor += 1;
    }

    if (cursor >= text.length) {
      break;
    }

    if (text[cursor] === '<' && text[cursor + 1] === '<') {
      const close = text.indexOf('>>', cursor + 2);
      if (close < 0) {
        return null;
      }
      cues.push(text.slice(cursor, close + 2));
      cursor = close + 2;
      continue;
    }

    if (text[cursor] === '%') {
      commentText = text.slice(cursor + 1).trim();
      cursor = text.length;
      continue;
    }

    return null;
  }

  return {
    inlineMarkdown: cues.join(' '),
    commentText,
  };
}

function extractMood(line: string): { text: string; mood?: string } {
  const moodMatch = line.match(/(?:\[(.+?)\]|【(.+?)】)\s*$/u);
  if (moodMatch === null) {
    return { text: line };
  }
  return {
    text: line.slice(0, moodMatch.index).trimEnd(),
    mood: (moodMatch[1] ?? moodMatch[2])?.trim(),
  };
}

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

function consumeBlockTechCue(lines: string[], start: number): { value: string; closed: boolean; nextIndex: number } {
  const first = lines[start].trim();
  if (first !== '<<<') {
    const singleLine = first.replace(/^<<<\s*/u, '');
    if (singleLine.endsWith('>>>')) {
      return {
        value: singleLine.slice(0, -3).trim(),
        closed: true,
        nextIndex: start + 1,
      };
    }
    if (singleLine.endsWith('<<<')) {
      return {
        value: singleLine.slice(0, -3).trim(),
        closed: true,
        nextIndex: start + 1,
      };
    }
  }

  const payload: string[] = [];
  const firstPayload = first.replace(/^<<<\s*/u, '').trim();
  if (firstPayload.length > 0) {
    payload.push(firstPayload);
  }

  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === '>>>') {
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    if (trimmed.endsWith('>>>')) {
      const linePayload = trimmed.slice(0, -3).trim();
      if (linePayload.length > 0) {
        payload.push(linePayload);
      }
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    if (trimmed === '<<<') {
      if (hasPrimaryBlockTechCueCloseAhead(lines, i + 1)) {
        payload.push(lines[i]);
        continue;
      }
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    if (trimmed.endsWith('<<<')) {
      const linePayload = trimmed.slice(0, -3).trim();
      if (linePayload.length > 0) {
        payload.push(linePayload);
      }
      return { value: payload.join('\n'), closed: true, nextIndex: i + 1 };
    }
    payload.push(lines[i]);
  }

  return { value: payload.join('\n'), closed: false, nextIndex: lines.length };
}

function hasPrimaryBlockTechCueCloseAhead(lines: string[], start: number): boolean {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim() === '>>>') {
      return true;
    }
  }
  return false;
}

function parseMarkdownBlocks(markdown: string, options?: { inSongContext?: boolean }): Content[] {
  const tree = fromMarkdown(markdown, markdownParseOptions);
  const blocks = tree.children as Content[];
  for (const block of blocks) {
    transformSongScopedInlineNodes(block, { inSongContext: options?.inSongContext ?? false });
  }
  return blocks;
}

function parseBlockTechCuePayload(payload: string, options: Required<DraMarkOptions>): DraMarkRootContent[] {
  if (payload.trim().length === 0) {
    return [];
  }

  const nested = parseDraMark(payload, {
    translationEnabled: options.translationEnabled,
    includeComments: options.includeComments,
    strictMode: false,
    characterDeclarationMode: options.characterDeclarationMode,
    multipassDebug: false,
    pass4Restore: options.pass4Restore,
  });

  return nested.tree.children;
}

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
    children: parseInlinePhrasing(headingMatch[2]),
  };
}

function asThematicBreak(): ThematicBreak {
  return { type: 'thematicBreak' };
}

function parseInlinePhrasing(value: string): PhrasingContent[] {
  const blocks = parseMarkdownBlocks(value);
  const first = blocks[0];
  if (first?.type === 'paragraph') {
    return first.children as PhrasingContent[];
  }
  return [{ type: 'text', value } satisfies PhrasingContent];
}

function transformSongScopedInlineNodes(node: unknown, options: { inSongContext: boolean }): void {
  if (!hasChildren(node)) {
    return;
  }

  for (const child of node.children) {
    if (options.inSongContext && isInlineSongNode(child)) {
      (child as { type: string }).type = 'inline-spoken';
    }
    transformSongScopedInlineNodes(child, options);
  }
}

function hasChildren(node: unknown): node is { children: unknown[] } {
  return typeof node === 'object' && node !== null && Array.isArray((node as { children?: unknown[] }).children);
}

function isInlineSongNode(node: unknown): node is { type: 'inline-song'; value: string } {
  return typeof node === 'object'
    && node !== null
    && (node as { type?: string }).type === 'inline-song'
    && typeof (node as { value?: unknown }).value === 'string';
}
