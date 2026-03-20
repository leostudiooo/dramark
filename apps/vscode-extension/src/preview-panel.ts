import * as vscode from 'vscode';
import type { ParseViewModel } from '../../../src/core/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RenderableNode = any;

export class PreviewPanel {
  public static readonly viewType = 'dramark.preview';
  private panel: vscode.WebviewPanel | undefined;

  constructor(private extensionUri: vscode.Uri) {}

  show(viewModel: ParseViewModel): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        PreviewPanel.viewType,
        'DraMark Preview',
        vscode.ViewColumn.Beside,
        { enableScripts: false },
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
    }

    this.panel.webview.html = renderPreviewHtml(viewModel);
  }

  update(viewModel: ParseViewModel): void {
    if (this.panel) {
      this.panel.webview.html = renderPreviewHtml(viewModel);
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

function renderPreviewHtml(viewModel: ParseViewModel): string {
  const body = viewModel.tree.children.map(renderNode).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; color: #1a1a1a; }
  .character-card { background: #f5f0e8; border-left: 4px solid #c9a84c; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
  .song-card { background: #f0f0f8; border-left: 4px solid #6b7fd7; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
  .translation-pair { margin: 8px 0; }
  .translation-source { color: #666; font-style: italic; }
  .inline-action { background: #fff3cd; padding: 1px 4px; border-radius: 3px; }
  .inline-song { color: #6b7fd7; font-style: italic; }
  .inline-tech-cue { background: #e8f4fd; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
  .block-tech-cue { background: #e8f4fd; padding: 8px 12px; border-radius: 4px; font-family: monospace; }
  h3 { margin: 16px 0 4px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  .muted { color: #999; font-size: 0.85em; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function renderNode(node: RenderableNode): string {
  if (node.type === 'character-block') {
    const children = (node.children ?? []).map(renderNode).join('\n');
    return `<article class="character-card"><h3>@${escHtml(node.name)}</h3>${children}</article>`;
  }
  if (node.type === 'song-container') {
    const children = (node.children ?? []).map(renderNode).join('\n');
    return `<article class="song-card"><h3>Song</h3>${children}</article>`;
  }
  if (node.type === 'heading') {
    return `<h${node.depth}>${renderPhrasing(node.children)}</h${node.depth}>`;
  }
  if (node.type === 'thematicBreak') {
    return '<hr />';
  }
  if (node.type === 'translation-pair') {
    const targets = (node.target ?? []).map(renderContentNode).join('\n');
    return `<div class="translation-pair"><p class="translation-source">= ${escHtml(node.sourceText)}</p>${targets}</div>`;
  }
  if (node.type === 'block-tech-cue') {
    return `<pre class="block-tech-cue">${escHtml(node.value ?? '')}</pre>`;
  }
  if (node.type === 'paragraph') {
    return `<p>${renderPhrasing(node.children)}</p>`;
  }
  return `<p class="muted">[${escHtml(node.type)}]</p>`;
}

function renderContentNode(node: { type: string; children?: unknown[]; value?: string }): string {
  if (node.type === 'paragraph') {
    return `<p>${renderPhrasing(node.children as RenderableNode[])}</p>`;
  }
  return `<div>${escHtml(node.value ?? '')}</div>`;
}

function renderPhrasing(children?: RenderableNode[]): string {
  if (!Array.isArray(children)) return '';
  return children.map(renderInlineNode).join('');
}

function renderInlineNode(node: RenderableNode): string {
  if (node.type === 'text') {
    return escHtml(node.value ?? '');
  }
  if (node.type === 'emphasis') {
    return `<em>${renderPhrasing(node.children)}</em>`;
  }
  if (node.type === 'strong') {
    return `<strong>${renderPhrasing(node.children)}</strong>`;
  }
  if (node.type === 'inline-action') {
    return `<span class="inline-action">{${escHtml(node.value ?? '')}}</span>`;
  }
  if (node.type === 'inline-song') {
    return `<span class="inline-song">${escHtml(node.value ?? '')}</span>`;
  }
  if (node.type === 'inline-tech-cue') {
    return `<span class="inline-tech-cue">&lt;&lt;${escHtml(node.value ?? '')}&gt;&gt;</span>`;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return renderPhrasing(node.children as RenderableNode[]);
  }
  if ('value' in node && typeof node.value === 'string') {
    return escHtml(node.value);
  }
  return '';
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
