import { parseDocument, isMap, isSeq, isScalar, isPair } from 'yaml';
import type { Document, Scalar, Node } from 'yaml';
import type { DocumentConfig } from '../../src/core/types.js';

export interface FrontmatterPositionContext {
  path: string[];
  existingKeys: string[];
  target: 'key' | 'value' | 'seq-item';
  valueKey?: string;
}

export interface FrontmatterCompletionItem {
  label: string;
  detail: string;
  insertText: string;
  kind: 'key' | 'value';
}

function toOffset(text: string, line: number, col: number): number {
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    const nl = text.indexOf('\n', offset);
    if (nl === -1) return text.length;
    offset = nl + 1;
  }
  return offset + col - 1;
}

export function resolveFrontmatterPosition(
  yamlText: string,
  line: number,
  col: number
): FrontmatterPositionContext {
  const offset = Math.max(0, Math.min(yamlText.length, toOffset(yamlText, line, col)));
  let doc: Document;
  try {
    doc = parseDocument(yamlText);
  } catch {
    return { path: [], existingKeys: [], target: 'key' };
  }

  if (!doc.contents) {
    return { path: [], existingKeys: [], target: 'key' };
  }

  return walkAst(yamlText, doc.contents as Node, offset, []);
}

function walkAst(yamlText: string, node: Node, offset: number, currentPath: string[]): FrontmatterPositionContext {
  if (isMap(node)) {
    const existingKeys: string[] = [];
    for (const item of node.items) {
      if (isPair(item) && isScalar(item.key) && typeof item.key.value === 'string') {
        existingKeys.push(item.key.value);
      }
    }

    for (let i = 0; i < node.items.length; i++) {
      const item = node.items[i];
      if (!isPair(item)) continue;
      const keyNode = item.key as Scalar;
      const keyStr = typeof keyNode?.value === 'string' ? keyNode.value : '';
      const valNode = item.value as Node | null;

      if (keyNode?.range && offset >= keyNode.range[0] && offset <= keyNode.range[2]) {
        return { path: currentPath, existingKeys, target: 'key' };
      }

      if (valNode?.range && offset >= valNode.range[0] && offset <= valNode.range[2]) {
        if (isMap(valNode) || isSeq(valNode)) {
          return walkAst(yamlText, valNode, offset, [...currentPath, keyStr]);
        }
        if (isScalar(valNode) && valNode.value !== null) {
          return { path: currentPath, existingKeys, target: 'value', valueKey: keyStr };
        }
      }

      if (keyNode?.range) {
        let colonIdx = yamlText.indexOf(':', keyNode.range[1]);
        if (colonIdx === -1) colonIdx = keyNode.range[2];
        
        let nextKeyStart = Infinity;
        if (i < node.items.length - 1) {
          const nextItem = node.items[i + 1];
          if (isPair(nextItem) && isScalar(nextItem.key) && (nextItem.key as Scalar).range) {
            nextKeyStart = (nextItem.key as Scalar).range![0];
          }
        }
        
        if (offset > colonIdx && offset <= nextKeyStart) {
          const isValueEmpty = !valNode || (isScalar(valNode) && valNode.value === null);
          
          if (isValueEmpty) {
            // Check if cursor is on the same line as the key
            const nlIdx = yamlText.indexOf('\n', colonIdx);
            if (nlIdx === -1 || offset <= nlIdx) {
               return { path: currentPath, existingKeys, target: 'value', valueKey: keyStr };
            }
            return { path: [...currentPath, keyStr], existingKeys: [], target: 'key' };
          }
          
          if (valNode && (isMap(valNode) || isSeq(valNode))) {
             return walkAst(yamlText, valNode, offset, [...currentPath, keyStr]);
          }
        }
      }
    }
    return { path: currentPath, existingKeys, target: 'key' };
  }

  if (isSeq(node)) {
    for (const item of node.items) {
      const it = item as Node;
      if (it?.range && offset >= it.range[0] && offset <= it.range[2]) {
        if (isMap(it)) {
          return walkAst(yamlText, it, offset, currentPath);
        }
        return { path: currentPath, existingKeys: [], target: 'seq-item' };
      }
    }
    return { path: currentPath, existingKeys: [], target: 'seq-item' };
  }

  return { path: currentPath, existingKeys: [], target: 'key' };
}

const FRONTMATTER_SCHEMA = {
  meta: ['title', 'author', 'locale', 'version'],
  casting: ['characters', 'groups'],
  translation: ['enabled', 'source_lang', 'target_lang', 'render_mode', 'render'],
  tech: ['mics', 'keywords', 'color'],
};

const SEQ_ITEM_SCHEMA: Record<string, string[]> = {
  'casting.characters': ['name', 'id', 'actor', 'mic', 'aliases'],
  'tech.mics': ['id', 'label', 'desc'],
  'tech.keywords': ['token', 'label'],
  'tech.entries': ['id', 'label', 'desc'],
};

export function getFrontmatterCompletions(
  context: FrontmatterPositionContext,
  config?: DocumentConfig
): FrontmatterCompletionItem[] {
  const result: FrontmatterCompletionItem[] = [];

  if (context.target === 'value') {
    const valKey = context.valueKey;
    if (valKey === 'enabled') {
      result.push({ label: 'true', detail: 'boolean', insertText: 'true', kind: 'value' });
      result.push({ label: 'false', detail: 'boolean', insertText: 'false', kind: 'value' });
    } else if (valKey === 'render_mode' || valKey === 'render') {
      ['bilingual', 'source', 'target', 'script'].forEach(r => {
        result.push({ label: r, detail: 'render mode', insertText: r, kind: 'value' });
      });
    } else if (valKey === 'mic' && config?.tech?.mics) {
      config.tech.mics.forEach(m => {
        if (m.id) {
          result.push({ label: m.id, detail: m.label || 'Mic ID', insertText: m.id, kind: 'value' });
        }
      });
    }
    return result;
  }

  if (context.target === 'seq-item') {
    let keyList: string[] = [];
    if (context.path.length === 2 && context.path[0] === 'casting' && context.path[1] === 'characters') {
      keyList = SEQ_ITEM_SCHEMA['casting.characters'];
    } else if (context.path.length === 2 && context.path[0] === 'tech' && context.path[1] === 'mics') {
      keyList = SEQ_ITEM_SCHEMA['tech.mics'];
    } else if (context.path.length === 2 && context.path[0] === 'tech' && context.path[1] === 'keywords') {
      keyList = SEQ_ITEM_SCHEMA['tech.keywords'];
    } else if (context.path.length === 3 && context.path[0] === 'tech' && context.path[2] === 'entries') {
      keyList = SEQ_ITEM_SCHEMA['tech.entries'];
    }

    keyList.forEach(k => {
      if (!context.existingKeys.includes(k)) {
        result.push({ label: k, detail: 'property', insertText: `${k}: `, kind: 'key' });
      }
    });
    return result;
  }

  if (context.target === 'key') {
    let keyList: string[] = [];
    if (context.path.length === 0) {
      keyList = ['meta', 'casting', 'translation', 'tech'];
    } else if (context.path.length === 1) {
      const rootKey = context.path[0] as keyof typeof FRONTMATTER_SCHEMA;
      if (FRONTMATTER_SCHEMA[rootKey]) {
        keyList = FRONTMATTER_SCHEMA[rootKey];
      }
    } else if (context.path.length === 2 && context.path[0] === 'tech') {
      const subKey = context.path[1];
      if (subKey !== 'mics' && subKey !== 'keywords' && subKey !== 'color') {
        keyList = ['color', 'entries'];
      }
    }

    keyList.forEach(k => {
      if (!context.existingKeys.includes(k)) {
        result.push({ label: k, detail: 'property', insertText: `${k}: `, kind: 'key' });
      }
    });
  }

  return result;
}
