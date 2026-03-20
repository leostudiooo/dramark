import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
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

  it('throws the first warning in strict mode when multiple warnings exist', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { strictMode: true });
    const file = new VFile({ value: '$$\n= orphan translation line' });
    const tree = processor.parse(file);

    await expect(processor.run(tree, file)).rejects.toThrow('TRANSLATION_OUTSIDE_CHARACTER');
  });

  it('tokenizes inline markers in micromark-integrated mode', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '台词 <<LX01 GO>> 与 $短唱$ 和 {动作}' });
    const tree = processor.parse(file) as { children: Array<{ type: string; value?: string; children?: unknown[] }> };

    await processor.run(tree, file);

    const allTypes = flatten(tree).map((node) => node.type);
    const allNodes = flatten(tree);
    const techCue = allNodes.find((node) => node.type === 'inline-tech-cue');
    const inlineSong = allNodes.find((node) => node.type === 'inline-song');
    const inlineAction = allNodes.find((node) => node.type === 'inline-action');

    expect(allTypes).toContain('inline-tech-cue');
    expect(allTypes).toContain('inline-song');
    expect(allTypes).toContain('inline-action');
    expect(techCue?.value).toBe('LX01 GO');
    expect(inlineSong?.value).toBe('短唱');
    expect(inlineAction?.value).toBe('动作');
  });

  it('does not create inline-tech-cue when <<...>> spans lines', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '台词 <<LX01\nGO>> 不应闭合' });
    const tree = processor.parse(file) as { children: Array<{ type: string; children?: unknown[] }> };

    await processor.run(tree, file);

    const allTypes = flatten(tree).map((node) => node.type);
    expect(allTypes).not.toContain('inline-tech-cue');
  });

  it('does not create inline-tech-cue inside fenced code sanctuary', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '```\n<<LX01 GO>>\n```' });
    const tree = processor.parse(file) as { children: Array<{ type: string; value?: string; children?: unknown[] }> };

    await processor.run(tree, file);

    const allNodes = flatten(tree);
    const allTypes = allNodes.map((node) => node.type);
    const codeNode = allNodes.find((node) => node.type === 'code') as { type: string; value?: string } | undefined;

    expect(allTypes).not.toContain('inline-tech-cue');
    expect(codeNode?.value).toContain('<<LX01 GO>>');
  });

  it('does not overwrite tree.children in micromark-integrated mode', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '@A\n普通 markdown 行' });
    const tree = processor.parse(file) as { children: Array<{ type: string }> };

    expect(tree.children[0].type).toBe('paragraph');

    await processor.run(tree, file);

    expect(tree.children[0].type).toBe('paragraph');
    expect((file.data.dramark as { parserMode: string }).parserMode).toBe('micromark');
    expect((file.data.dramark as { integrationMode: string }).integrationMode).toBe('micromark-only');
  });

  it('stores dramark metadata on file.data', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '= orphan translation line' });
    const tree = processor.parse(file);

    await processor.run(tree, file);

    const dramark = file.data.dramark as {
      warnings: Array<{ code: string }>;
      metadata: { translationEnabledFromFrontmatter: boolean };
      parserMode: string;
      integrationMode: string;
    };

    expect(dramark.parserMode).toBe('micromark');
    expect(dramark.integrationMode).toBe('micromark-only');
    expect(dramark.metadata.translationEnabledFromFrontmatter).toBe(false);
    expect(dramark.warnings.map((warning) => warning.code)).toContain('TRANSLATION_OUTSIDE_CHARACTER');
  });

  it('exposes multipass debug artifacts on file.data when enabled', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark, { multipassDebug: true, pass4Restore: false });
    const file = new VFile({ value: '@A\n台词 <<LX01 GO>>' });
    const tree = processor.parse(file);

    await processor.run(tree, file);

    const dramark = file.data.dramark as {
      multipassDebug?: {
        pass2: { segments: Array<{ kind: string }> };
        pass4: { enabled: boolean; executed: boolean };
      };
    };

    expect(dramark.multipassDebug?.pass2.segments.map((segment) => segment.kind)).toEqual(['character', 'content']);
    expect(dramark.multipassDebug?.pass4.enabled).toBe(false);
    expect(dramark.multipassDebug?.pass4.executed).toBe(false);
  });

  it('keeps tree intact while collecting parse metadata', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark);
    const file = new VFile({ value: '= orphan translation line\n台词 <<LX01 GO>>' });
    const tree = processor.parse(file) as { children: Array<{ type: string }> };

    expect(tree.children[0].type).toBe('paragraph');
    await processor.run(tree, file);

    const dramark = file.data.dramark as {
      warnings: Array<{ code: string }>;
      metadata: { translationEnabledFromFrontmatter: boolean };
      parserMode: string;
      integrationMode: string;
    };
    const allTypes = flatten(tree).map((node) => node.type);

    expect(tree.children[0].type).toBe('paragraph');
    expect(dramark.parserMode).toBe('micromark');
    expect(dramark.integrationMode).toBe('micromark-only');
    expect(dramark.metadata.translationEnabledFromFrontmatter).toBe(false);
    expect(dramark.warnings.map((warning) => warning.code)).toContain('TRANSLATION_OUTSIDE_CHARACTER');
    expect(allTypes).toContain('inline-tech-cue');
  });

  it('works in a parse-run-stringify pipeline', async () => {
    const processor = unified().use(remarkParse).use(remarkDraMark).use(remarkStringify);
    const output = await processor.process('@A\n普通 markdown 行');

    expect(String(output.value)).toContain('@A');
    expect(String(output.value)).toContain('普通 markdown 行');
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
