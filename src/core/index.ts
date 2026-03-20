export type {
  CastingCharacter,
  CastingConfig,
  CastingGroup,
  CoreDiagnostic,
  DiagnosticSeverity,
  DocumentConfig,
  NormalizationResult,
  OutlineItem,
  ParseViewModel,
  TechCategory,
  TechConfig,
  TechEntry,
  TechKeywordEntry,
  TranslationConfig,
} from './types.js';

export { normalizeFrontmatter } from './config-normalizer.js';
export { mapParserWarningsToDiagnostics, mergeDiagnostics } from './diagnostics.js';
export { buildOutline } from './outline.js';
export { createParseViewModel, toParseViewModel } from './view-model.js';
