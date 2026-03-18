import { parseDraMark } from '../parser.js';
import type { DraMarkOptions, DraMarkParseResult } from '../types.js';
import { normalizeFrontmatter } from './config-normalizer.js';
import { mapParserWarningsToDiagnostics, mergeDiagnostics } from './diagnostics.js';
import { buildOutline } from './outline.js';
import type { ParseViewModel } from './types.js';

export function createParseViewModel(sourceText: string, options?: DraMarkOptions): ParseViewModel {
  const parseResult = parseDraMark(sourceText, options);
  return toParseViewModel(parseResult);
}

export function toParseViewModel(parseResult: DraMarkParseResult): ParseViewModel {
  const configResult = normalizeFrontmatter(parseResult.metadata.frontmatterRaw);
  const parserDiagnostics = mapParserWarningsToDiagnostics(parseResult.warnings);

  return {
    tree: parseResult.tree,
    warnings: parseResult.warnings,
    metadata: parseResult.metadata,
    config: configResult.config,
    diagnostics: mergeDiagnostics(parserDiagnostics, configResult.diagnostics),
    outline: buildOutline(parseResult.tree.children),
  };
}
