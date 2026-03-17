import { describe, expect, it } from 'vitest';
import { parseDraMark } from '../parser.js';

describe('parseDraMark', () => {
  it('parses character declarations and dialogue blocks', () => {
    const input = ['@哈姆雷特', '生存还是毁灭，这是一个问题。', '---', '舞台恢复安静。'].join('\n');

    const result = parseDraMark(input);
    const first = result.tree.children[0] as { type: string; children: unknown[]; name: string };

    expect(first.type).toBe('character-block');
    expect(first.name).toBe('哈姆雷特');
    expect(first.children.length).toBe(1);
  });

  it('builds translation-pair only inside character context', () => {
    const input = ['@冉阿让', '= Who am I?', '我是谁？', '= Can I conceal myself for evermore?', '我能否永远隐藏自己？'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as { children: Array<{ type: string; sourceText: string; target: unknown[] }> };

    expect(character.children[0].type).toBe('translation-pair');
    expect(character.children[0].sourceText).toBe('Who am I?');
    expect(character.children[0].target.length).toBe(1);
    expect(character.children[1].type).toBe('translation-pair');
  });

  it('creates a song-container for $$ blocks', () => {
    const input = ['$$', '@群演', '= In New York you can be a new man!', '在纽约，你可以脱胎换骨！', '$$'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const first = result.tree.children[0] as { type: string; children: unknown[] };

    expect(first.type).toBe('song-container');
    expect(first.children.length).toBe(1);
  });

  it('parses sequential song containers without nested warnings', () => {
    const input = ['$$', '@A', '第一段唱词', '$$', '$$', '@B', '第二段唱词', '$$'].join('\n');

    const result = parseDraMark(input);
    const types = result.tree.children.map((node) => node.type);

    expect(result.warnings).toHaveLength(0);
    expect(types).toEqual(['song-container', 'song-container']);
  });

  it('does not treat plain percentage values as comments', () => {
    const input = ['@财务', '利润下降了 20% 但我们仍在增长。'].join('\n');

    const result = parseDraMark(input);
    const character = result.tree.children[0] as { children: Array<{ type: string; children: Array<{ value: string }> }> };
    const paragraph = character.children[0];

    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children[0].value).toContain('20%');
  });

  it('supports full-width mood annotation in character declarations', () => {
    const input = ['@哈姆雷特@奥菲莉娅【压抑】', '沉默。'].join('\n');

    const result = parseDraMark(input);
    const first = result.tree.children[0] as { type: string; name: string; names: string[]; mood?: string };

    expect(first.type).toBe('character-block');
    expect(first.name).toBe('哈姆雷特');
    expect(first.names).toEqual(['哈姆雷特', '奥菲莉娅']);
    expect(first.mood).toBe('压抑');
  });

  it('emits real heading and thematicBreak nodes at root level', () => {
    const input = ['@哈姆雷特', '生存还是毁灭。', '---', '# 第二场'].join('\n');

    const result = parseDraMark(input);
    const rule = result.tree.children[1] as { type: string };
    const heading = result.tree.children[2] as { type: string; depth: number; children: Array<{ value?: string }> };

    expect(rule.type).toBe('thematicBreak');
    expect(heading.type).toBe('heading');
    expect(heading.depth).toBe(1);
    expect(heading.children[0].value).toBe('第二场');
  });

  it('parses translation target as real CommonMark blocks', () => {
    const input = ['@冉阿让', '= Source line', '- 第一项', '- 第二项', '', '> 引用段落'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as { children: Array<{ type: string; target?: Array<{ type: string }> }> };
    const pair = character.children[0] as { type: string; target: Array<{ type: string }> };

    expect(pair.type).toBe('translation-pair');
    expect(pair.target.map((node) => node.type)).toEqual(['list', 'blockquote']);
  });

  it('preserves CommonMark block structure in character dialogue', () => {
    const input = ['@哈姆雷特', '- *生存*', '- 毁灭', '', '> 这是引用'].join('\n');

    const result = parseDraMark(input);
    const character = result.tree.children[0] as {
      type: string;
      children: Array<{ type: string; children?: Array<{ type: string; children?: Array<{ type: string }> }> }>;
    };

    expect(character.type).toBe('character-block');
    expect(character.children.map((node) => node.type)).toEqual(['list', 'blockquote']);

    const list = character.children[0] as unknown as { children: Array<{ children: Array<{ children: Array<{ type: string }> }> }> };
    expect(list.children[0].children[0].children[0].type).toBe('emphasis');
  });
});