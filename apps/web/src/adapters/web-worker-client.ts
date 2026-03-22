import type { DocumentSnapshot, EngineMessage } from '../../../apps/core/index.js';

export type WorkerSnapshotListener = (snapshot: DocumentSnapshot) => void;

export class WebWorkerClient {
  private readonly worker: Worker;
  private readonly listeners = new Set<WorkerSnapshotListener>();
  private snapshotResolvers = new Map<string, (snapshot: DocumentSnapshot) => void>();

  constructor() {
    this.worker = new Worker(new URL('../engine-worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<EngineMessage>) => {
      const msg = event.data;
      if (msg.type === 'snapshot/push') {
        const resolver = this.snapshotResolvers.get(msg.snapshot.uri);
        if (resolver) {
          this.snapshotResolvers.delete(msg.snapshot.uri);
          resolver(msg.snapshot);
        }
        for (const listener of this.listeners) {
          listener(msg.snapshot);
        }
      }
    };
  }

  openDocument(uri: string, sourceText: string): Promise<DocumentSnapshot> {
    return new Promise<DocumentSnapshot>((resolve) => {
      this.snapshotResolvers.set(uri, resolve);
      const msg: EngineMessage = { type: 'document/open', uri, sourceText };
      this.worker.postMessage(msg);
    });
  }

  updateDocument(uri: string, sourceText: string, version?: number): void {
    const msg: EngineMessage = { type: 'document/update', uri, sourceText, version: version ?? 0 };
    this.worker.postMessage(msg);
  }

  closeDocument(uri: string): void {
    const msg: EngineMessage = { type: 'document/close', uri };
    this.worker.postMessage(msg);
  }

  subscribe(listener: WorkerSnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.worker.terminate();
    this.listeners.clear();
    this.snapshotResolvers.clear();
  }
}
