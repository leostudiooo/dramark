import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { warningToError } from './errors.js';
import { transformInlineMarkersInTree } from './inline-markers.js';
import { registerDraMarkParseExtensions } from './m2-extensions.js';
import { parseDraMark } from './parser.js';
import type { DraMarkOptions } from './types.js';

export type { DraMarkOptions, DraMarkParseResult, DraMarkWarning } from './types.js';
export { DraMarkParseError } from './errors.js';
export { parseDraMark } from './parser.js';

export interface RemarkDraMarkPluginOptions extends DraMarkOptions {
  parserMode?: 'legacy' | 'micromark';
}

const remarkDraMark: Plugin<[RemarkDraMarkPluginOptions?], Root> = function remarkDraMark(options?: RemarkDraMarkPluginOptions) {
  const parserMode = options?.parserMode ?? 'legacy';

  if (parserMode === 'micromark') {
    registerDraMarkParseExtensions(this);
    return (tree, file): void => {
      // Transitional fallback while block-level micromark constructs are phased in.
      transformInlineMarkersInTree(tree);
      file.data.dramark = {
        warnings: [],
        metadata: {
          translationEnabledFromFrontmatter: false,
        },
        parserMode,
      };
    };
  }

  return (tree, file): void => {
    const input = typeof file.value === 'string' ? file.value : String(file.value ?? '');
    const result = parseDraMark(input, options);

    file.data.dramark = {
      warnings: result.warnings,
      metadata: result.metadata,
      parserMode,
    };

    if (options?.strictMode && result.warnings.length > 0) {
      throw warningToError(result.warnings[0]);
    }

    tree.children = result.tree.children;
  };
};

export default remarkDraMark;