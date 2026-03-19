import type { DraMarkOptions, DraMarkWarning } from './types.js';

export class DraMarkParseError extends Error {
  public readonly line: number;
  public readonly column: number;
  public readonly code: string;

  public constructor(code: string, message: string, line: number, column: number) {
    super(`${code} at ${line}:${column} - ${message}`);
    this.name = 'DraMarkParseError';
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

export function defaultOptions(options?: DraMarkOptions): Required<DraMarkOptions> {
  return {
    translationEnabled: options?.translationEnabled ?? false,
    includeComments: options?.includeComments ?? false,
    strictMode: options?.strictMode ?? false,
    characterDeclarationMode: options?.characterDeclarationMode ?? 'strict',
    multipassDebug: options?.multipassDebug ?? false,
    pass4Restore: options?.pass4Restore ?? true,
  };
}

export function warningToError(warning: DraMarkWarning): DraMarkParseError {
  return new DraMarkParseError(warning.code, warning.message, warning.line, warning.column);
}