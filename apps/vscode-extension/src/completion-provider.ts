import * as vscode from 'vscode';
import { resolveCompletionContext, collectCompletions } from '../../../apps/core/index.js';
import type { CompletionItem as DraCompletionItem } from '../../../apps/core/index.js';
import {
  resolveFrontmatterPosition,
  getFrontmatterCompletions,
} from '../../../apps/core/frontmatter-completions.js';
import type { FrontmatterCompletionItem as FmCompletionItem } from '../../../apps/core/frontmatter-completions.js';
import type { DocumentController } from './document-controller.js';

const COMPLETION_KIND_MAP: Record<string, vscode.CompletionItemKind> = {
  character: vscode.CompletionItemKind.User,
  'tech-cue': vscode.CompletionItemKind.Value,
  snippet: vscode.CompletionItemKind.Snippet,
};

export class DraMarkCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private controller: DocumentController) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    if (isInsideFrontmatter(document, position)) {
      const range = getFrontmatterRange(document);
      if (!range) return undefined;

      const startLine = range.startLine + 1;
      const endLine = range.endLine;
      const yamlText = document.getText(
        new vscode.Range(startLine, 0, endLine, 0),
      );
      const yamlLine = position.line - startLine + 1;
      const yamlCol = position.character + 1;

      const viewModel = this.controller.getViewModel(document.uri.toString());
      const ctx = resolveFrontmatterPosition(yamlText, yamlLine, yamlCol);
      const items = getFrontmatterCompletions(
        ctx,
        viewModel?.config,
      );

      return items.map((item) => toVscodeFrontmatterCompletion(item, position, document));
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

const FM_KIND_MAP: Record<string, vscode.CompletionItemKind> = {
  key: vscode.CompletionItemKind.Property,
  value: vscode.CompletionItemKind.Value,
};

function toVscodeFrontmatterCompletion(
  item: FmCompletionItem,
  position: vscode.Position,
  document: vscode.TextDocument,
): vscode.CompletionItem {
  const completion = new vscode.CompletionItem(item.label, FM_KIND_MAP[item.kind]);
  completion.detail = item.detail;

  const lineText = document.lineAt(position).text;
  const beforeCursor = lineText.substring(0, position.character);

  let insertText = item.insertText;
  if (/^\s*-$/u.test(beforeCursor)) {
    insertText = ' ' + insertText;
  }

  completion.insertText = insertText;

  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_-]*/u);
  if (wordRange) {
    completion.range = wordRange;
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
