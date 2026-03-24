import { describe, expect, it } from 'vitest';
import { parseDraMark } from '../parser.js';

describe('parseDraMark', () => {
  it('does not throw when strictMode is passed to parseDraMark', () => {
    expect(() => parseDraMark('= orphan translation line', { strictMode: true })).not.toThrow();

    const result = parseDraMark('= orphan translation line', { strictMode: true });
    expect(result.warnings.map((warning) => warning.code)).toContain('TRANSLATION_OUTSIDE_CHARACTER');
  });

  it('exposes raw frontmatter in metadata for frontend-side normalization', () => {
    const input = ['---', 'meta:', '  title: Demo', 'unknown_field:', '  keep: true', '---', '@A', '台词'].join('\n');
    const result = parseDraMark(input);

    expect(result.warnings).toHaveLength(0);
    expect(result.metadata.frontmatterRaw).toContain('meta:');
    expect(result.metadata.frontmatterRaw).toContain('unknown_field:');
  });

  it('keeps frontmatter metadata undefined when no frontmatter exists', () => {
    const result = parseDraMark('@A\n台词');
    expect(result.metadata.frontmatterRaw).toBeUndefined();
  });

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

  it('parses line comments in character context without producing empty paragraphs', () => {
    const input = ['@舞监', '台词前缀', '% 这是注释', '台词后缀'].join('\n');

    const result = parseDraMark(input, { includeComments: true });
    const character = result.tree.children[0] as {
      type: string;
      children: Array<{ type: string; value?: string; children?: Array<{ value?: string }> }>;
    };

    expect(character.type).toBe('character-block');
    expect(character.children.map((node) => node.type)).toEqual(['paragraph', 'comment-line', 'paragraph']);
    expect(character.children[1].value).toContain('这是注释');
    expect(character.children.some((node) => node.type === 'paragraph' && (node.children?.[0]?.value ?? '') === '')).toBe(false);
  });

  it('keeps dialogue text before inline % comment in song character context', () => {
    const input = ['$$', '@舞监', '台词主体 % 唱段注释', '$$'].join('\n');

    const result = parseDraMark(input, { includeComments: true });
    const song = result.tree.children[0] as {
      type: string;
      children: Array<{
        type: string;
        children: Array<{ type: string; value?: string; children?: Array<{ value?: string }> }>;
      }>;
    };
    const character = song.children[0];

    expect(song.type).toBe('song-container');
    expect(character.type).toBe('character-block');
    expect(character.children.map((node) => node.type)).toEqual(['paragraph', 'comment-line']);
    expect(character.children[0].children?.[0]?.value).toContain('台词主体');
    expect(character.children[1].value).toContain('唱段注释');
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

  it('keeps nested translation-like directives as inert dialogue content', () => {
    const input = ['@A', '- 容器内文本', '  = nested source', '  nested target', '容器外对白'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as { type: string; children: Array<{ type: string; children?: Array<{ value?: string }> }> };

    expect(character.type).toBe('character-block');
    expect(character.children.some((node) => node.type === 'translation-pair')).toBe(false);

    const serialized = JSON.stringify(character.children);
    expect(serialized).toContain('= nested source');
    expect(serialized).toContain('容器外对白');
  });

  it('parses inline tech cue in dialogue line', () => {
    const input = ['@舞监', '执行 <<LX01 GO>> 现在'].join('\n');

    const result = parseDraMark(input);
    const character = result.tree.children[0] as {
      type: string;
      children: Array<{ type: string; children?: Array<{ type: string; value?: string }> }>;
    };
    const paragraph = character.children[0] as { children: Array<{ type: string; value?: string }> };
    const techCue = paragraph.children.find((node) => node.type === 'inline-tech-cue');

    expect(character.type).toBe('character-block');
    expect(paragraph.children.map((node) => node.type)).toContain('inline-tech-cue');
    expect(techCue?.value).toBe('LX01 GO');
  });

  it('keeps tech-cue payload opaque while parsing surrounding markdown and dramark normally', () => {
    const input = ['@A', '前缀 **加粗** <<角色=HM2 from=HM1->HM2>> 后缀', '= Source', '目标'].join('\n');
    const result = parseDraMark(input, { translationEnabled: true });

    const character = result.tree.children[0] as {
      type: string;
      children: Array<
        | { type: 'paragraph'; children: Array<{ type: string; value?: string }> }
        | { type: 'translation-pair'; sourceText: string; target: Array<{ type: string }> }
      >;
    };
    const paragraph = character.children[0] as { type: 'paragraph'; children: Array<{ type: string; value?: string }> };
    const pair = character.children[1] as { type: 'translation-pair'; sourceText: string; target: Array<{ type: string }> };
    const techCue = paragraph.children.find((node) => node.type === 'inline-tech-cue');

    expect(result.warnings).toHaveLength(0);
    expect(character.type).toBe('character-block');
    expect(paragraph.children.some((node) => node.type === 'strong')).toBe(true);
    expect(techCue?.value).toBe('角色=HM2 from=HM1->HM2');
    expect(pair.type).toBe('translation-pair');
    expect(pair.sourceText).toBe('Source');
    expect(pair.target.map((block) => block.type)).toEqual(['paragraph']);
  });

  it('parses >>> quote line as CommonMark blockquote outside block-tech-cue', () => {
    const result = parseDraMark('>>> 引用');
    const first = result.tree.children[0] as { type: string };

    expect(result.warnings).toHaveLength(0);
    expect(first.type).toBe('blockquote');
  });

  it('closes block-tech-cue before parsing adjacent >>> quote lines', () => {
    const input = ['<<<', 'LX', '>>>', '>>> 引用'].join('\n');
    const result = parseDraMark(input);

    const cue = result.tree.children[0] as { type: string; value: string };
    const quote = result.tree.children[1] as { type: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('LX');
    expect(quote.type).toBe('blockquote');
  });

  it('supports block-tech-cue header form with <<< as closing marker', () => {
    const input = ['<<< LX', '内容', '<<<'].join('\n');
    const result = parseDraMark(input);
    const cue = result.tree.children[0] as { type: string; value: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('LX\n内容');
  });

  it('prefers >>> as block-tech-cue closer and keeps intermediate <<< as payload', () => {
    const input = ['<<<', '<<<', '>>>'].join('\n');
    const result = parseDraMark(input);
    const cue = result.tree.children[0] as { type: string; value: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('<<<');
  });

  it('closes block-tech-cue when a payload line ends with >>>', () => {
    const input = ['<<<', '灯光 GO>>>', '@A', '台词'].join('\n');
    const result = parseDraMark(input);
    const cue = result.tree.children[0] as { type: string; value: string };
    const character = result.tree.children[1] as { type: string; name: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('灯光 GO');
    expect(character.type).toBe('character-block');
    expect(character.name).toBe('A');
  });

  it('keeps comment markers as literal payload inside block-tech-cue', () => {
    const input = ['<<<', '灯光 % 注', '%%', '注释', '%%', '>>>'].join('\n');
    const result = parseDraMark(input);
    const cue = result.tree.children[0] as { type: string; value: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('灯光 % 注\n%%\n注释\n%%');
  });

  it('keeps inline tech cue marker text literal inside block-tech-cue payload', () => {
    const input = ['<<<', '<<LX01>>', '>>>'].join('\n');
    const result = parseDraMark(input);
    const cue = result.tree.children[0] as { type: string; value: string };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toBe('<<LX01>>');
  });

  it('parses multi-line block-tech-cue payload with normal syntax while keeping raw payload', () => {
    const input = [
      '<<<',
      '@A',
      '= Source',
      '目标',
      '=',
      '% 注释',
      '执行 <<LX01 GO>>',
      '>>>',
    ].join('\n');

    const result = parseDraMark(input, { translationEnabled: true, includeComments: true });
    const cue = result.tree.children[0] as {
      type: string;
      value: string;
      children?: Array<{
        type: string;
        name?: string;
        sourceText?: string;
        children?: Array<{ type: string; value?: string; sourceText?: string; children?: Array<{ type: string; value?: string }> }>;
      }>;
    };

    expect(result.warnings).toHaveLength(0);
    expect(cue.type).toBe('block-tech-cue');
    expect(cue.value).toContain('<<LX01 GO>>');
    expect(cue.children?.[0]?.type).toBe('character-block');

    const character = cue.children?.[0] as {
      type: string;
      children: Array<{ type: string; sourceText?: string; value?: string; children?: Array<{ type: string; value?: string }> }>;
    };
    const translationPair = character.children[0] as { type: string; sourceText?: string };
    const commentLine = character.children[1] as { type: string; value?: string };
    const paragraph = character.children[2] as { type: string; children?: Array<{ type: string; value?: string }> };
    const inlineCue = paragraph.children?.find((node) => node.type === 'inline-tech-cue');

    expect(translationPair.type).toBe('translation-pair');
    expect(translationPair.sourceText).toBe('Source');
    expect(commentLine.type).toBe('comment-line');
    expect(commentLine.value).toBe('注释');
    expect(paragraph.type).toBe('paragraph');
    expect(inlineCue?.value).toBe('LX01 GO');
  });

  it('parses inline-spoken inside song container instead of inline-song', () => {
    const input = ['$$', '@A', '这句 $不应嵌套$ 仍是普通唱段文本', '$$'].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; children: Array<{ type: string; children: unknown[] }> };
    const character = song.children[0];
    const paragraph = character.children[0] as { type: string; children: Array<{ type: string; value?: string }> };

    expect(song.type).toBe('song-container');
    expect(character.type).toBe('character-block');
    expect(paragraph.type).toBe('paragraph');
    // In song context, $...$ becomes inline-spoken, not inline-song
    expect(paragraph.children.some((node) => node.type === 'inline-song')).toBe(false);
    const inlineSpoken = paragraph.children.find((node) => node.type === 'inline-spoken');
    expect(inlineSpoken).toBeDefined();
    expect(inlineSpoken?.value).toBe('不应嵌套');
  });

  // ── v0.4.1: SongBlock title
  it('parses song container with title', () => {
    const input = ['$$ My Shot', '@Alexander Hamilton', 'I am not throwing away my shot', '$$'].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; title?: string; children: unknown[] };

    expect(song.type).toBe('song-container');
    expect(song.title).toBe('My Shot');
    expect(song.children.length).toBe(1);
  });

  it('parses song container without title', () => {
    const input = ['$$', '@Ensemble', 'Some lyrics', '$$'].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; title?: string };

    expect(song.type).toBe('song-container');
    expect(song.title).toBeUndefined();
  });

  // ── v0.4.1: SpokenSegment
  it('parses spoken segment inside song container', () => {
    const input = [
      '$$ Farmer Refuted',
      '@Samuel Seabury',
      'Heed not the rabble',
      '!!',
      '@Alexander Hamilton',
      'What?!',
      '!!',
      '@Samuel Seabury',
      'who scream',
      '$$',
    ].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; children: Array<{ type: string }> };

    expect(song.type).toBe('song-container');
    expect(song.children[0].type).toBe('character-block'); // Samuel Seabury
    expect(song.children[1].type).toBe('spoken-segment'); // !! block
    expect(song.children[2].type).toBe('character-block'); // Samuel Seabury again
  });

  // ── v0.4.1: Inline spoken in song context
  it('parses inline-spoken in song context', () => {
    const input = ['$$ Farmer Refuted', '@Seabury', 'who scream, $"Revolution!"$', '$$'].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; children: Array<{ type: string; children: unknown[] }> };
    const character = song.children[0];
    const paragraph = character.children[0] as { type: string; children: Array<{ type: string; value?: string }> };

    expect(paragraph.type).toBe('paragraph');
    const inlineSpoken = paragraph.children.find((node) => node.type === 'inline-spoken');
    expect(inlineSpoken).toBeDefined();
    expect(inlineSpoken?.value).toBe('"Revolution!"');
  });

  it('parses inline-song in global context (not song)', () => {
    const input = ['@Hamilton', 'I am $not$ throwing away'].join('\n');

    const result = parseDraMark(input);
    const character = result.tree.children[0] as { type: string; children: Array<{ type: string; children: unknown[] }> };
    const paragraph = character.children[0] as { type: string; children: Array<{ type: string; value?: string }> };

    expect(paragraph.type).toBe('paragraph');
    const inlineSong = paragraph.children.find((node) => node.type === 'inline-song');
    expect(inlineSong).toBeDefined();
    expect(inlineSong?.value).toBe('not');
  });

  it('parses inline-song inside spoken segment (spoken segment = global context)', () => {
    const input = ['$$', '!!', '@A', 'say $hello$', '!!', '$$'].join('\n');

    const result = parseDraMark(input);
    const song = result.tree.children[0] as { type: string; children: Array<{ type: string; children: unknown[] }> };
    const spoken = song.children[0] as { type: string; children: Array<{ type: string; children: unknown[] }> };
    const character = spoken.children[0] as { type: string; children: Array<{ type: string; children: Array<{ type: string; value?: string }> }> };
    const paragraph = character.children[0];

    // Inside spoken segment, $...$ should be inline-song (since spoken segment = global context)
    const inlineSong = paragraph.children.find((node) => node.type === 'inline-song');
    expect(inlineSong).toBeDefined();
    expect(inlineSong?.value).toBe('hello');
  });

  it('supports @@ as explicit character exit', () => {
    const input = ['@A', '第一句', '@@', '舞台说明'].join('\n');

    const result = parseDraMark(input);
    const first = result.tree.children[0] as { type: string; children: Array<{ type: string }> };
    const second = result.tree.children[1] as { type: string; children: Array<{ value?: string }> };

    expect(first.type).toBe('character-block');
    expect(first.children[0].type).toBe('paragraph');
    expect(second.type).toBe('paragraph');
    expect(second.children[0].value).toContain('舞台说明');
  });

  it('supports single-line = as explicit translation exit', () => {
    const input = ['@A', '= Source', '目标文本', '=', '退出后对白'].join('\n');

    const result = parseDraMark(input, { translationEnabled: true });
    const character = result.tree.children[0] as {
      type: string;
      children: Array<{ type: string; sourceText?: string; target?: Array<{ type: string }>; children?: Array<{ value?: string }> }>;
    };

    expect(character.type).toBe('character-block');
    expect(character.children[0].type).toBe('translation-pair');
    expect(character.children[1].type).toBe('paragraph');
    expect(character.children[1].children?.[0]?.value).toContain('退出后对白');
  });

  it('emits pass snapshots when multipassDebug is enabled', () => {
    const input = ['---', 'meta:', '  title: Demo', '---', '@A', '台词 <<LX01 GO>>'].join('\n');
    const result = parseDraMark(input, { multipassDebug: true });

    expect(result.metadata.multipassDebug).toBeDefined();
    expect(result.metadata.multipassDebug?.pass0.hasFrontmatter).toBe(true);
    expect(result.metadata.multipassDebug?.pass0.startIndex).toBe(4);
    expect(result.metadata.multipassDebug?.pass1.markedInput).toContain('<<LX01 GO>>');
    expect(result.metadata.multipassDebug?.pass2.segments.map((segment) => segment.kind)).toEqual(['character', 'content']);
    expect(result.metadata.multipassDebug?.pass4.enabled).toBe(true);
    expect(result.metadata.multipassDebug?.pass4.executed).toBe(true);
    expect(result.metadata.multipassDebug?.pass4.restoredNodeCount).toBe(0);
  });

  it('can disable pass4 restore explicitly', () => {
    const input = ['@A', '台词'].join('\n');
    const result = parseDraMark(input, { multipassDebug: true, pass4Restore: false });

    expect(result.metadata.multipassDebug?.pass4.enabled).toBe(false);
    expect(result.metadata.multipassDebug?.pass4.executed).toBe(false);
    expect(result.metadata.multipassDebug?.pass4.restoredNodeCount).toBe(0);
  });

  it('treats fenced code as sanctuary and restores protected literals in pass4', () => {
    const input = ['@A', '```', '<<LX01 GO>>', '@B', '= nested source', '% nested comment', '```', '围栏后对白'].join('\n');
    const result = parseDraMark(input, { multipassDebug: true });

    expect(result.warnings).toHaveLength(0);

    const character = result.tree.children[0] as {
      type: string;
      name: string;
      children: Array<{ type: string; value?: string; children?: Array<{ value?: string }> }>;
    };

    expect(character.type).toBe('character-block');
    expect(character.name).toBe('A');
    expect(character.children.some((node) => node.type === 'translation-pair')).toBe(false);
    expect(character.children.some((node) => node.type === 'comment-line')).toBe(false);

    const code = character.children.find((node) => node.type === 'code') as { type: string; value: string } | undefined;
    expect(code?.value).toBe('<<LX01 GO>>\n@B\n= nested source\n% nested comment');
    expect(result.metadata.multipassDebug?.pass4.restoredNodeCount).toBeGreaterThan(0);
  });

  it('shows placeholder text in fenced code when pass4Restore is disabled', () => {
    const input = ['```', '<<LX01 GO>>', '```'].join('\n');
    const withRestore = parseDraMark(input, { pass4Restore: true });
    const withoutRestore = parseDraMark(input, { pass4Restore: false, multipassDebug: true });

    const codeWithRestore = withRestore.tree.children[0] as { type: string; value: string };
    const codeWithoutRestore = withoutRestore.tree.children[0] as { type: string; value: string };

    expect(codeWithRestore.type).toBe('code');
    expect(codeWithRestore.value).toBe('<<LX01 GO>>');
    expect(codeWithoutRestore.value).not.toBe(codeWithRestore.value);
    expect(withoutRestore.metadata.multipassDebug?.pass4.executed).toBe(false);
  });

  it('does not parse inline tech cue inside inline code sanctuary', () => {
    const input = ['@A', '这是 `<<LX01 GO>>` 的文本'].join('\n');
    const result = parseDraMark(input);

    const character = result.tree.children[0] as {
      type: string;
      children: Array<{ type: string; children: Array<{ type: string; value?: string }> }>;
    };
    const paragraph = character.children[0];

    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children.some((node) => node.type === 'inline-tech-cue')).toBe(false);
    expect(paragraph.children.some((node) => node.type === 'inlineCode')).toBe(true);
  });
});
