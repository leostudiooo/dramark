import type { RootContent } from 'mdast';
import type { DraMarkRootContent } from '../types.js';
import type { OutlineItem } from './types.js';

export function buildOutline(nodes: DraMarkRootContent[]): OutlineItem[] {
  const outline: OutlineItem[] = [];
  for (const node of nodes) {
    collectOutline(node, outline);
  }
  return outline;
}

function collectOutline(node: DraMarkRootContent | RootContent, out: OutlineItem[]): void {
  switch (node.type) {
    case 'heading': {
      out.push({
        kind: 'heading',
        label: extractText(node),
        depth: node.depth,
      });
      break;
    }
    case 'thematicBreak': {
      out.push({ kind: 'thematic-break', label: '---' });
      break;
    }
    case 'character-block': {
      out.push({ kind: 'character', label: node.name });
      for (const child of node.children) {
        collectOutline(child as DraMarkRootContent, out);
      }
      break;
    }
    case 'song-container': {
      out.push({ kind: 'song-container', label: 'song' });
      for (const child of node.children) {
        collectOutline(child as DraMarkRootContent, out);
      }
      break;
    }
    default:
      break;
  }
}

function extractText(node: RootContent): string {
  if (!('children' in node) || !Array.isArray(node.children)) {
    return '';
  }
  return node.children.map((child) => extractNodeText(child as RootContent)).join('').trim();
}

function extractNodeText(node: RootContent): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractNodeText(child as RootContent)).join('');
  }
  return '';
}
