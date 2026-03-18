import type { DraMarkWarning } from '../types.js';
import type { CoreDiagnostic } from './types.js';

export function mapParserWarningsToDiagnostics(warnings: DraMarkWarning[]): CoreDiagnostic[] {
  return warnings.map((warning) => ({
    source: 'parser',
    code: warning.code,
    message: warning.message,
    severity: 'warning',
    line: warning.line,
    column: warning.column,
  }));
}

export function mergeDiagnostics(...diagnosticLists: CoreDiagnostic[][]): CoreDiagnostic[] {
  return diagnosticLists.flat();
}
