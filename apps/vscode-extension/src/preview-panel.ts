import * as vscode from 'vscode';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { PreviewConfig } from '../../../apps/core/index.js';
import {
  buildTechCueColorMap,
  buildStandaloneExportHtml,
  convertAstToRenderBlocks,
  createConfigPanelHTML,
  buildColumnarLayout,
  generateCSS,
  defaultTheme,
} from '../../../apps/core/index.js';
import { createPreviewHTML } from '../../../apps/core/index.js';
import { detectChromePath, exportToPdf } from './pdf-exporter.js';
import exportOverridesCss from './styles/export-overrides.css';
import webviewOverridesCss from './styles/webview-overrides.css';

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

  async exportPdf(documentUri?: vscode.Uri, viewModel?: ParseViewModel): Promise<void> {
    const source = this.resolveExportSource(documentUri, viewModel);
    if (!source) {
      vscode.window.showInformationMessage('Open a DraMark document first, then export PDF.');
      return;
    }

    const { documentUri: targetUri, viewModel: targetViewModel } = source;

    const chromePath = await detectChromePath();
    if (!chromePath) {
      const openSettings = 'Open Settings';
      const exportHtml = 'Export HTML instead';
      const choice = await vscode.window.showWarningMessage(
        'Chrome/Chromium not found. Please install Chrome or configure "dramark.pdf.chromePath" in settings.',
        openSettings,
        exportHtml,
      );
      if (choice === openSettings) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'dramark.pdf.chromePath');
      } else if (choice === exportHtml) {
        await this.exportHtml();
      }
      return;
    }

    const exportHtml = await this.generateExportHtmlContent(targetUri, targetViewModel, 'pdf');
    if (!exportHtml) {
      return;
    }

    const defaultUri = targetUri.with({
      path: targetUri.path.replace(/\.dra\.md$/i, '.pdf'),
    });

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'PDF Files': ['pdf'],
        'All Files': ['*'],
      },
      title: 'Export DraMark to PDF',
    });

    if (!saveUri) {
      return;
    }

    await vscode.window.withProgress(
      {
        title: 'Exporting PDF...',
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
      },
      async () => {
        try {
          await exportToPdf(exportHtml, saveUri.fsPath, chromePath);
          vscode.window.showInformationMessage(`PDF exported: ${saveUri.fsPath}`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to export PDF: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    );
  }

  async exportHtml(documentUri?: vscode.Uri, viewModel?: ParseViewModel): Promise<void> {
    const source = this.resolveExportSource(documentUri, viewModel);
    if (!source) {
      vscode.window.showInformationMessage('Open a DraMark document first, then export HTML.');
      return;
    }

    const { documentUri: targetUri, viewModel: targetViewModel } = source;

    const exportHtml = await this.generateExportHtmlContent(targetUri, targetViewModel, 'html');
    if (!exportHtml) {
      return;
    }

    const defaultUri = targetUri.with({
      path: targetUri.path.replace(/\.dra\.md$/i, '.html'),
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

  private resolveExportSource(
    documentUri?: vscode.Uri,
    viewModel?: ParseViewModel,
  ): { documentUri: vscode.Uri; viewModel: ParseViewModel } | null {
    const targetUri = documentUri ?? this.latestDocumentUri;
    const targetViewModel = viewModel ?? this.latestViewModel;
    if (!targetUri || !targetViewModel) {
      return null;
    }
    return { documentUri: targetUri, viewModel: targetViewModel };
  }

  private async generateExportHtmlContent(
    documentUri: vscode.Uri,
    viewModel: ParseViewModel,
    exportFormat: 'html' | 'pdf',
  ): Promise<string | null> {
    const exportTheme: PreviewConfig['theme'] = exportFormat === 'pdf' ? 'print' : 'auto';
    const renderConfig = {
      ...this.config,
      theme: exportTheme,
    };
    const techConfig = viewModel.config.tech ?? { mics: [] };
    
    const previewCss = generateCSS(defaultTheme, renderConfig);
    
    const astJson = JSON.stringify(viewModel.tree);
    const techConfigJson = JSON.stringify(techConfig);
    const configJson = JSON.stringify(renderConfig);
    const rendererJs = await this.buildStandaloneRendererBundle();
    
    return buildStandaloneExportHtml({
      astJson,
      techConfigJson,
      initialConfigJson: configJson,
      initialTheme: exportTheme,
      previewCss,
      overrideCss: exportOverridesCss,
      rendererJs,
      config: renderConfig,
      configOpen: this.configOpen,
    });
  }

  private async buildStandaloneRendererBundle(): Promise<string> {
    const runtimeEntryPath = path.resolve(this.extensionUri.fsPath, '..', 'core', 'standalone-runtime.ts');
    const entryCode = [
      `import { renderStandalone } from ${JSON.stringify(runtimeEntryPath)};`,
      'globalThis.DraMarkRenderer = { render: renderStandalone };',
    ].join('\n');

    const result = await esbuild.build({
      stdin: {
        contents: entryCode,
        resolveDir: path.dirname(runtimeEntryPath),
        sourcefile: 'dramark-export-runtime-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
    });

    const output = result.outputFiles?.[0]?.text;
    if (!output) {
      throw new Error('Failed to bundle standalone renderer.');
    }
    return output;
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
  ${webviewOverridesCss}
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
    if (this.config.theme === 'print') {
      return 'print';
    }
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
    return createConfigPanelHTML(
      {
        config: this.config,
        isOpen: this.configOpen,
        onChange: () => undefined,
        onToggle: () => undefined,
      },
      {
        includePrintThemeOption: true,
        triggerIconHtml: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`,
      },
    );
  }

}
