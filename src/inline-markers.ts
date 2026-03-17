import type { PhrasingContent } from 'mdast';
import type { InlineAction, InlineSongSegment, InlineTechCue } from './types.js';

export function transformInlineMarkersInTree(node: unknown): void {
  if (!hasChildren(node)) {
    return;
  }

  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i];
    if (isTextNode(child)) {
      const replacements = parseInlineContent(child.value);
      node.children.splice(i, 1, ...replacements);
      i += replacements.length - 1;
      continue;
    }
    transformInlineMarkersInTree(child);
  }
}

export function parseInlineContent(line: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
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