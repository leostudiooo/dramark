import { describe, expect, it } from 'vitest';
import { parseDraMark } from '../parser.js';

type CharacterNode = {
  type: 'character-block';
  name: string;
  children: Node[];
};

type Node = {
  type: string;
  name?: string;
  value?: string;
  depth?: number;
  children?: Node[];
  target?: Node[];
};

describe('DraMark edge-case rules', () => {
  it('treats frontmatter fence as phase-0 and does not trigger reset logic', () => {
    const input = ['---', 'title: Demo', 'translation:', '  enabled: true', '---', '@A', '= Hello', '你好'].join('\n');

    const result = parseDraMark(input);

    expect(result.warnings).toHaveLength(0);
    expect(result.metadata.translationEnabledFromFrontmatter).toBe(true);

    const frontmatter = result.tree.children[0] as { type: string };
    const character = result.tree.children[1] as CharacterNode;

    expect(frontmatter.type).toBe('frontmatter');
    expect(character.type).toBe('character-block');
    expect(character.children[0].type).toBe('translation-pair');
  });

  it('keeps indented directive-like lines as dialogue content (container isolation)', () => {
    const input = ['@A', '- 列表项', '  @B', '  = nested source', '  nested target', '继续对白'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as CharacterNode;

    expect(result.warnings).toHaveLength(0);
    expect(character.type).toBe('character-block');
    expect(character.name).toBe('A');
    expect(character.children.some((node) => node.type === 'translation-pair')).toBe(false);
    expect(character.children.some((node) => node.type === 'character-block')).toBe(false);

    const text = character.children.map((node) => collectText(node)).join('\n');
    expect(text).toContain('@B');
    expect(text).toContain('= nested source');
    expect(text).toContain('继续对白');
  });

  it('breaks out of song container when root heading appears', () => {
    const input = ['$$', '@A', '唱词', '# 场景二', '@B', '对白'].join('\n');

    const result = parseDraMark(input);

    expect(result.warnings).toHaveLength(0);

    const song = result.tree.children[0] as { type: string; children: Array<{ type: string }> };
    const heading = result.tree.children[1] as Node;
    const characterAfterHeading = result.tree.children[2] as CharacterNode;

    expect(song.type).toBe('song-container');
    expect(song.children[0].type).toBe('character-block');
    expect(heading.type).toBe('heading');
    expect(heading.depth).toBe(1);
    expect(collectText(heading)).toBe('场景二');
    expect(characterAfterHeading.type).toBe('character-block');
    expect(characterAfterHeading.name).toBe('B');
  });

  it('keeps translation target as block list', () => {
    const input = ['@A', '= source text', '第一段', '', '第二段', '= source text 2', '第三段'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as CharacterNode;

    const firstPair = character.children[0] as { type: string; target: Node[] };
    const secondPair = character.children[1] as { type: string; target: Node[] };

    expect(firstPair.type).toBe('translation-pair');
    expect(firstPair.target).toHaveLength(2);
    expect(collectText(firstPair.target[0])).toContain('第一段');
    expect(collectText(firstPair.target[1])).toContain('第二段');

    expect(secondPair.type).toBe('translation-pair');
    expect(secondPair.target).toHaveLength(1);
    expect(collectText(secondPair.target[0])).toContain('第三段');
  });

  it('applies strict percent-comment lexing rules', () => {
    const input = ['@财务', '利润下降了 20% 但仍在增长。', '利润下降了 20 % 这是注释'].join('\n');

    const result = parseDraMark(input, { includeComments: true });
    const character = result.tree.children[0] as CharacterNode;

    const first = character.children[0] as Node;
    const second = character.children[1] as Node;

    expect(collectText(first)).toContain('20%');
    expect(collectText(first)).toContain('利润下降了 20');
    expect(second.type).toBe('comment-line');
    expect(second.value).toContain('这是注释');
  });

  it('does not leak inline tech cue across lines', () => {
    const input = ['@A', '这是 <<LX01', 'GO>> 测试'].join('\n');

    const result = parseDraMark(input);
    const character = result.tree.children[0] as CharacterNode;

    const first = character.children[0] as Node;
    const flattened = flatten(first);

    expect(flattened.some((node) => node.type === 'inline-tech-cue')).toBe(false);
    expect(collectText(first)).toContain('<<LX01');
    expect(collectText(first)).toContain('GO>>');
  });

  it('keeps root directives inert inside fenced code and resumes parsing after fence', () => {
    const input = ['```', '@B', '= source line', '```', '@A', '正常对白'].join('\n');
    const result = parseDraMark(input, { translationEnabled: true });

    expect(result.warnings).toHaveLength(0);
    expect(result.tree.children.map((node) => node.type)).toEqual(['code', 'character-block']);

    const code = result.tree.children[0] as { type: string; value: string };
    const character = result.tree.children[1] as CharacterNode;

    expect(code.type).toBe('code');
    expect(code.value).toBe('@B\n= source line');
    expect(character.type).toBe('character-block');
    expect(character.name).toBe('A');
    expect(character.children.some((node) => node.type === 'translation-pair')).toBe(false);
  });
});

describe('warning behavior coverage', () => {
  it('collects warning for unclosed block comment', () => {
    const result = parseDraMark(['%%', '未闭合'].join('\n'), { includeComments: true });
    expect(result.warnings.map((warning) => warning.code)).toContain('UNCLOSED_BLOCK_COMMENT');
  });

  it('collects warning for unclosed block tech cue', () => {
    const result = parseDraMark(['<<<', '未闭合'].join('\n'));
    expect(result.warnings.map((warning) => warning.code)).toContain('UNCLOSED_BLOCK_TECH_CUE');
  });

  it('collects warning for unclosed song container', () => {
    const result = parseDraMark(['$$', '@A', '未闭合唱段'].join('\n'));
    expect(result.warnings.map((warning) => warning.code)).toContain('UNCLOSED_SONG_CONTAINER');
  });

  it('collects warning when translation appears outside character context', () => {
    const result = parseDraMark('= orphan line', { translationEnabled: true });
    expect(result.warnings.map((warning) => warning.code)).toContain('TRANSLATION_OUTSIDE_CHARACTER');
  });
});

function flatten(node: Node): Node[] {
  const out: Node[] = [node];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      out.push(...flatten(child));
    }
  }
  if (Array.isArray(node.target)) {
    for (const child of node.target) {
      out.push(...flatten(child));
    }
  }
  return out;
}

function collectText(node: Node): string {
  return flatten(node)
    .map((item) => item.value ?? '')
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
}
