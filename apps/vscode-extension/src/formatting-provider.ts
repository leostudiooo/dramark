import * as vscode from 'vscode';

const songOpenPattern = /^\$\$\s+(.+)$/u;
const translationSourcePattern = /^=\s+(.+)$/u;

export class DraMarkFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    const hadTrailingNewline = document.getText().endsWith('\n');
    const formattedLines: string[] = [];

    for (let i = 0; i < document.lineCount; i += 1) {
      const line = document.lineAt(i).text;
      formattedLines.push(formatLine(line));
    }

    let formattedText = formattedLines.join('\n');
    if (hadTrailingNewline) {
      formattedText += '\n';
    }

    const originalText = document.getText();
    if (formattedText === originalText) {
      return [];
    }

    const lastLine = document.lineAt(document.lineCount - 1);
    const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
    return [vscode.TextEdit.replace(fullRange, formattedText)];
  }
}

function formatLine(line: string): string {
  const trimmedEnd = line.replace(/[\t ]+$/u, '');
  if (!isRootDirectiveLine(trimmedEnd)) {
    return trimmedEnd;
  }

  const trimmed = trimmedEnd.trim();
  if (trimmed === '@@' || trimmed === '!!' || trimmed === '$$' || trimmed === '=') {
    return trimmed;
  }

  const songOpenMatch = trimmed.match(songOpenPattern);
  if (songOpenMatch) {
    return `$$ ${songOpenMatch[1].trim()}`;
  }

  const translationSourceMatch = trimmed.match(translationSourcePattern);
  if (translationSourceMatch) {
    return `= ${translationSourceMatch[1].trim()}`;
  }

  if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
    return trimmed;
  }

  return trimmedEnd;
}

function isRootDirectiveLine(line: string): boolean {
  return line.trimStart() === line;
}
