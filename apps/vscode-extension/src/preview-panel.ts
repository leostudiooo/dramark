import * as vscode from 'vscode';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { PreviewConfig } from '../../../apps/core/index.js';
import {
  buildTechCueColorMap,
  buildStandaloneExportHtml,
  getStandaloneRendererJs,
  convertAstToRenderBlocks,
  buildColumnarLayout,
  generateCSS,
  defaultTheme,
} from '../../../apps/core/index.js';
import { createPreviewHTML } from '../../../apps/core/index.js';

export class PreviewPanel {
  public static readonly viewType = 'dramark.preview';
  private panel: vscode.WebviewPanel | undefined;
  private themeListener: vscode.Disposable | undefined;
  private latestViewModel: ParseViewModel | null = null;
  private latestDocumentUri: vscode.Uri | null = null;
  private configOpen = false;
  private config: PreviewConfig = {
    showTechCues: true,
    showComments: true,
    translationMode: 'bilingual',
    translationLayout: 'side-by-side',
    theme: 'auto',
  };

  constructor(private extensionUri: vscode.Uri) {}

  show(documentUri: vscode.Uri, viewModel: ParseViewModel): void {
    this.latestViewModel = viewModel;
    this.latestDocumentUri = documentUri;
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri);
      const roots = [this.extensionUri, ...workspaceRoots];
      this.panel = vscode.window.createWebviewPanel(
        PreviewPanel.viewType,
        'DraMark Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: roots,
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.themeListener?.dispose();
        this.themeListener = undefined;
      });
      this.themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
        if (this.config.theme === 'auto') {
          this.rerender();
        }
      });
      
      // Listen for messages from the webview
      this.panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'configChange') {
          this.config = { ...this.config, ...message.config };
          this.rerender();
        } else if (message.type === 'toggleConfig') {
          this.configOpen = !this.configOpen;
          this.rerender();
        } else if (message.type === 'printError') {
          vscode.window.showErrorMessage(String(message.error || 'Failed to open print dialog in preview.'));
        }
      });
    }

    this.rerender();
  }

  update(documentUri: vscode.Uri, viewModel: ParseViewModel): void {
    this.latestViewModel = viewModel;
    this.latestDocumentUri = documentUri;
    this.rerender();
  }

  exportPdf(): void {
    if (!this.panel) {
      vscode.window.showInformationMessage('Open DraMark Preview first, then export PDF.');
      return;
    }
    this.panel.reveal(vscode.ViewColumn.Beside);
    this.panel.webview.postMessage({ type: 'exportPdf' });
  }

  async exportHtml(): Promise<void> {
    if (!this.latestViewModel || !this.latestDocumentUri) {
      vscode.window.showInformationMessage('Open DraMark Preview first, then export HTML.');
      return;
    }

    const effectiveTheme = this.resolveThemeMode();
    const renderConfig = {
      ...this.config,
      theme: effectiveTheme,
    };
    const techConfig = this.latestViewModel.config.tech ?? { mics: [] };
    
    // Generate CSS by running render once on extension side
    const previewCss = generateCSS(defaultTheme, renderConfig);
    
    // AST and config for the standalone renderer
    const astJson = JSON.stringify(this.latestViewModel.tree);
    const techConfigJson = JSON.stringify(techConfig);
    const configJson = JSON.stringify(renderConfig);
    
    const exportHtml = buildStandaloneExportHtml({
      astJson,
      techConfigJson,
      initialConfigJson: configJson,
      initialTheme: effectiveTheme,
      previewCss,
      rendererJs: getStandaloneRendererJs(),
      config: this.config,
      configOpen: this.configOpen,
    });

    // Save dialog
    const defaultUri = this.latestDocumentUri.with({
      path: this.latestDocumentUri.path.replace(/\.dra\.md$/i, '.html'),
    });

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'HTML Files': ['html'],
        'All Files': ['*'],
      },
      title: 'Export DraMark to HTML',
    });

    if (!saveUri) {
      return;
    }

    try {
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(exportHtml, 'utf-8'));
      vscode.window.showInformationMessage(`Exported to ${saveUri.fsPath}`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to export HTML: ${String(err)}`);
    }
  }

  dispose(): void {
    this.themeListener?.dispose();
    this.themeListener = undefined;
    this.panel?.dispose();
  }

  private rerender(): void {
    if (!this.panel || this.latestViewModel === null) {
      return;
    }
    this.panel.webview.html = this.renderHtml(this.latestViewModel, this.latestDocumentUri);
  }

  private renderHtml(viewModel: ParseViewModel, documentUri: vscode.Uri | null): string {
    const effectiveTheme = this.resolveThemeMode();
    const renderConfig = {
      ...this.config,
      theme: effectiveTheme,
    };
    const techConfig = viewModel.config.tech ?? { mics: [] };
    const techColorMap = buildTechCueColorMap(techConfig);
    const context = {
      ast: viewModel.tree,
      techConfig,
      config: renderConfig,
      theme: defaultTheme,
      techColorMap,
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);
    const previewHTML = createPreviewHTML({ layout, config: renderConfig });
    const css = generateCSS(defaultTheme, renderConfig);
    const configHTML = this.createConfigPanelHTML();
    const baseHref = this.buildBaseHref(documentUri);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseHref.length > 0 ? `<base href="${baseHref}">` : ''}
<style>
  ${css}
  
  /* VSCode-specific adjustments */
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    background: transparent;
    color: inherit;
    padding: 16px;
  }

  /* Ensure config panel stays within bounds */
  .dm-config-panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
  }
  
  .dm-config-content {
    background: var(--dm-bg);
    color: var(--dm-text);
    border: 1px solid var(--dm-border);
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
  
  // Request config panel toggle from extension host.
  const trigger = document.querySelector('.dm-config-trigger');
  if (trigger) {
    trigger.addEventListener('click', function() {
      vscode.postMessage({ type: 'toggleConfig' });
    });
  }
  
  // Handle config changes
  document.querySelectorAll('[data-config]').forEach(function(input) {
    input.addEventListener('change', function(e) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }
      const key = target.dataset.config;
      if (!key) {
        return;
      }
      const value = target.type === 'checkbox' ? target.checked : target.value;
      vscode.postMessage({
        type: 'configChange',
        config: { [key]: value }
      });
    });
  });

  window.addEventListener('message', function(event) {
    const message = event.data;
    if (!message || message.type !== 'exportPdf') {
      return;
    }
    try {
      window.print();
    } catch (err) {
      vscode.postMessage({
        type: 'printError',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
})();
</script>
</body>
</html>`;
  }

  private buildBaseHref(documentUri: vscode.Uri | null): string {
    if (!this.panel || !documentUri || documentUri.scheme !== 'file') {
      return '';
    }
    const dirUri = vscode.Uri.joinPath(documentUri, '..');
    const base = this.panel.webview.asWebviewUri(dirUri).toString();
    return base.endsWith('/') ? base : `${base}/`;
  }

  private resolveThemeMode(): PreviewConfig['theme'] {
    if (this.config.theme !== 'auto') {
      return this.config.theme;
    }
    const kind = vscode.window.activeColorTheme.kind;
    if (kind === vscode.ColorThemeKind.Light) {
      return 'light';
    }
    return 'dark';
  }

  private wrapCSSWithSelector(css: string, _selector: string): string {
    // 简单处理：将 CSS 规则包装在指定选择器下
    // 移除最外层的 :root 或 .dramark-preview 选择器，因为我们会在外层包装
    return css
      .replace(/:root\s*,\s*/g, '')
      .replace(/:root\s*/g, '')
      .replace(/\.dramark-preview\s*/g, '');
  }

  private createConfigPanelHTML(): string {
    const { config, configOpen } = this;
    
    // Lucide Settings icon SVG
    const settingsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`;
    
    const configContent = configOpen ? `
      <div class="dm-config-content">
        <div class="dm-config-item">
          <span class="dm-config-label">Tech Cues</span>
          <label class="dm-switch">
            <input type="checkbox" data-config="showTechCues" ${config.showTechCues ? 'checked' : ''}>
            <span class="dm-switch-slider"></span>
          </label>
        </div>
        
        <div class="dm-config-item">
          <span class="dm-config-label">Comments</span>
          <label class="dm-switch">
            <input type="checkbox" data-config="showComments" ${config.showComments ? 'checked' : ''}>
            <span class="dm-switch-slider"></span>
          </label>
        </div>
        
        <div class="dm-config-item">
          <span class="dm-config-label">Translation</span>
          <select data-config="translationMode">
            <option value="source-only" ${config.translationMode === 'source-only' ? 'selected' : ''}>Source Only</option>
            <option value="target-only" ${config.translationMode === 'target-only' ? 'selected' : ''}>Target Only</option>
            <option value="bilingual" ${config.translationMode === 'bilingual' ? 'selected' : ''}>Bilingual</option>
          </select>
        </div>
        
        <div class="dm-config-item">
          <span class="dm-config-label">Layout</span>
          <select data-config="translationLayout">
            <option value="stack" ${config.translationLayout === 'stack' ? 'selected' : ''}>Stack</option>
            <option value="side-by-side" ${config.translationLayout === 'side-by-side' ? 'selected' : ''}>Side by Side</option>
          </select>
        </div>
        
        <div class="dm-config-item">
          <span class="dm-config-label">Theme</span>
          <select data-config="theme">
            <option value="auto" ${config.theme === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="light" ${config.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
      </div>
    ` : '';
    
    return `
      <div class="dm-config-panel">
        <button class="dm-config-trigger" aria-label="配置" aria-expanded="${configOpen}">
          ${settingsIcon}
        </button>
        ${configContent}
      </div>
    `;
  }

}
