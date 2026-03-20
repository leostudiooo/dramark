import * as vscode from 'vscode';
import { analyzeDocumentStructure } from './structure-analyzer.js';
import type { StructureNode } from './structure-analyzer.js';

export const DRAMARK_CODELENS_NOOP_COMMAND = 'dramark.codelens.noop';

export class DraMarkCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const roots = analyzeDocumentStructure(document);
    const lenses: vscode.CodeLens[] = [];

    const collect = (node: StructureNode): void => {
      const title = toCodeLensTitle(node);
      if (title !== null) {
        const range = new vscode.Range(node.startLine, 0, node.startLine, 0);
        lenses.push(new vscode.CodeLens(range, {
          title,
          command: DRAMARK_CODELENS_NOOP_COMMAND,
        }));
      }

      for (const child of node.children) {
        collect(child);
      }
    };

    for (const root of roots) {
      collect(root);
    }

    return lenses;
  }
}

function toCodeLensTitle(node: StructureNode): string | null {
  const lineCount = node.endLine - node.startLine + 1;

  switch (node.kind) {
    case 'frontmatter':
      return `Frontmatter · ${lineCount} lines`;

    case 'heading':
      return `Section`;

    case 'song': {
      const characterCount = countByKind(node, 'character');
      return `Song · ${lineCount} lines · ${characterCount} characters`;
    }

    case 'character': {
      const translationCount = countByKind(node, 'translation');
      return `Character · ${lineCount} lines · ${translationCount} translations`;
    }

    case 'translation':
      return `Translation · ${lineCount} lines`;

    case 'block-tech-cue':
      return `Tech Cue Block · ${lineCount} lines`;

    case 'comment-block':
      return `Comment Block · ${lineCount} lines`;

    default:
      return null;
  }
}

function countByKind(node: StructureNode, kind: StructureNode['kind']): number {
  let count = 0;
  for (const child of node.children) {
    if (child.kind === kind) {
      count += 1;
    }
    count += countByKind(child, kind);
  }
  return count;
}
