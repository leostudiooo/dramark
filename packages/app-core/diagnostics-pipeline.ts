import type { CoreDiagnostic, ParseViewModel } from '../../src/core/index.js';

export interface DiagnosticsReport {
  diagnostics: CoreDiagnostic[];
  warningCount: number;
  errorCount: number;
}

export function buildDiagnosticsReport(viewModel: ParseViewModel): DiagnosticsReport {
  const { diagnostics } = viewModel;
  let warningCount = 0;
  let errorCount = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else if (d.severity === 'warning') warningCount++;
  }

  return { diagnostics, warningCount, errorCount };
}
