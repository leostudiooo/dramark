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
  const width = getDiagnosticWidth(d.code);
  const range = new vscode.Range(line, col, line, col + width);
  const severity = SEVERITY_MAP[d.severity] ?? vscode.DiagnosticSeverity.Warning;
  const diag = new vscode.Diagnostic(range, d.message, severity);
  diag.code = d.code;
  diag.source = 'dramark';
  return diag;
}

function getDiagnosticWidth(code: string): number {
  if (code === 'UNCLOSED_BLOCK_TECH_CUE') {
    return 3;
  }
  if (code === 'UNCLOSED_BLOCK_COMMENT') {
    return 2;
  }
  if (code === 'UNCLOSED_SONG_CONTAINER') {
    return 2;
  }
  return 100;
}
