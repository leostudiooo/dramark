import type { ParseViewModel, DocumentConfig } from '../../src/core/index.js';
import type { DraMarkRootContent, CharacterBlock } from '../../src/types.js';

export interface CompletionItem {
  label: string;
  detail?: string;
  insertText: string;
  kind: 'character' | 'tech-cue' | 'snippet';
}

export interface CompletionContext {
  trigger: '@' | '<<' | 'none';
  partialText: string;
}

export function resolveCompletionContext(linePrefix: string): CompletionContext {
  const atMatch = linePrefix.match(/@([^\s]*)$/);
  if (atMatch) {
    return { trigger: '@', partialText: atMatch[1] };
  }

  const cueMatch = linePrefix.match(/<<([^>]*)$/);
  if (cueMatch) {
    return { trigger: '<<', partialText: cueMatch[1] };
  }

  return { trigger: 'none', partialText: '' };
}

export function collectCompletions(
  viewModel: ParseViewModel,
  context: CompletionContext,
): CompletionItem[] {
  if (context.trigger === 'none') {
    return [];
  }

  if (context.trigger === '@') {
    return collectCharacterCompletions(viewModel, context.partialText);
  }

  return collectTechCueCompletions(viewModel.config, context.partialText);
}

function collectCharacterCompletions(
  viewModel: ParseViewModel,
  partial: string,
): CompletionItem[] {
  const names = new Map<string, string>();

  const casting = viewModel.config.casting;
  if (casting) {
    for (const ch of casting.characters) {
      names.set(ch.name, ch.name);
      if (ch.aliases) {
        for (const alias of ch.aliases) {
          if (!names.has(alias)) {
            names.set(alias, ch.name);
          }
        }
      }
    }
  }

  collectCharacterNamesFromTree(viewModel.tree.children, names);

  const lowerPartial = partial.toLowerCase();
  const items: CompletionItem[] = [];

  for (const [name, primaryName] of names) {
    if (partial && !name.toLowerCase().startsWith(lowerPartial)) {
      continue;
    }
    const detail = name !== primaryName ? `alias of ${primaryName}` : undefined;
    items.push({ label: name, detail, insertText: name, kind: 'character' });
  }

  return items;
}

function collectCharacterNamesFromTree(
  nodes: DraMarkRootContent[],
  names: Map<string, string>,
): void {
  for (const node of nodes) {
    if (node.type === 'character-block') {
      const cb = node as CharacterBlock;
      if (!names.has(cb.name)) {
        names.set(cb.name, cb.name);
      }
      for (const alt of cb.names) {
        if (!names.has(alt)) {
          names.set(alt, cb.name);
        }
      }
    }
    if ('children' in node && Array.isArray((node as { children?: unknown }).children)) {
      collectCharacterNamesFromTree((node as { children: DraMarkRootContent[] }).children, names);
    }
  }
}

function collectTechCueCompletions(
  config: DocumentConfig,
  partial: string,
): CompletionItem[] {
  const items: CompletionItem[] = [];
  const tech = config.tech;
  if (!tech) {
    return items;
  }

  const lowerPartial = partial.toLowerCase();

  const addEntries = (entries: { id: string; [key: string]: unknown }[], category: string): void => {
    for (const entry of entries) {
      if (partial && !entry.id.toLowerCase().startsWith(lowerPartial)) {
        continue;
      }
      const detail = String(entry.label ?? category);
      items.push({ label: entry.id, detail, insertText: entry.id, kind: 'tech-cue' });
    }
  };

  addEntries(tech.mics, 'mic');
  addEntries(tech.sfx, 'sfx');
  addEntries(tech.lx, 'lx');

  return items;
}
