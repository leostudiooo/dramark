import { createParseViewModel } from '../../src/core/index.js';
import type { DraMarkOptions } from '../../src/types.js';
import type { DocumentSnapshot } from './protocol.js';
import { SnapshotCache, DebounceScheduler } from './snapshot-cache.js';

export type SnapshotListener = (snapshot: DocumentSnapshot) => void;

export interface DocumentEngineOptions {
  debounceMs?: number;
  parserOptions?: DraMarkOptions;
}

export class DocumentEngine {
  private readonly cache = new SnapshotCache();
  private readonly scheduler = new DebounceScheduler();
  private readonly listeners = new Set<SnapshotListener>();
  private readonly debounceMs: number;
  private readonly parserOptions: DraMarkOptions | undefined;
  private versionCounter = 0;

  constructor(options?: DocumentEngineOptions) {
    this.debounceMs = options?.debounceMs ?? 180;
    this.parserOptions = options?.parserOptions;
  }

  openDocument(uri: string, sourceText: string): void {
    this.versionCounter += 1;
    const version = this.versionCounter;
    this.parseNow(uri, sourceText, version);
  }

  updateDocument(uri: string, sourceText: string, version?: number): void {
    const v = version ?? ++this.versionCounter;
    if (this.debounceMs <= 0) {
      this.parseNow(uri, sourceText, v);
    } else {
      this.scheduler.schedule(uri, v, this.debounceMs, () => {
        this.parseNow(uri, sourceText, v);
      });
    }
  }

  closeDocument(uri: string): void {
    this.scheduler.cancel(uri);
    this.cache.delete(uri);
  }

  getSnapshot(uri: string): DocumentSnapshot | undefined {
    return this.cache.get(uri);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.scheduler.dispose();
    this.listeners.clear();
  }

  private parseNow(uri: string, sourceText: string, version: number): void {
    const start = performance.now();
    const viewModel = createParseViewModel(sourceText, this.parserOptions);
    const elapsedMs = performance.now() - start;

    const snapshot: DocumentSnapshot = {
      uri,
      version,
      sourceText,
      viewModel,
      generatedAt: Date.now(),
      elapsedMs,
    };

    this.cache.set(uri, snapshot);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
