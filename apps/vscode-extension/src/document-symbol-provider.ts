import * as vscode from 'vscode';
import { analyzeDocumentStructure } from './structure-analyzer.js';
import type { StructureNode } from './structure-analyzer.js';

export class DraMarkDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const roots = analyzeDocumentStructure(document);
    return roots.map((node) => toDocumentSymbol(node, document));
  }
}

function toDocumentSymbol(node: StructureNode, document: vscode.TextDocument): vscode.DocumentSymbol {
  const range = lineRange(document, node.startLine, node.endLine);
  const selectionRange = lineRange(document, node.startLine, node.startLine);

  const symbol = new vscode.DocumentSymbol(
    node.label,
    describeNode(node),
    mapSymbolKind(node.kind),
    range,
    selectionRange,
  );

  symbol.children = node.children.map((child) => toDocumentSymbol(child, document));
  return symbol;
}

function describeNode(node: StructureNode): string {
  const lineCount = node.endLine - node.startLine + 1;
  return `${lineCount} line${lineCount > 1 ? 's' : ''}`;
}

function mapSymbolKind(kind: StructureNode['kind']): vscode.SymbolKind {
  switch (kind) {
    case 'frontmatter':
      return vscode.SymbolKind.Module;
    case 'heading':
      return vscode.SymbolKind.Namespace;
    case 'song':
      return vscode.SymbolKind.Namespace;
    case 'character':
      return vscode.SymbolKind.Class;
    case 'translation':
      return vscode.SymbolKind.String;
    case 'block-tech-cue':
      return vscode.SymbolKind.Event;
    case 'comment-block':
      return vscode.SymbolKind.Key;
    default:
      return vscode.SymbolKind.Object;
  }
}

function lineRange(document: vscode.TextDocument, startLine: number, endLine: number): vscode.Range {
  const safeStart = Math.max(0, Math.min(startLine, document.lineCount - 1));
  const safeEnd = Math.max(safeStart, Math.min(endLine, document.lineCount - 1));
  const endChar = document.lineAt(safeEnd).text.length;
  return new vscode.Range(safeStart, 0, safeEnd, endChar);
}
