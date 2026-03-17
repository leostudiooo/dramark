import type { Extension as MicromarkExtension } from 'micromark-util-types';
import type { Processor } from 'unified';
import { transformInlineMarkersInTree } from './inline-markers.js';

type FromMarkdownExtensionLike = {
  transforms?: Array<(tree: unknown) => unknown>;
};

// M2 step 1: wire plugin into remark-parse extension points first.
const draMarkMicromarkExtension: MicromarkExtension = {};

const draMarkFromMarkdownExtension: FromMarkdownExtensionLike = {
  transforms: [
    (tree: unknown) => {
      transformInlineMarkersInTree(tree);
      return tree;
    },
  ],
};

export function registerDraMarkParseExtensions(processor: Processor): void {
  const data = processor.data() as Record<string, unknown>;
  appendExtension(data, 'micromarkExtensions', draMarkMicromarkExtension);
  appendExtension(data, 'fromMarkdownExtensions', draMarkFromMarkdownExtension);
}

function appendExtension<T>(data: Record<string, unknown>, key: string, extension: T): void {
  const existing = Array.isArray(data[key]) ? (data[key] as T[]) : [];
  if (!existing.includes(extension)) {
    existing.push(extension);
  }
  data[key] = existing;
}