import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { VFile } from 'vfile';
import remarkDraMark from '../index.js';
import { parseDraMark } from '../parser.js';

describe('remarkDraMark plugin', () => {
  it('collects warnings in non-strict mode', () => {
    const result = parseDraMark('= orphan translation line');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('TRANSLATION_OUTSIDE_CHARACTER');
  });

  it('throws in strict mode when warnings exist', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { strictMode: true });
    const file = new VFile({ value: '$$\n@A\n未闭合唱段' });
    const tree = processor.parse(file);

    await expect(processor.run(tree, file)).rejects.toThrow('UNCLOSED_SONG_CONTAINER');
  });

  it('tokenizes inline markers in micromark mode', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { parserMode: 'micromark' });
    const file = new VFile({ value: '台词 <<LX01 GO>> 与 $短唱$ 和 {动作}' });
    const tree = processor.parse(file) as { children: Array<{ type: string; children?: unknown[] }> };

    await processor.run(tree, file);

    const allTypes = flatten(tree).map((node) => node.type);
    expect(allTypes).toContain('inline-tech-cue');
    expect(allTypes).toContain('inline-song');
    expect(allTypes).toContain('inline-action');
  });

  it('does not create inline-tech-cue when <<...>> spans lines', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { parserMode: 'micromark' });
    const file = new VFile({ value: '台词 <<LX01\nGO>> 不应闭合' });
    const tree = processor.parse(file) as { children: Array<{ type: string; children?: unknown[] }> };

    await processor.run(tree, file);

    const allTypes = flatten(tree).map((node) => node.type);
    expect(allTypes).not.toContain('inline-tech-cue');
  });

  it('does not overwrite tree.children in micromark mode', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { parserMode: 'micromark' });
    const file = new VFile({ value: '@A\n普通 markdown 行' });
    const tree = processor.parse(file) as { children: Array<{ type: string }> };

    await processor.run(tree, file);

    expect(tree.children[0].type).toBe('paragraph');
    expect((file.data.dramark as { parserMode: string }).parserMode).toBe('micromark');
  });
});

function flatten(node: { type?: string; children?: unknown[] }): Array<{ type: string; children?: unknown[] }> {
  const out: Array<{ type: string; children?: unknown[] }> = [];
  if (typeof node.type === 'string') {
    out.push(node as { type: string; children?: unknown[] });
  }
  if (!Array.isArray(node.children)) {
    return out;
  }
  for (const child of node.children) {
    if (typeof child === 'object' && child !== null) {
      out.push(...flatten(child as { type?: string; children?: unknown[] }));
    }
  }
  return out;
}