import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { warningToError } from './errors.js';
import { parseDraMark } from './parser.js';
import type { DraMarkOptions } from './types.js';

export type { DraMarkOptions, DraMarkParseResult, DraMarkWarning } from './types.js';
export { DraMarkParseError } from './errors.js';
export { parseDraMark } from './parser.js';

const remarkDraMark: Plugin<[DraMarkOptions?], Root> = (options?: DraMarkOptions) => {
  return (tree, file): void => {
    const input = typeof file.value === 'string' ? file.value : String(file.value ?? '');
    const result = parseDraMark(input, options);

    file.data.dramark = {
      warnings: result.warnings,
      metadata: result.metadata,
    };

    if (options?.strictMode && result.warnings.length > 0) {
      throw warningToError(result.warnings[0]);
    }

    tree.children = result.tree.children;
  };
};

export default remarkDraMark;