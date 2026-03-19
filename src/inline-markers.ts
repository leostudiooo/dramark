import type { PhrasingContent } from 'mdast';
import type { InlineAction, InlineSongSegment, InlineSpokenSegment, InlineTechCue } from './types.js';

export interface InlineMarkerParseOptions {
  inSongContext?: boolean; // true = $...$ is inline-spoken, false = $...$ is inline-song
}

export function transformInlineMarkersInTree(node: unknown, options?: InlineMarkerParseOptions): void {
  if (!hasChildren(node)) {
    return;
  }

  normalizeHtmlSplitTechCues(node.children);

  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i];
    if (isTextNode(child)) {
      const replacements = parseInlineContent(child.value, options);
      node.children.splice(i, 1, ...replacements);
      i += replacements.length - 1;
      continue;
    }
    transformInlineMarkersInTree(child, options);
  }
}

export function parseInlineContent(line: string, options?: InlineMarkerParseOptions): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
  let cursor = 0;
  const inSongContext = options?.inSongContext ?? false;

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
        if (inSongContext) {
          nodes.push({ type: 'inline-spoken', value } satisfies InlineSpokenSegment);
        } else {
          nodes.push({ type: 'inline-song', value } satisfies InlineSongSegment);
        }
        cursor = close + 1;
        continue;
      }
      pushText('$');
      cursor = actionStart + 1;
      continue;
    }

    if (token === '<' && line[actionStart + 1] === '<') {
      const close = line.indexOf('>>', actionStart + 2);
      const value = close > actionStart + 1 ? line.slice(actionStart + 2, close) : '';
      if (close > actionStart + 1 && !value.includes('\n')) {
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

function hasChildren(node: unknown): node is { children: unknown[] } {
  return typeof node === 'object' && node !== null && Array.isArray((node as { children?: unknown[] }).children);
}

function isTextNode(node: unknown): node is { type: 'text'; value: string } {
  return typeof node === 'object' && node !== null && (node as { type?: string }).type === 'text' && typeof (node as { value?: unknown }).value === 'string';
}

function isHtmlNode(node: unknown): node is { type: 'html'; value: string } {
  return typeof node === 'object' && node !== null && (node as { type?: string }).type === 'html' && typeof (node as { value?: unknown }).value === 'string';
}

function normalizeHtmlSplitTechCues(children: unknown[]): void {
  for (let i = 0; i + 2 < children.length; i += 1) {
    const left = children[i];
    const middle = children[i + 1];
    const right = children[i + 2];

    if (!isTextNode(left) || !isHtmlNode(middle) || !isTextNode(right)) {
      continue;
    }

    if (!left.value.endsWith('<') || !right.value.startsWith('>')) {
      continue;
    }

    if (!middle.value.startsWith('<') || !middle.value.endsWith('>')) {
      continue;
    }

    const cueValue = middle.value.slice(1, -1);
    if (cueValue.length === 0 || cueValue.includes('\n')) {
      continue;
    }

    const leftText = left.value.slice(0, -1);
    const rightText = right.value.slice(1);

    const replacements: PhrasingContent[] = [];
    if (leftText.length > 0) {
      replacements.push({ type: 'text', value: leftText });
    }
    replacements.push({ type: 'inline-tech-cue', value: cueValue } satisfies InlineTechCue);
    if (rightText.length > 0) {
      replacements.push({ type: 'text', value: rightText });
    }

    children.splice(i, 3, ...replacements);
    i += replacements.length - 1;
  }
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