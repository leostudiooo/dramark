import type * as vscode from 'vscode';
import { scanSegments } from '../../../src/parser.js';
import type { ScannedSegment } from '../../../src/parser.js';

export type StructureKind =
  | 'frontmatter'
  | 'heading'
  | 'song'
  | 'character'
  | 'translation'
  | 'block-tech-cue'
  | 'comment-block';

export interface StructureNode {
  kind: StructureKind;
  label: string;
  startLine: number;
  endLine: number;
  children: StructureNode[];
}

export function analyzeDocumentStructure(document: vscode.TextDocument): StructureNode[] {
  const lines = readAllLines(document);
  const roots: StructureNode[] = [];
  const openStack: StructureNode[] = [];

  const frontmatter = getFrontmatterRange(lines);
  if (frontmatter !== null) {
    roots.push({
      kind: 'frontmatter',
      label: 'frontmatter',
      startLine: frontmatter.startLine,
      endLine: frontmatter.endLine,
      children: [],
    });
  }

  const startIndex = frontmatter === null ? 0 : frontmatter.endLine + 1;
  const segments = scanSegments(lines, startIndex);

  const addNode = (node: StructureNode): void => {
    const parent = openStack[openStack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  };

  const openContainer = (kind: Extract<StructureKind, 'song' | 'character' | 'translation'>, label: string, line: number): void => {
    const node: StructureNode = {
      kind,
      label,
      startLine: line,
      endLine: line,
      children: [],
    };
    addNode(node);
    openStack.push(node);
  };

  const closeTop = (endLine: number): void => {
    const node = openStack.pop();
    if (!node) {
      return;
    }
    node.endLine = Math.max(node.startLine, endLine);
  };

  const closeWhile = (kinds: Set<StructureNode['kind']>, endLine: number): void => {
    while (openStack.length > 0 && kinds.has(openStack[openStack.length - 1].kind)) {
      closeTop(endLine);
    }
  };

  const closeThrough = (kind: StructureNode['kind'], endLine: number): void => {
    while (openStack.length > 0) {
      const top = openStack[openStack.length - 1];
      closeTop(endLine);
      if (top.kind === kind) {
        return;
      }
    }
  };

  const hasOpenKind = (kind: StructureNode['kind']): boolean => openStack.some((node) => node.kind === kind);

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const segLine = toZeroBased(seg.lineNo);

    switch (seg.kind) {
      case 'song-toggle': {
        if (hasOpenKind('song')) {
          closeThrough('song', segLine);
        } else {
          closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine - 1);
          const title = seg.title?.trim();
          openContainer('song', title ? `$$ ${title}` : '$$', segLine);
        }
        break;
      }

      case 'spoken-toggle': {
        closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine - 1);
        break;
      }

      case 'heading': {
        closeThroughAll(openStack, segLine - 1);
        addNode({
          kind: 'heading',
          label: seg.raw.trim(),
          startLine: segLine,
          endLine: segLine,
          children: [],
        });
        break;
      }

      case 'thematic-break': {
        closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine - 1);
        break;
      }

      case 'character': {
        closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine - 1);
        openContainer('character', `@${seg.name}`, segLine);
        break;
      }

      case 'character-exit': {
        closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine);
        break;
      }

      case 'translation-source': {
        if (!hasOpenKind('character')) {
          break;
        }
        closeWhile(new Set<StructureNode['kind']>(['translation']), segLine - 1);
        openContainer('translation', `= ${seg.text}`, segLine);
        break;
      }

      case 'translation-exit': {
        closeWhile(new Set<StructureNode['kind']>(['translation']), segLine);
        break;
      }

      case 'comment-block': {
        const endLine = findSegmentEndLine(segments, i, document.lineCount);
        addNode({
          kind: 'comment-block',
          label: '%% comment',
          startLine: segLine,
          endLine,
          children: [],
        });
        break;
      }

      case 'block-tech-cue': {
        closeWhile(new Set<StructureNode['kind']>(['translation', 'character']), segLine - 1);
        const endLine = findSegmentEndLine(segments, i, document.lineCount);
        addNode({
          kind: 'block-tech-cue',
          label: '<<< tech-cue >>>',
          startLine: segLine,
          endLine,
          children: [],
        });
        break;
      }

      default:
        break;
    }
  }

  closeThroughAll(openStack, document.lineCount - 1);
  return roots;
}

function closeThroughAll(openStack: StructureNode[], endLine: number): void {
  while (openStack.length > 0) {
    const node = openStack.pop();
    if (!node) {
      continue;
    }
    node.endLine = Math.max(node.startLine, endLine);
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
