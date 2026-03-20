import * as vscode from 'vscode';
import type { CoreDiagnostic } from '../../../src/core/index.js';
import type { DocumentController } from './document-controller.js';

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

export class DiagnosticsManager {
  private collection: vscode.DiagnosticCollection;

  constructor(controller: DocumentController) {
    this.collection = vscode.languages.createDiagnosticCollection('dramark');

    controller.subscribe((uri, viewModel) => {
      const vscodeUri = vscode.Uri.parse(uri);
      const diagnostics = viewModel.diagnostics.map((d) => toVscodeDiagnostic(d, vscodeUri));
      this.collection.set(vscodeUri, diagnostics);
    });
  }

  dispose(): void {
    this.collection.dispose();
  }
}

function toVscodeDiagnostic(
  d: CoreDiagnostic,
  uri: vscode.Uri,
): vscode.Diagnostic {
  const line = Math.max(0, (d.line ?? 1) - 1);
  const col = Math.max(0, (d.column ?? 1) - 1);
  const range = new vscode.Range(line, col, line, col + 100);
  const severity = SEVERITY_MAP[d.severity] ?? vscode.DiagnosticSeverity.Warning;
  const diag = new vscode.Diagnostic(range, d.message, severity);
  diag.code = d.code;
  diag.source = 'dramark';
  return diag;
}
