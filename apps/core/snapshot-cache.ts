import type { DocumentSnapshot } from './protocol.js';

export class SnapshotCache {
  private cache = new Map<string, DocumentSnapshot>();

  get(uri: string): DocumentSnapshot | undefined {
    return this.cache.get(uri);
  }

  set(uri: string, snapshot: DocumentSnapshot): void {
    this.cache.set(uri, snapshot);
  }

  delete(uri: string): void {
    this.cache.delete(uri);
  }

  has(uri: string): boolean {
    return this.cache.has(uri);
  }
}

export class DebounceScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingVersions = new Map<string, number>();

  schedule(uri: string, version: number, delayMs: number, callback: () => void): void {
    this.cancel(uri);
    this.pendingVersions.set(uri, version);
    const timer = setTimeout(() => {
      this.timers.delete(uri);
      this.pendingVersions.delete(uri);
      callback();
    }, delayMs);
    this.timers.set(uri, timer);
  }

  cancel(uri: string): void {
    const timer = this.timers.get(uri);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(uri);
      this.pendingVersions.delete(uri);
    }
  }

  pendingVersion(uri: string): number | undefined {
    return this.pendingVersions.get(uri);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pendingVersions.clear();
  }
}
