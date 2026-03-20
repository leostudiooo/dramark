import * as vscode from 'vscode';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { PreviewConfig } from '../../../packages/app-core/index.js';
import {
  buildTechCueColorMap,
  convertAstToRenderBlocks,
  buildColumnarLayout,
  generateCSS,
  defaultTheme,
} from '../../../packages/app-core/index.js';
import { createPreviewHTML, createConfigPanelHTML } from '../../../packages/app-core/index.js';

export class PreviewPanel {
  public static readonly viewType = 'dramark.preview';
  private panel: vscode.WebviewPanel | undefined;
  private config: PreviewConfig = {
    showTechCues: true,
    showComments: true,
    translationMode: 'bilingual',
    translationLayout: 'side-by-side',
    theme: 'auto',
  };

  constructor(private extensionUri: vscode.Uri) {}

  show(viewModel: ParseViewModel): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        PreviewPanel.viewType,
        'DraMark Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [this.extensionUri],
        },
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
      
      // Listen for messages from the webview
      this.panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'configChange') {
          this.config = { ...this.config, ...message.config };
          // Re-render with new config
          if (this.panel) {
            this.panel.webview.html = this.renderHtml(viewModel);
          }
        } else if (message.type === 'toggleConfig') {
          this.panel?.webview.postMessage({ type: 'toggleConfigPanel' });
        }
      });
    }

    this.panel.webview.html = this.renderHtml(viewModel);
  }

  update(viewModel: ParseViewModel): void {
    if (this.panel) {
      this.panel.webview.html = this.renderHtml(viewModel);
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private renderHtml(viewModel: ParseViewModel): string {
    const techConfig = viewModel.config.tech ?? { mics: [] };
    const techColorMap = buildTechCueColorMap(techConfig);
    const context = {
      ast: viewModel.tree,
      techConfig,
      config: this.config,
      theme: defaultTheme,
      techColorMap,
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);
    const previewHTML = createPreviewHTML({ layout, config: this.config });
    const css = generateCSS(defaultTheme, this.config);
    const configHTML = createConfigPanelHTML({
      config: this.config,
      onChange: () => {}, // Handled by message passing
      isOpen: false,
      onToggle: () => {},
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  ${css}
  
  /* VSCode-specific adjustments */
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    background: var(--vscode-editor-background, #ffffff);
    color: var(--vscode-editor-foreground, #1a1a1a);
    padding: 16px;
  }
  
  .dramark-preview {
    background: transparent;
  }
  
  /* Ensure config panel stays within bounds */
  .dm-config-panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
  }
  
  .dm-config-content {
    background: var(--vscode-editor-background, #ffffff);
    border: 1px solid var(--vscode-panel-border, #e0ddd5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
</style>
</head>
<body>
${previewHTML}
${configHTML}

<script>
(function() {
  const vscode = acquireVsCodeApi();
  
  // Handle config panel toggle
  document.querySelector('.dm-config-trigger').addEventListener('click', function() {
    const content = document.querySelector('.dm-config-content');
    if (content) {
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    }
  });
  
  // Handle config changes
  document.querySelectorAll('[data-config]').forEach(function(input) {
    input.addEventListener('change', function(e) {
      const key = e.target.dataset.config;
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      vscode.postMessage({
        type: 'configChange',
        config: { [key]: value }
      });
    });
  });
  
  // Listen for messages from extension
  window.addEventListener('message', function(event) {
    const message = event.data;
    if (message.type === 'toggleConfigPanel') {
      const trigger = document.querySelector('.dm-config-trigger');
      if (trigger) {
        trigger.click();
      }
    }
  });
})();
</script>
</body>
</html>`;
  }
}
