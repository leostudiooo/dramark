import type { DraMarkParseResult, DraMarkRoot, DraMarkWarning } from '../types.js';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DiagnosticSource = 'parser' | 'config';

export interface CoreDiagnostic {
  source: DiagnosticSource;
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  line?: number;
  column?: number;
  path?: string;
}

export interface CastingCharacter {
  name: string;
  id?: string;
  actor?: string;
  mic?: string;
  aliases?: string[];
  [key: string]: unknown;
}

export interface CastingGroup {
  members: string[];
  [key: string]: unknown;
}

export interface CastingConfig {
  characters: CastingCharacter[];
  groups: Record<string, CastingGroup>;
  [key: string]: unknown;
}

export interface TranslationConfig {
  enabled?: boolean;
  source_lang?: string;
  target_lang?: string;
  render?: string;
  [key: string]: unknown;
}

export interface TechEntry {
  id: string;
  [key: string]: unknown;
}

export interface TechKeywordEntry {
  token: string;
  label: string;
  [key: string]: unknown;
}

export interface TechConfig {
  mics: TechEntry[];
  sfx: TechEntry[];
  lx: TechEntry[];
  keywords: TechKeywordEntry[];
  [key: string]: unknown;
}

export interface DocumentConfig {
  meta?: Record<string, unknown>;
  casting?: CastingConfig;
  translation?: TranslationConfig;
  tech?: TechConfig;
  extras: Record<string, unknown>;
}

export interface NormalizationResult {
  config: DocumentConfig;
  diagnostics: CoreDiagnostic[];
}

export interface OutlineItem {
  kind: 'heading' | 'character' | 'song-container' | 'thematic-break';
  label: string;
  depth?: number;
}

export interface ParseViewModel {
  tree: DraMarkRoot;
  warnings: DraMarkWarning[];
  metadata: DraMarkParseResult['metadata'];
  config: DocumentConfig;
  diagnostics: CoreDiagnostic[];
  outline: OutlineItem[];
}
