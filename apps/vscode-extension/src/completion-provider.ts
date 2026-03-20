import * as vscode from 'vscode';
import { resolveCompletionContext, collectCompletions } from '../../../packages/app-core/index.js';
import type { CompletionItem as DraCompletionItem } from '../../../packages/app-core/index.js';
import type { DocumentController } from './document-controller.js';

const COMPLETION_KIND_MAP: Record<string, vscode.CompletionItemKind> = {
  character: vscode.CompletionItemKind.User,
  'tech-cue': vscode.CompletionItemKind.Value,
  snippet: vscode.CompletionItemKind.Snippet,
};

type FrontmatterCompletionSpec = {
  label: string;
  detail: string;
  insertText: vscode.SnippetString;
};

const FRONTMATTER_ROOT_KEYS: FrontmatterCompletionSpec[] = [
  {
    label: 'meta',
    detail: 'Document metadata',
    insertText: new vscode.SnippetString('meta:\n  $0'),
  },
  {
    label: 'casting',
    detail: 'Character and group configuration',
    insertText: new vscode.SnippetString('casting:\n  $0'),
  },
  {
    label: 'translation',
    detail: 'Translation configuration',
    insertText: new vscode.SnippetString('translation:\n  $0'),
  },
  {
    label: 'tech',
    detail: 'Technical resources dictionary',
    insertText: new vscode.SnippetString('tech:\n  $0'),
  },
  {
    label: 'use_frontmatter_from',
    detail: 'Load external frontmatter baseline',
    insertText: new vscode.SnippetString('use_frontmatter_from: ${1:https://example.com/frontmatter.yaml}'),
  },
];

const FRONTMATTER_CHILD_KEYS: Record<string, FrontmatterCompletionSpec[]> = {
  meta: [
    {
      label: 'title',
      detail: 'Document title',
      insertText: new vscode.SnippetString('title: ${1:Title}'),
    },
    {
      label: 'author',
      detail: 'Author name',
      insertText: new vscode.SnippetString('author: ${1:Author Name}'),
    },
    {
      label: 'locale',
      detail: 'Locale, e.g. zh-CN',
      insertText: new vscode.SnippetString('locale: ${1:zh-CN}'),
    },
    {
      label: 'version',
      detail: 'Document version',
      insertText: new vscode.SnippetString('version: ${1:0.4.1}'),
    },
  ],
  casting: [
    {
      label: 'characters',
      detail: 'Character definitions',
      insertText: new vscode.SnippetString('characters:\n  - name: ${1:Character Name}'),
    },
    {
      label: 'groups',
      detail: 'Character groups',
      insertText: new vscode.SnippetString('groups:\n  ${1:ensemble}:\n    members: [${2:Character Name}]'),
    },
  ],
  translation: [
    {
      label: 'enabled',
      detail: 'Enable translation mode',
      insertText: new vscode.SnippetString('enabled: ${1|true,false|}'),
    },
    {
      label: 'source_lang',
      detail: 'Source language',
      insertText: new vscode.SnippetString('source_lang: ${1:en}'),
    },
    {
      label: 'target_lang',
      detail: 'Target language',
      insertText: new vscode.SnippetString('target_lang: ${1:zh-CN}'),
    },
    {
      label: 'render_mode',
      detail: 'Rendering mode',
      insertText: new vscode.SnippetString('render_mode: ${1|bilingual,source-only,target-only|}'),
    },
  ],
  tech: [
    {
      label: 'mics',
      detail: 'Microphone resources',
      insertText: new vscode.SnippetString('mics:\n  - id: ${1:HM1}'),
    },
    {
      label: 'sfx',
      detail: 'SFX resources',
      insertText: new vscode.SnippetString('sfx:\n  - id: ${1:SFX_ID}'),
    },
    {
      label: 'lx',
      detail: 'Lighting resources',
      insertText: new vscode.SnippetString('lx:\n  - id: ${1:LX01}'),
    },
    {
      label: 'keywords',
      detail: 'Tech keyword dictionary',
      insertText: new vscode.SnippetString('keywords:\n  - token: ${1:blackout}\n    label: ${2:Blackout}'),
    },
  ],
  characters: [
    {
      label: 'name',
      detail: 'Character display name',
      insertText: new vscode.SnippetString('name: ${1:Character Name}'),
    },
    {
      label: 'id',
      detail: 'Optional unique id for disambiguation',
      insertText: new vscode.SnippetString('id: ${1:role_id}'),
    },
    {
      label: 'actor',
      detail: 'Actor name',
      insertText: new vscode.SnippetString('actor: ${1:Actor Name}'),
    },
    {
      label: 'mic',
      detail: 'Default microphone id',
      insertText: new vscode.SnippetString('mic: ${1:HM1}'),
    },
    {
      label: 'aliases',
      detail: 'Alternative names',
      insertText: new vscode.SnippetString('aliases: [${1:Alias}]'),
    },
  ],
  mics: [
    {
      label: 'id',
      detail: 'Mic id',
      insertText: new vscode.SnippetString('id: ${1:HM1}'),
    },
    {
      label: 'label',
      detail: 'Display label',
      insertText: new vscode.SnippetString('label: ${1:Main Mic}'),
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: new vscode.SnippetString('color: ${1:#4B8BFF}'),
    },
  ],
  sfx: [
    {
      label: 'id',
      detail: 'SFX id',
      insertText: new vscode.SnippetString('id: ${1:SFX_ID}'),
    },
    {
      label: 'file',
      detail: 'Audio file path',
      insertText: new vscode.SnippetString('file: ${1:file.mp3}'),
    },
    {
      label: 'desc',
      detail: 'Description',
      insertText: new vscode.SnippetString('desc: ${1:Description}'),
    },
  ],
  lx: [
    {
      label: 'id',
      detail: 'Lighting id',
      insertText: new vscode.SnippetString('id: ${1:LX01}'),
    },
    {
      label: 'desc',
      detail: 'Description',
      insertText: new vscode.SnippetString('desc: ${1:Description}'),
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: new vscode.SnippetString('color: ${1:#E6EEFF}'),
    },
  ],
  keywords: [
    {
      label: 'token',
      detail: 'Keyword token',
      insertText: new vscode.SnippetString('token: ${1:blackout}'),
    },
    {
      label: 'label',
      detail: 'Display label',
      insertText: new vscode.SnippetString('label: ${1:Blackout}'),
    },
    {
      label: 'color',
      detail: 'Hex color string',
      insertText: new vscode.SnippetString('color: ${1:#111111}'),
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
      return collectFrontmatterCompletions(document, position);
    }

    const viewModel = this.controller.getViewModel(document.uri.toString());
    if (!viewModel) {
      return undefined;
    }

    const linePrefix = document.lineAt(position).text.substring(0, position.character);
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

function collectFrontmatterCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.CompletionItem[] {
  const path = inferYamlPath(document, position.line);
  const currentScope = path[path.length - 1];
  const specs = currentScope ? (FRONTMATTER_CHILD_KEYS[currentScope] ?? FRONTMATTER_ROOT_KEYS) : FRONTMATTER_ROOT_KEYS;

  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_-]*/u);
  const range = wordRange ?? new vscode.Range(position, position);

  return specs.map((spec) => {
    const item = new vscode.CompletionItem(spec.label, vscode.CompletionItemKind.Field);
    item.detail = spec.detail;
    item.insertText = spec.insertText;
    item.range = range;
    return item;
  });
}

function inferYamlPath(document: vscode.TextDocument, line: number): string[] {
  const range = getFrontmatterRange(document);
  if (!range) {
    return [];
  }

  const stack: Array<{ indent: number; key: string }> = [];

  for (let i = range.startLine + 1; i < line; i += 1) {
    const text = document.lineAt(i).text;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const listKeyMatch = text.match(/^(\s*)-\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/u);
    if (listKeyMatch) {
      const indent = listKeyMatch[1].length + 2;
      const key = listKeyMatch[2];
      const value = listKeyMatch[3].trim();
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      if (value.length === 0) {
        stack.push({ indent, key });
      }
      continue;
    }

    const keyMatch = text.match(/^(\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/u);
    if (!keyMatch) {
      continue;
    }

    const indent = keyMatch[1].length;
    const key = keyMatch[2];
    const value = keyMatch[3].trim();
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (value.length === 0) {
      stack.push({ indent, key });
    }
  }

  const currentIndent = countLeadingSpaces(document.lineAt(line).text);
  return stack.filter((entry) => entry.indent < currentIndent).map((entry) => entry.key);
}

function countLeadingSpaces(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === ' ') {
    i += 1;
  }
  return i;
}
