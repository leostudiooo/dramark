import * as vscode from 'vscode';
import { resolveCompletionContext, collectCompletions } from '../../../packages/app-core/index.js';
import type { CompletionItem as DraCompletionItem } from '../../../packages/app-core/index.js';
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
