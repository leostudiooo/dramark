import type { ParseViewModel } from '../../src/core/index.js';

export interface DocumentSnapshot {
  uri: string;
  version: number;
  sourceText: string;
  viewModel: ParseViewModel;
  generatedAt: number;
  elapsedMs: number;
}

export type EngineMessage =
  | { type: 'document/open'; uri: string; sourceText: string }
  | { type: 'document/update'; uri: string; version: number; sourceText: string }
  | { type: 'document/close'; uri: string }
  | { type: 'snapshot/push'; snapshot: DocumentSnapshot }
  | { type: 'engine/error'; uri: string; message: string };
