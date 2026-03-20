import * as vscode from 'vscode';

const tokenLegend = new vscode.SemanticTokensLegend([
  'keyword',
  'class',
  'string',
  'operator',
  'comment',
  'property',
]);

const thematicBreakPattern = /^(?:---|\*\*\*|___)\s*$/u;
const songLinePattern = /^(\$\$)(?:\s+(.*))?\s*$/u;
const translationLinePattern = /^(=)\s+(.*)$/u;
const characterLinePattern = /^@(?!@)(.*)$/u;

export class DraMarkSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  static readonly legend = tokenLegend;

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(tokenLegend);
    const frontmatter = getFrontmatterRange(document);

    let inFence: { marker: '`' | '~'; minLength: number } | null = null;

    for (let line = 0; line < document.lineCount; line += 1) {
      const text = document.lineAt(line).text;

      if (frontmatter !== null && line > frontmatter.startLine && line < frontmatter.endLine) {
        highlightFrontmatterLine(builder, line, text);
        continue;
      }

      if (inFence !== null) {
        if (isFenceCloseLine(text, inFence)) {
          inFence = null;
        }
        continue;
      }

      const fenceOpen = parseFenceOpen(text);
      if (fenceOpen !== null) {
        inFence = fenceOpen;
        continue;
      }

      highlightComment(builder, line, text);
      highlightRootLine(builder, line, text);
      highlightInlineMarkers(builder, line, text);
    }

    return builder.build();
  }
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

function highlightRootLine(builder: vscode.SemanticTokensBuilder, line: number, text: string): void {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed !== text.trimStart()) {
    return;
  }

  if (thematicBreakPattern.test(trimmed)) {
    builder.push(line, 0, trimmed.length, 0, 0);
    return;
  }

  if (trimmed === '@@' || trimmed === '!!' || trimmed === '=') {
    builder.push(line, 0, trimmed.length, 0, 0);
    return;
  }

  const songMatch = trimmed.match(songLinePattern);
  if (songMatch) {
    builder.push(line, 0, songMatch[1].length, 0, 0);
    if (songMatch[2]) {
      const titleStart = trimmed.indexOf(songMatch[2]);
      builder.push(line, titleStart, songMatch[2].length, 2, 0);
    }
    return;
  }

  const translationMatch = trimmed.match(translationLinePattern);
  if (translationMatch) {
    builder.push(line, 0, 1, 3, 0);
    builder.push(line, 2, translationMatch[2].length, 2, 0);
    return;
  }

  const characterMatch = trimmed.match(characterLinePattern);
  if (characterMatch) {
    builder.push(line, 0, 1, 3, 0);
    const nameSpan = extractCharacterNameSpan(trimmed);
    if (nameSpan !== null && nameSpan.length > 0) {
      builder.push(line, nameSpan.start, nameSpan.length, 1, 0);
    }
    return;
  }

  if (trimmed.startsWith('<<<') || trimmed === '>>>') {
    const token = trimmed.startsWith('<<<') ? '<<<' : '>>>';
    builder.push(line, 0, token.length, 0, 0);
  }
}

function extractCharacterNameSpan(trimmed: string): { start: number; length: number } | null {
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

  const value = trimmed.slice(1, end).trim();
  if (value.length === 0) {
    return null;
  }

  const start = trimmed.indexOf(value, 1);
  return {
    start,
    length: value.length,
  };
}

function highlightInlineMarkers(builder: vscode.SemanticTokensBuilder, line: number, text: string): void {
  for (const match of text.matchAll(/(?<!\\)<<([^>\n]+)>>/gu)) {
    const full = match[0];
    const body = match[1];
    const start = match.index ?? 0;
    builder.push(line, start, 2, 3, 0);
    builder.push(line, start + 2, body.length, 2, 0);
    builder.push(line, start + full.length - 2, 2, 3, 0);
  }

  for (const match of text.matchAll(/(?<!\\)[{｛]([^}｝\n]+)[}｝]/gu)) {
    const full = match[0];
    const start = match.index ?? 0;
    builder.push(line, start, full.length, 2, 0);
  }

  for (const match of text.matchAll(/(?<!\\)\$(?!\$)([^$\n]+)(?<!\\)\$(?!\$)/gu)) {
    const full = match[0];
    const start = match.index ?? 0;
    builder.push(line, start, full.length, 2, 0);
  }
}

function highlightComment(builder: vscode.SemanticTokensBuilder, line: number, text: string): void {
  const idx = findCommentIndex(text);
  if (idx >= 0) {
    builder.push(line, idx, text.length - idx, 4, 0);
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

function isFenceCloseLine(line: string, state: { marker: '`' | '~'; minLength: number }): boolean {
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
