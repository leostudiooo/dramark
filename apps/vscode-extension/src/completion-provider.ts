import * as vscode from 'vscode';
import { resolveCompletionContext, collectCompletions } from '../../../apps/core/index.js';
import type { CompletionItem as DraCompletionItem } from '../../../apps/core/index.js';
import type { DocumentController } from './document-controller.js';

const COMPLETION_KIND_MAP: Record<string, vscode.CompletionItemKind> = {
  character: vscode.CompletionItemKind.User,
  'tech-cue': vscode.CompletionItemKind.Value,
  snippet: vscode.CompletionItemKind.Snippet,
};

type FrontmatterCompletionSpec = {
  label: string;
  detail: string;
  insertText: string;
};

const FRONTMATTER_ROOT_KEYS: FrontmatterCompletionSpec[] = [
  {
    label: 'meta',
    detail: 'Document metadata',
    insertText: 'meta:',
  },
  {
    label: 'casting',
    detail: 'Character and group configuration',
    insertText: 'casting:',
  },
  {
    label: 'translation',
    detail: 'Translation configuration',
    insertText: 'translation:',
  },
  {
    label: 'tech',
    detail: 'Technical resources dictionary',
    insertText: 'tech:',
  },
  {
    label: 'use_frontmatter_from',
    detail: 'Load external frontmatter baseline',
    insertText: 'use_frontmatter_from: ',
  },
];

const FRONTMATTER_CHILD_KEYS: Record<string, FrontmatterCompletionSpec[]> = {
  meta: [
    {
      label: 'title',
      detail: 'Document title',
      insertText: 'title: ',
    },
    {
      label: 'author',
      detail: 'Author name',
      insertText: 'author: ',
    },
    {
      label: 'locale',
      detail: 'Locale, e.g. zh-CN',
      insertText: 'locale: ',
    },
    {
      label: 'version',
      detail: 'Document version',
      insertText: 'version: ',
    },
  ],
  casting: [
    {
      label: 'characters',
      detail: 'Character definitions',
      insertText: 'characters:',
    },
    {
      label: 'groups',
      detail: 'Character groups',
      insertText: 'groups:',
    },
  ],
  translation: [
    {
      label: 'enabled',
      detail: 'Enable translation mode',
      insertText: 'enabled: ',
    },
    {
      label: 'source_lang',
      detail: 'Source language',
      insertText: 'source_lang: ',
    },
    {
      label: 'target_lang',
      detail: 'Target language',
      insertText: 'target_lang: ',
    },
    {
      label: 'render_mode',
      detail: 'Rendering mode',
      insertText: 'render_mode: ',
    },
  ],
  tech: [
    {
      label: 'mics',
      detail: 'Microphone resources',
      insertText: 'mics:',
    },
    {
      label: 'sfx',
      detail: 'SFX resources',
      insertText: 'sfx:',
    },
    {
      label: 'lx',
      detail: 'Lighting resources',
      insertText: 'lx:',
    },
    {
      label: 'keywords',
      detail: 'Tech keyword dictionary',
      insertText: 'keywords:',
    },
  ],
  characters: [
    {
      label: 'name',
      detail: 'Character display name',
      insertText: 'name: ',
    },
    {
      label: 'id',
      detail: 'Optional unique id for disambiguation',
      insertText: 'id: ',
    },
    {
      label: 'actor',
      detail: 'Actor name',
      insertText: 'actor: ',
    },
    {
      label: 'mic',
      detail: 'Default microphone id',
      insertText: 'mic: ',
    },
    {
      label: 'aliases',
      detail: 'Alternative names',
      insertText: 'aliases: []',
    },
  ],
  mics: [
    {
      label: 'id',
      detail: 'Mic id',
      insertText: 'id: ',
    },
    {
      label: 'label',
      detail: 'Display label',
      insertText: 'label: ',
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: 'color: ',
    },
  ],
  sfx: [
    {
      label: 'id',
      detail: 'SFX id',
      insertText: 'id: ',
    },
    {
      label: 'file',
      detail: 'Audio file path',
      insertText: 'file: ',
    },
    {
      label: 'desc',
      detail: 'Description',
      insertText: 'desc: ',
    },
  ],
  lx: [
    {
      label: 'id',
      detail: 'Lighting id',
      insertText: 'id: ',
    },
    {
      label: 'desc',
      detail: 'Description',
      insertText: 'desc: ',
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: 'color: ',
    },
  ],
  keywords: [
    {
      label: 'token',
      detail: 'Keyword token',
      insertText: 'token: ',
    },
    {
      label: 'label',
      detail: 'Display label',
      insertText: 'label: ',
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: 'color: ',
    },
  ],
};

export class DraMarkCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private controller: DocumentController) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    if (isInsideFrontmatter(document, position)) {
      return undefined;
    }

    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    if (!linePrefix.includes('@') && !linePrefix.includes('<')) {
      return undefined;
    }

    const viewModel = this.controller.getViewModel(document.uri.toString());
    if (!viewModel) {
      return undefined;
    }

    const context = resolveCompletionContext(linePrefix);

    if (context.trigger === 'none') {
      return undefined;
    }

    const items = collectCompletions(viewModel, context);
    return items.map((item) => toVscodeCompletion(item, context, position, linePrefix));
  }
}

function toVscodeCompletion(
  item: DraCompletionItem,
  context: ReturnType<typeof resolveCompletionContext>,
  position: vscode.Position,
  linePrefix: string,
): vscode.CompletionItem {
  const completion = new vscode.CompletionItem(item.label, COMPLETION_KIND_MAP[item.kind]);
  completion.detail = item.detail;
  completion.insertText = item.insertText;

  if (context.trigger === '@') {
    const atIdx = linePrefix.lastIndexOf('@');
    const startPos = new vscode.Position(position.line, atIdx + 1);
    completion.range = new vscode.Range(startPos, position);
  } else if (context.trigger === '<<') {
    const cueIdx = linePrefix.lastIndexOf('<<');
    const startPos = new vscode.Position(position.line, cueIdx + 2);
    completion.range = new vscode.Range(startPos, position);
  }

  return completion;
}

function isInsideFrontmatter(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  const range = getFrontmatterRange(document);
  if (!range) {
    return false;
  }

  return position.line > range.startLine && position.line < range.endLine;
}

function getFrontmatterRange(
  document: vscode.TextDocument,
): { startLine: number; endLine: number } | null {
  if (document.lineCount < 3 || document.lineAt(0).text.trim() !== '---') {
    return null;
  }

  for (let i = 1; i < document.lineCount; i += 1) {
    if (document.lineAt(i).text.trim() === '---') {
      return { startLine: 0, endLine: i };
    }
  }

  return null;
}
