import * as vscode from 'vscode';
import { scanSegments } from '../../../src/parser.js';
import type { ScannedSegment } from '../../../src/parser.js';

export class DraMarkFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];

    const lines = readAllLines(document);
    const frontmatter = getFrontmatterRange(lines);
    if (frontmatter !== null) {
      pushRange(ranges, frontmatter.startLine, frontmatter.endLine);
    }
    const startIndex = frontmatter === null ? 0 : frontmatter.endLine + 1;
    const segments = scanSegments(lines, startIndex);

    let songStart: number | null = null;
    let characterStart: number | null = null;
    let translationStart: number | null = null;

    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const segLine = toZeroBased(seg.lineNo);

      switch (seg.kind) {
        case 'song-toggle': {
          closeTranslation(ranges, translationStart, segLine - 1);
          translationStart = null;
          closeCharacter(ranges, characterStart, segLine - 1);
          characterStart = null;
          if (songStart === null) {
            songStart = segLine;
          } else {
            pushRange(ranges, songStart, segLine);
            songStart = null;
          }
          break;
        }

        case 'spoken-toggle':
        case 'heading':
        case 'thematic-break':
        case 'character-exit': {
          closeTranslation(ranges, translationStart, segLine - 1);
          translationStart = null;
          closeCharacter(ranges, characterStart, segLine - 1);
          characterStart = null;
          break;
        }

        case 'character': {
          closeTranslation(ranges, translationStart, segLine - 1);
          translationStart = null;
          closeCharacter(ranges, characterStart, segLine - 1);
          characterStart = segLine;
          break;
        }

        case 'translation-source': {
          closeTranslation(ranges, translationStart, segLine - 1);
          translationStart = segLine;
          break;
        }

        case 'translation-exit': {
          closeTranslation(ranges, translationStart, segLine);
          translationStart = null;
          break;
        }

        case 'block-tech-cue': {
          closeTranslation(ranges, translationStart, segLine - 1);
          translationStart = null;
          closeCharacter(ranges, characterStart, segLine - 1);
          characterStart = null;
          const endLine = findSegmentEndLine(segments, i, document.lineCount);
          pushRange(ranges, segLine, endLine);
          break;
        }

        case 'comment-block': {
          const endLine = findSegmentEndLine(segments, i, document.lineCount);
          pushRange(ranges, segLine, endLine);
          break;
        }

        default:
          break;
      }
    }

    if (translationStart !== null) {
      closeTranslation(ranges, translationStart, document.lineCount - 1);
    }

    if (characterStart !== null) {
      closeCharacter(ranges, characterStart, document.lineCount - 1);
    }

    if (songStart !== null) {
      pushRange(ranges, songStart, document.lineCount - 1);
    }

    return ranges;
  }
}

function readAllLines(document: vscode.TextDocument): string[] {
  const lines: string[] = [];
  for (let i = 0; i < document.lineCount; i += 1) {
    lines.push(document.lineAt(i).text);
  }
  return lines;
}

function getFrontmatterRange(lines: string[]): { startLine: number; endLine: number } | null {
  if (lines.length < 3 || lines[0].trim() !== '---') {
    return null;
  }

  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
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

function closeCharacter(ranges: vscode.FoldingRange[], start: number | null, end: number): void {
  if (start === null) {
    return;
  }
  pushRange(ranges, start, end);
}

function closeTranslation(ranges: vscode.FoldingRange[], start: number | null, end: number): void {
  if (start === null) {
    return;
  }
  pushRange(ranges, start, end);
}

function findSegmentEndLine(segments: ScannedSegment[], currentIndex: number, lineCount: number): number {
  const next = segments[currentIndex + 1];
  if (!next) {
    return lineCount - 1;
  }
  return Math.max(toZeroBased(segments[currentIndex].lineNo), toZeroBased(next.lineNo) - 1);
}

function toZeroBased(lineNo: number): number {
  return Math.max(0, lineNo - 1);
}
