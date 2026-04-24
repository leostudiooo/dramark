import { describe, expect, it } from 'vitest';
import { buildOutline, createParseViewModel, mapParserWarningsToDiagnostics, normalizeFrontmatter } from '../core/index.js';
import { parseDraMark } from '../parser.js';
import {
  buildColumnarLayout,
  buildTechCueColorMap,
  buildStandaloneExportHtml,
  convertAstToRenderBlocks,
  defaultTheme,
  generateCSS,
} from '../../apps/core/index.js';

describe('core/normalizeFrontmatter', () => {
  it('normalizes known namespaces and preserves unknown keys in extras', () => {
    const raw = [
      'meta:',
      '  title: Demo',
      'casting:',
      '  characters:',
      '    - name: Hamlet',
      'translation:',
      '  enabled: true',
      'custom:',
      '  keep: yes',
    ].join('\n');

    const result = normalizeFrontmatter(raw);

    expect(result.diagnostics).toHaveLength(0);
    expect(result.config.meta?.title).toBe('Demo');
    expect(result.config.casting?.characters[0].name).toBe('Hamlet');
    expect(result.config.translation?.enabled).toBe(true);
    expect(result.config.extras.custom).toEqual({ keep: 'yes' });
  });

  it('reports type mismatches as non-fatal diagnostics', () => {
    const raw = [
      'translation:',
      '  enabled: "yes"',
      'casting:',
      '  characters: {}',
      'tech:',
      '  mics: {}',
    ].join('\n');

    const result = normalizeFrontmatter(raw);
    const codes = result.diagnostics.map((item) => item.code);

    expect(codes).toContain('CONFIG_TRANSLATION_ENABLED_TYPE');
    expect(codes).toContain('CONFIG_CASTING_CHARACTERS_TYPE');
    expect(codes).toContain('CONFIG_TECH_MICS_TYPE');
  });

  it('warns on duplicate tech ids while keeping parse successful', () => {
    const raw = [
      'tech:',
      '  mics:',
      '    - id: HM1',
      '      label: A',
      '    - id: HM1',
      '      label: B',
    ].join('\n');

    const result = normalizeFrontmatter(raw);
    const duplicate = result.diagnostics.find((item) => item.code === 'CONFIG_TECH_MICS_DUPLICATE_ID');

    expect(duplicate).toBeDefined();
    expect(result.config.tech?.mics).toHaveLength(1);
    expect(result.config.tech?.mics[0].id).toBe('HM1');
  });
});

describe('core/diagnostics and view-model', () => {
  it('maps parser warnings to core diagnostics', () => {
    const parsed = parseDraMark('= orphan translation line', { translationEnabled: true });
    const diagnostics = mapParserWarningsToDiagnostics(parsed.warnings);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].source).toBe('parser');
    expect(diagnostics[0].code).toBe('TRANSLATION_OUTSIDE_CHARACTER');
    expect(diagnostics[0].line).toBe(1);
  });

  it('creates parse view model with merged parser/config diagnostics', () => {
    const input = [
      '---',
      'translation:',
      '  enabled: "yes"',
      '---',
      '= orphan translation line',
    ].join('\n');

    const vm = createParseViewModel(input);
    const codes = vm.diagnostics.map((item) => item.code);

    expect(codes).toContain('TRANSLATION_OUTSIDE_CHARACTER');
    expect(codes).toContain('CONFIG_TRANSLATION_ENABLED_TYPE');
  });
});

describe('core/buildOutline', () => {
  it('extracts heading/character/song/thematic-break entries', () => {
    const input = ['# 第一幕', '@哈姆雷特', '生存还是毁灭', '$$', '@奥菲莉娅', '唱词', '$$', '---'].join('\n');
    const parsed = parseDraMark(input);
    const outline = buildOutline(parsed.tree.children);

    expect(outline.map((item) => item.kind)).toEqual([
      'heading',
      'character',
      'song-container',
      'character',
      'thematic-break',
    ]);
    expect(outline[0].label).toBe('第一幕');
    expect(outline[1].label).toBe('哈姆雷特');
    expect(outline[3].label).toBe('奥菲莉娅');
  });
});

describe('render/comment layout', () => {
  it('keeps song character comments in right column without dropping dialogue', () => {
    const input = ['$$', '@A', '唱词主体 % 注释文本', '$$'].join('\n');
    const parsed = parseDraMark(input, { includeComments: true });
    const context = {
      ast: parsed.tree,
      techConfig: { mics: [] },
      config: {
        showTechCues: true,
        showComments: true,
        translationMode: 'bilingual' as const,
        translationLayout: 'side-by-side' as const,
        theme: 'light' as const,
      },
      theme: defaultTheme,
      techColorMap: buildTechCueColorMap({ mics: [] }),
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);

    expect(layout.center.some((block) => block.type === 'song-container')).toBe(true);
    expect(layout.right.some((block) => block.type === 'comment' && block.content.includes('注释文本'))).toBe(true);
    expect(layout.rows.some((row) => row.center?.type === 'song-container' && row.right?.type === 'comment')).toBe(true);
  });

  it('hides comment column content when showComments=false but keeps center content', () => {
    const input = ['$$', '@A', '唱词主体 % 注释文本', '$$'].join('\n');
    const parsed = parseDraMark(input, { includeComments: true });
    const context = {
      ast: parsed.tree,
      techConfig: { mics: [] },
      config: {
        showTechCues: true,
        showComments: false,
        translationMode: 'bilingual' as const,
        translationLayout: 'side-by-side' as const,
        theme: 'light' as const,
      },
      theme: defaultTheme,
      techColorMap: buildTechCueColorMap({ mics: [] }),
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);

    expect(layout.center.some((block) => block.type === 'song-container')).toBe(true);
    expect(layout.right).toHaveLength(0);
  });
});

describe('buildStandaloneExportHtml', () => {
  const defaultParams = {
    astJson: '{}',
    techConfigJson: '{"mics":[]}',
    initialConfigJson: '{"theme":"print"}',
    initialTheme: 'print',
    previewCss: '/* test css */',
    overrideCss: '/* override css */',
    rendererJs: 'globalThis.DraMarkRenderer={render:function(){}};',
    config: {
      showTechCues: true,
      showComments: true,
      translationMode: 'bilingual' as const,
      translationLayout: 'side-by-side' as const,
      theme: 'print' as const,
    },
    configOpen: false,
  };

  it('produces valid HTML with DOCTYPE, charset, and embedded data', () => {
    const html = buildStandaloneExportHtml(defaultParams);

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('id="dramark-preview-css"');
    expect(html).toContain('globalThis.DraMarkRenderer');
    expect(html).toContain('"theme":"print"');
  });

  it('embeds preview CSS and override CSS in separate style blocks', () => {
    const html = buildStandaloneExportHtml(defaultParams);

    expect(html).toContain('/* test css */');
    expect(html).toContain('/* override css */');
    expect(html).toContain('id="configTrigger"');
    expect(html).toContain('Print / Save PDF');
  });
});

describe('generateCSS print theme', () => {
  it('includes print-specific CSS variables and @media print rules', () => {
    const css = generateCSS(defaultTheme, {
      showTechCues: true,
      showComments: true,
      translationMode: 'bilingual',
      translationLayout: 'side-by-side',
      theme: 'print',
    });

    expect(css).toContain('--dm-print-border-sung:');
    expect(css).toContain('--dm-print-border-spoken:');
    expect(css).toContain('--dm-print-tech-bg:');
    expect(css).toContain('--dm-print-tech-header:');
    expect(css).toContain('@media print');
    expect(css).toContain('print-color-adjust: exact');
    expect(css).toContain('var(--dm-print-tech-bg)');
    expect(css).toContain('var(--dm-print-tech-header)');
  });

  it('does not include print variables for non-print themes', () => {
    const css = generateCSS(defaultTheme, {
      showTechCues: true,
      showComments: true,
      translationMode: 'bilingual',
      translationLayout: 'side-by-side',
      theme: 'light',
    });

    expect(css).not.toContain('--dm-print-border-sung:');
    expect(css).not.toContain('@media print');
  });
});
