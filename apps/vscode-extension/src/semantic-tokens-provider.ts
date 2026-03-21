import * as vscode from 'vscode';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { DocumentController } from './document-controller.js';

const tokenLegend = new vscode.SemanticTokensLegend([
  'keyword',
  'class',
  'string',
  'operator',
  'comment',
  'property',
]);

type FenceState = { marker: '`' | '~'; minLength: number };
type ScanSegmentView = { kind: string; lineNo: number };

export class DraMarkSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  static readonly legend = tokenLegend;
  constructor(private readonly controller: DocumentController) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(tokenLegend);
    const frontmatter = getFrontmatterRange(document);
    const lines = readAllLines(document);
    const startIndex = frontmatter !== null ? frontmatter.endLine + 1 : 0;
    const viewModel = this.controller.getViewModel(document.uri.toString());
    const segments = getSegmentsFromViewModel(viewModel);
    const fencedLines = collectFencedLines(lines, startIndex);

    if (frontmatter !== null) {
      for (let line = frontmatter.startLine + 1; line < frontmatter.endLine; line += 1) {
        highlightFrontmatterLine(builder, line, lines[line] ?? '');
      }
    }

    for (const segment of segments) {
      highlightSegmentLine(builder, lines, segment);
    }

    if (viewModel !== undefined) {
      highlightFromPass4Tree(builder, viewModel, document, fencedLines);
    }

    return builder.build();
  }
}

function readAllLines(document: vscode.TextDocument): string[] {
  const lines: string[] = [];
  for (let i = 0; i < document.lineCount; i += 1) {
    lines.push(document.lineAt(i).text);
  }
  return lines;
}

function getFrontmatterRange(document: vscode.TextDocument): { startLine: number; endLine: number } | null {
  if (document.lineCount < 3 || document.lineAt(0).text.trim() !== '---') {
    return null;
  }

  for (let i = 1; i < document.lineCount; i += 1) {
    if (document.lineAt(i).text.trim() === '---') {
      return { startLine: 0, endLine: i };
    }
  }

  return null;
}

function highlightFrontmatterLine(builder: vscode.SemanticTokensBuilder, line: number, text: string): void {
  const keyMatch = text.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/u);
  if (keyMatch) {
    builder.push(line, keyMatch[1].length, keyMatch[2].length, 5, 0);
  }
}

function highlightSegmentLine(
  builder: vscode.SemanticTokensBuilder,
  lines: string[],
  segment: ScanSegmentView,
): void {
  const line = segment.lineNo - 1;
  const text = lines[line] ?? '';
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return;
  }

  switch (segment.kind) {
    case 'thematic-break':
      builder.push(line, 0, trimmed.length, 0, 0);
      return;
    case 'song-toggle': {
      builder.push(line, 0, 2, 0, 0);
      const titleStart = text.indexOf('$$') + 2;
      const title = text.slice(titleStart).trim();
      if (title.length > 0) {
        const start = text.indexOf(title, titleStart);
        if (start >= 0) {
          builder.push(line, start, title.length, 2, 0);
        }
      }
      return;
    }
    case 'spoken-toggle':
      builder.push(line, 0, 2, 0, 0);
      return;
    case 'translation-exit':
    case 'character-exit':
      builder.push(line, 0, trimmed.length, 0, 0);
      return;
    case 'translation-source': {
      builder.push(line, 0, 1, 3, 0);
      const value = text.slice(1).trim();
      if (value.length > 0) {
        const start = text.indexOf(value, 1);
        builder.push(line, start >= 0 ? start : 2, value.length, 2, 0);
      }
      return;
    }
    case 'character':
      highlightCharacterDeclaration(builder, line, text.trim());
      return;
    case 'comment-line': {
      const idx = findCommentIndex(text);
      if (idx >= 0) {
        builder.push(line, idx, text.length - idx, 4, 0);
      }
      return;
    }
    case 'comment-block':
      highlightCommentBlockRegion(builder, lines, line);
      return;
    case 'block-tech-cue':
      builder.push(line, 0, 3, 0, 0);
      return;
    case 'heading':
      return;
    default:
      return;
  }
}

function highlightCharacterDeclaration(
  builder: vscode.SemanticTokensBuilder,
  line: number,
  trimmed: string,
): boolean {
  if (!trimmed.startsWith('@') || trimmed === '@@') {
    return false;
  }

  const headEnd = getCharacterHeadEnd(trimmed);
  let cursor = 0;
  let highlighted = false;

  while (cursor < headEnd) {
    if (trimmed[cursor] !== '@') {
      break;
    }
    builder.push(line, cursor, 1, 3, 0);
    highlighted = true;
    cursor += 1;

    while (cursor < headEnd && /\s/u.test(trimmed[cursor])) {
      cursor += 1;
    }

    const nameStart = cursor;
    while (cursor < headEnd) {
      const ch = trimmed[cursor];
      if (ch === '@' || ch === '[' || ch === '【') {
        break;
      }
      cursor += 1;
    }

    let tokenStart = nameStart;
    while (tokenStart < cursor && /\s/u.test(trimmed[tokenStart])) {
      tokenStart += 1;
    }
    let tokenEnd = cursor;
    while (tokenEnd > tokenStart && /\s/u.test(trimmed[tokenEnd - 1])) {
      tokenEnd -= 1;
    }
    if (tokenEnd > tokenStart) {
      builder.push(line, tokenStart, tokenEnd - tokenStart, 1, 0);
    }

    while (cursor < headEnd && /\s/u.test(trimmed[cursor])) {
      cursor += 1;
    }
    if (cursor < headEnd && trimmed[cursor] === '@') {
      continue;
    }
    break;
  }

  return highlighted;
}

function getCharacterHeadEnd(trimmed: string): number {
  let end = trimmed.length;
  const cueIdx = trimmed.indexOf('<<');
  if (cueIdx >= 0) {
    end = Math.min(end, cueIdx);
  }
  const moodIdxSquare = trimmed.indexOf('[');
  if (moodIdxSquare >= 0) {
    end = Math.min(end, moodIdxSquare);
  }
  const moodIdxCn = trimmed.indexOf('【');
  if (moodIdxCn >= 0) {
    end = Math.min(end, moodIdxCn);
  }
  const commentIdx = findCommentIndex(trimmed);
  if (commentIdx >= 0) {
    end = Math.min(end, commentIdx);
  }
  return end;
}

function highlightComment(builder: vscode.SemanticTokensBuilder, line: number, text: string): void {
  const idx = findCommentIndex(text);
  if (idx >= 0) {
    builder.push(line, idx, text.length - idx, 4, 0);
  }
}

function highlightCommentBlockRegion(
  builder: vscode.SemanticTokensBuilder,
  lines: string[],
  startLine: number,
): void {
  let endLine = lines.length - 1;
  for (let line = startLine + 1; line < lines.length; line += 1) {
    if ((lines[line] ?? '').trim() === '%%') {
      endLine = line;
      break;
    }
  }

  for (let line = startLine; line <= endLine; line += 1) {
    const text = lines[line] ?? '';
    if (text.length === 0) {
      continue;
    }
    builder.push(line, 0, text.length, 4, 0);
  }
}

function findCommentIndex(text: string): number {
  const trimmedStart = text.trimStart();
  if (trimmedStart.startsWith('%') && !trimmedStart.startsWith('%%')) {
    return text.length - trimmedStart.length;
  }

  const inlineMatch = text.match(/\s%(?!%).*$/u);
  if (!inlineMatch || inlineMatch.index === undefined) {
    return -1;
  }
  return inlineMatch.index + 1;
}

function parseFenceOpen(line: string): { marker: '`' | '~'; minLength: number } | null {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^(`{3,}|~{3,})/u);
  if (!match) {
    return null;
  }
  return {
    marker: match[1][0] as '`' | '~',
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

function collectFencedLines(lines: string[], startIndex: number): Set<number> {
  const result = new Set<number>();
  let fenceState: FenceState | null = null;
  for (let i = startIndex; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (fenceState !== null) {
      result.add(i);
      if (isFenceCloseLine(text, fenceState)) {
        fenceState = null;
      }
      continue;
    }
    const open = parseFenceOpen(text);
    if (open !== null) {
      fenceState = open;
      result.add(i);
    }
  }
  return result;
}

function getSegmentsFromViewModel(viewModel: ParseViewModel | undefined): ScanSegmentView[] {
  const segments = viewModel?.metadata?.multipassDebug?.pass2?.segments;
  if (!Array.isArray(segments)) {
    return [];
  }
  return segments
    .filter((segment): segment is ScanSegmentView => {
      if (!segment || typeof segment !== 'object') {
        return false;
      }
      const candidate = segment as { kind?: unknown; lineNo?: unknown };
      return typeof candidate.kind === 'string' && typeof candidate.lineNo === 'number';
    })
    .sort((a, b) => a.lineNo - b.lineNo);
}

function highlightFromPass4Tree(
  builder: vscode.SemanticTokensBuilder,
  viewModel: ParseViewModel,
  document: vscode.TextDocument,
  fencedLines: Set<number>,
): void {
  const root = viewModel.tree as unknown;
  walkTree(root, (node) => {
    const candidate = node as { type?: unknown };
    if (typeof candidate.type !== 'string') {
      return;
    }
    const range = toDocumentRange(node, document);
    if (range === null) {
      return;
    }
    if (isRangeInFencedLines(range, fencedLines)) {
      return;
    }
    const startLine = range.start.line;
    const startChar = range.start.character;
    const length = range.end.character - range.start.character;
    if (length <= 0) {
      return;
    }

    switch (candidate.type) {
      case 'inline-tech-cue':
        builder.push(startLine, startChar, length, 2, 0);
        break;
      case 'inline-action':
      case 'inline-song':
        builder.push(startLine, startChar, length, 2, 0);
        break;
      case 'comment-line':
      case 'comment-block':
        builder.push(startLine, startChar, length, 4, 0);
        break;
      case 'block-tech-cue':
        builder.push(startLine, startChar, length, 2, 0);
        break;
      default:
        break;
    }
  });
}

function walkTree(node: unknown, visit: (node: unknown) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  visit(node);
  if (Array.isArray(node)) {
    for (const item of node) {
      walkTree(item, visit);
    }
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    walkTree(value, visit);
  }
}

function toDocumentRange(node: unknown, document: vscode.TextDocument): vscode.Range | null {
  const candidate = node as {
    position?: {
      start?: { line?: number; column?: number; offset?: number };
      end?: { line?: number; column?: number; offset?: number };
    };
  };
  const pos = candidate.position;
  if (typeof pos?.start?.offset !== 'number' || typeof pos?.end?.offset !== 'number') {
    return null;
  }
  const startOffset = pos.start.offset;
  const endOffset = pos.end.offset;
  if (startOffset < 0 || endOffset <= startOffset) {
    return null;
  }
  return new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset));
}

function isRangeInFencedLines(range: vscode.Range, fencedLines: Set<number>): boolean {
  return fencedLines.has(range.start.line);
}
