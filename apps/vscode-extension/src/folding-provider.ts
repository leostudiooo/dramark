import * as vscode from 'vscode';

const songTogglePattern = /^\$\$(?:\s+.*)?$/u;
const blockTechSingleLinePattern = /^<<<.*>>>\s*$/u;

export class DraMarkFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];

    const frontmatter = getFrontmatterRange(document);
    if (frontmatter !== null) {
      pushRange(ranges, frontmatter.startLine, frontmatter.endLine);
    }

    let songStart: number | null = null;
    let blockCommentStart: number | null = null;
    let blockTechStart: number | null = null;
    let characterStart: number | null = null;

    for (let i = 0; i < document.lineCount; i += 1) {
      const line = document.lineAt(i).text;
      const trimmed = line.trim();
      const isRoot = isRootDirectiveLine(line);

      if (!isRoot) {
        continue;
      }

      if (blockCommentStart !== null) {
        if (trimmed === '%%') {
          pushRange(ranges, blockCommentStart, i);
          blockCommentStart = null;
        }
        continue;
      }

      if (blockTechStart !== null) {
        if (isBlockTechClose(trimmed)) {
          pushRange(ranges, blockTechStart, i);
          blockTechStart = null;
        }
        continue;
      }

      const opensCharacter = isCharacterDeclaration(trimmed);
      const closesCharacter =
        trimmed === '@@' ||
        isSongToggle(trimmed) ||
        isRootHeading(line) ||
        isRootReset(line) ||
        trimmed.startsWith('<<<') ||
        opensCharacter;

      if (characterStart !== null && closesCharacter) {
        pushRange(ranges, characterStart, i - 1);
        characterStart = null;
      }

      if (trimmed === '%%') {
        blockCommentStart = i;
        continue;
      }

      if (trimmed.startsWith('<<<')) {
        if (!blockTechSingleLinePattern.test(trimmed)) {
          blockTechStart = i;
        }
        continue;
      }

      if (isSongToggle(trimmed)) {
        if (songStart === null) {
          songStart = i;
        } else {
          pushRange(ranges, songStart, i);
          songStart = null;
        }
        continue;
      }

      if (opensCharacter) {
        characterStart = i;
      }
    }

    if (characterStart !== null) {
      pushRange(ranges, characterStart, document.lineCount - 1);
    }

    return ranges;
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

function pushRange(ranges: vscode.FoldingRange[], start: number, end: number): void {
  if (end <= start) {
    return;
  }
  ranges.push(new vscode.FoldingRange(start, end, vscode.FoldingRangeKind.Region));
}

function isRootDirectiveLine(line: string): boolean {
  return line.trimStart() === line;
}

function isSongToggle(trimmed: string): boolean {
  return songTogglePattern.test(trimmed);
}

function isCharacterDeclaration(trimmed: string): boolean {
  return trimmed.startsWith('@') && trimmed !== '@@';
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

function isBlockTechClose(trimmed: string): boolean {
  return trimmed === '<<<' || trimmed === '>>>' || trimmed.endsWith('>>>');
}
