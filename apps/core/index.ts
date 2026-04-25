export { DocumentEngine } from './document-engine.js';
export type { DocumentEngineOptions, SnapshotListener } from './document-engine.js';

export { SnapshotCache, DebounceScheduler } from './snapshot-cache.js';
export { buildDiagnosticsReport } from './diagnostics-pipeline.js';
export type { DiagnosticsReport } from './diagnostics-pipeline.js';

export { resolveCompletionContext, collectCompletions } from './completions.js';
export type { CompletionItem, CompletionContext } from './completions.js';

export { resolveFrontmatterPosition, getFrontmatterCompletions } from './frontmatter-completions.js';
export type { FrontmatterPositionContext, FrontmatterCompletionItem } from './frontmatter-completions.js';

export type { DocumentSnapshot, EngineMessage } from './protocol.js';
export { buildStandaloneExportHtml } from './export-standalone-html.js';
export { renderStandalone } from './standalone-runtime.js';

// Render module
export * from './render/index.js';

// Components module
export * from './components/index.js';
