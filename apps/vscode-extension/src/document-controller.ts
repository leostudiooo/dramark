import type { ParseViewModel } from '../../../src/core/index.js';
import type { DocumentEngine } from '../../../packages/app-core/index.js';

export type SnapshotListener = (uri: string, viewModel: ParseViewModel) => void;

export class DocumentController {
  private models = new Map<string, ParseViewModel>();
  private listeners = new Set<SnapshotListener>();

  constructor(private engine: DocumentEngine) {}

  openDocument(uri: string, text: string): void {
    this.engine.openDocument(uri, text);
    const snapshot = this.engine.getSnapshot(uri);
    if (snapshot) {
      this.models.set(uri, snapshot.viewModel);
    }
  }

  updateDocument(uri: string, text: string): void {
    this.engine.updateDocument(uri, text);
  }

  closeDocument(uri: string): void {
    this.engine.closeDocument(uri);
    this.models.delete(uri);
  }

  getViewModel(uri: string): ParseViewModel | undefined {
    const snapshot = this.engine.getSnapshot(uri);
    return snapshot?.viewModel;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  onSnapshot(uri: string, viewModel: ParseViewModel): void {
    this.models.set(uri, viewModel);
    for (const listener of this.listeners) {
      listener(uri, viewModel);
    }
  }
}
