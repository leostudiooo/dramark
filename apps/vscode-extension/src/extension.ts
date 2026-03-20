import * as vscode from 'vscode';
import { DocumentEngine } from '../../../packages/app-core/index.js';
import { DocumentController } from './document-controller.js';
import { DiagnosticsManager } from './diagnostics.js';
import { DraMarkCompletionProvider } from './completion-provider.js';
import { PreviewPanel } from './preview-panel.js';

const DRAMARK_SELECTOR: vscode.DocumentSelector = { language: 'dramark' };

export function activate(context: vscode.ExtensionContext): void {
  const engine = new DocumentEngine({ debounceMs: 150 });
  const controller = new DocumentController(engine);

  engine.subscribe((snapshot) => {
    controller.onSnapshot(snapshot.uri, snapshot.viewModel);
  });

  const diagnostics = new DiagnosticsManager(controller);
  const preview = new PreviewPanel(context.extensionUri);

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    DRAMARK_SELECTOR,
    new DraMarkCompletionProvider(controller),
    '@',
    '<',
  );

  const showPreview = vscode.commands.registerCommand('dramark.showPreview', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'dramark') {
      const viewModel = controller.getViewModel(editor.document.uri.toString());
      if (viewModel) {
        preview.show(viewModel);
      }
    }
  });

  const copyDiagnostics = vscode.commands.registerCommand('dramark.copyDiagnostics', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const viewModel = controller.getViewModel(editor.document.uri.toString());
    if (!viewModel) return;
    const text = viewModel.diagnostics
      .map((d) => `[${d.severity}] ${d.code} @${d.line ?? '?'}:${d.column ?? '?'} — ${d.message}`)
      .join('\n');
    vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('Diagnostics copied to clipboard');
  });

  const openSub = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.languageId === 'dramark') {
      controller.openDocument(doc.uri.toString(), doc.getText());
    }
  });

  const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId === 'dramark') {
      controller.updateDocument(event.document.uri.toString(), event.document.getText());
      const viewModel = controller.getViewModel(event.document.uri.toString());
      if (viewModel) {
        preview.update(viewModel);
      }
    }
  });

  const closeSub = vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.languageId === 'dramark') {
      controller.closeDocument(doc.uri.toString());
    }
  });

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'dramark') {
      controller.openDocument(doc.uri.toString(), doc.getText());
    }
  }

  context.subscriptions.push(
    diagnostics,
    completionProvider,
    showPreview,
    copyDiagnostics,
    openSub,
    changeSub,
    closeSub,
    { dispose: () => engine.dispose() },
    { dispose: () => preview.dispose() },
  );
}

export function deactivate(): void {}
