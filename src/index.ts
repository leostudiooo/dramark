import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { warningToError } from './errors.js';
import { registerDraMarkParseExtensions } from './m2-extensions.js';
import { parseDraMark } from './parser.js';
import type { DraMarkOptions } from './types.js';

export type { DraMarkOptions, DraMarkParseResult, DraMarkWarning } from './types.js';
export { DraMarkParseError } from './errors.js';
export { parseDraMark } from './parser.js';
export * from './core/index.js';

export interface RemarkDraMarkPluginOptions extends DraMarkOptions {}

const remarkDraMark: Plugin<[RemarkDraMarkPluginOptions?], Root> = function remarkDraMark(options?: RemarkDraMarkPluginOptions) {
  registerDraMarkParseExtensions(this);
  return (_tree, file): void => {
    const input = typeof file.value === 'string' ? file.value : String(file.value ?? '');
    // Intentional multipass architecture (3-4 passes):
    // 1) micromark marking pass (inline lexical precedence, e.g. <<...>>)
    // 2) DraMark marking/protection/structure parse
    // 3) micromark parse pass (CommonMark/mdast materialization)
    // 4) DraMark restore/de-protect pass when placeholders are used
    //
    // In current unified runtime, some phases are partially collapsed, but
    // this plugin must preserve the multipass contract and not regress to a
    // naive single-pass flow.
    const result = parseDraMark(input, options);

    file.data.dramark = {
      warnings: result.warnings,
      metadata: result.metadata,
      multipassDebug: result.metadata.multipassDebug,
      parserMode: 'micromark',
      integrationMode: 'micromark-only',
      multipass: true,
    };

    if (options?.strictMode && result.warnings.length > 0) {
      throw warningToError(result.warnings[0]);
    }
  };
};

export default remarkDraMark;