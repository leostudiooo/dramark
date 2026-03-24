import type { TechConfig } from '../../src/core/types.js';
import {
  buildColumnarLayout,
  convertAstToRenderBlocks,
} from './render/ast-to-blocks.js';
import { buildTechCueColorMap } from './render/tech-cue-colors.js';
import { createPreviewHTML } from './components/Preview.js';
import { defaultTheme } from './render/default-theme.js';
import { generateCSS } from './render/css.js';
import type { PreviewConfig } from './render/types.js';

export function renderStandalone(
  ast: unknown,
  config: PreviewConfig,
  techConfig: TechConfig | undefined
): { previewHTML: string; css: string; layout: ReturnType<typeof buildColumnarLayout> } {
  const normalizedTechConfig: TechConfig = techConfig ?? { mics: [] };
  const techColorMap = buildTechCueColorMap(normalizedTechConfig);
  const context = {
    ast,
    techConfig: normalizedTechConfig,
    config,
    theme: defaultTheme,
    techColorMap,
  };

  const blocks = convertAstToRenderBlocks(context);
  const layout = buildColumnarLayout(blocks, context);
  const previewHTML = createPreviewHTML({ layout, config });
  const css = generateCSS(defaultTheme, config);

  return { previewHTML, css, layout };
}
