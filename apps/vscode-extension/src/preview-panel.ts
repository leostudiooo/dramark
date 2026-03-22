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
import { createPreviewHTML } from '../../../packages/app-core/index.js';

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

    // 复用 renderHtml 的逻辑生成基础 HTML
    const effectiveTheme = this.resolveThemeMode();
    const renderConfig = {
      ...this.config,
      theme: effectiveTheme,
    };
    const techConfig = this.latestViewModel.config.tech ?? { mics: [] };
    const techColorMap = buildTechCueColorMap(techConfig);
    const context = {
      ast: this.latestViewModel.tree,
      techConfig,
      config: renderConfig,
      theme: defaultTheme,
      techColorMap,
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);
    const previewHTML = createPreviewHTML({ layout, config: renderConfig });
    const css = generateCSS(defaultTheme, renderConfig);
    const configHTML = this.createExportConfigPanelHTML();

    // 构建导出的 HTML - 复用扩展预览的结构，但替换为导出的交互逻辑
    const exportHtml = `<!DOCTYPE html>
<html lang="en" data-theme="${effectiveTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DraMark Export</title>
<style>
  ${css}
  
  /* Export-specific styles */
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    background: transparent;
    color: inherit;
    padding: 16px;
  }

  /* Export Config Panel */
  .dm-export-panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
  }

  .dm-export-trigger {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--dm-bg);
    color: var(--dm-text);
    border: 1px solid var(--dm-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .dm-export-trigger:hover {
    transform: scale(1.05);
  }

  .dm-export-content {
    position: absolute;
    bottom: 52px;
    right: 0;
    width: 280px;
    background: var(--dm-bg);
    border: 1px solid var(--dm-border);
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .dm-export-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--dm-border);
  }

  .dm-export-item:last-child {
    border-bottom: none;
  }

  .dm-export-label {
    font-size: 14px;
    color: var(--dm-text);
  }

  .dm-export-item select {
    padding: 4px 8px;
    border: 1px solid var(--dm-border);
    border-radius: 4px;
    background: var(--dm-bg);
    color: var(--dm-text);
    font-size: 14px;
    min-width: 120px;
  }

  .dm-export-print {
    padding-top: 12px;
  }

  .dm-export-print-btn {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--dm-border);
    border-radius: 6px;
    background: var(--dm-bg);
    color: var(--dm-text);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .dm-export-print-btn:hover {
    background: var(--dm-sung-bg);
  }

  /* Container Query Support */
  .dramark-preview {
    container-type: inline-size;
    container-name: preview;
  }

  /* Responsive: Two column layout (600px-959px) - prioritize right column */
  @container preview (min-width: 600px) and (max-width: 959px) {
    .dramark-preview .dm-row {
      grid-template-columns: 200px 1fr 200px;
    }

    .dramark-preview[data-has-left="false"] .dm-row {
      grid-template-columns: 0 1fr 200px;
    }

    .dramark-preview[data-has-right="false"] .dm-row {
      grid-template-columns: 200px 1fr 0;
    }

    .dramark-preview[data-has-left="false"][data-has-right="false"] .dm-row {
      grid-template-columns: 0 1fr 0;
    }
  }

  /* Single column layout (<=600px) */
  @container preview (max-width: 599px) {
    .dm-layout-desktop {
      display: none;
    }

    .dm-layout-mobile {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
    }
  }

  /* Switch Component */
  .dm-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
  }

  .dm-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .dm-switch-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 20px;
  }

  .dm-switch-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .dm-switch input:checked + .dm-switch-slider {
    background-color: var(--dm-character, #555);
  }

  .dm-switch input:checked + .dm-switch-slider:before {
    transform: translateX(20px);
  }

  /* Print Optimizations */
  @media print {
    /* Hide export panel when printing */
    .dm-export-panel {
      display: none !important;
    }

    body {
      padding: 0 !important;
      background: white !important;
    }

    .dramark-layout {
      padding: 0 !important;
      max-width: none !important;
    }

    /* Song container: change background to border */
    .dm-song-container {
      border: 1px solid #ccc !important;
      border-radius: 4px !important;
      padding: 8px !important;
      margin: 8px 0 !important;
    }

    .dm-song-container::before {
      display: none !important;
    }

    /* Ensure proper page breaks */
    .dm-character {
      break-inside: avoid;
    }

    .dm-song-container {
      break-inside: avoid;
    }

    .dm-comment {
      break-inside: avoid;
    }

    .dm-tech-cue-block {
      break-inside: avoid;
    }

    /* Force background colors to print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>
${previewHTML}
${configHTML}

<script>
(function() {
  // Toggle config panel
  const trigger = document.querySelector('.dm-export-trigger');
  const content = document.querySelector('.dm-export-content');
  
  if (trigger && content) {
    trigger.addEventListener('click', function() {
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      trigger.setAttribute('aria-expanded', !isOpen);
    });
  }
  
  // Handle config changes
  function updateConfig() {
    const showTechCues = document.getElementById('showTechCues')?.checked ?? true;
    const showComments = document.getElementById('showComments')?.checked ?? true;
    const translationMode = document.getElementById('translationMode')?.value ?? 'bilingual';
    const translationLayout = document.getElementById('translationLayout')?.value ?? 'side-by-side';
    const theme = document.getElementById('theme')?.value ?? 'auto';
    
    // Update theme
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update preview attributes
    const preview = document.querySelector('.dramark-preview');
    if (preview) {
      preview.setAttribute('data-has-left', showTechCues);
      preview.setAttribute('data-has-right', showComments);
    }
    
    // Update translation layout
    document.querySelectorAll('.dm-translation').forEach(t => {
      t.setAttribute('data-layout', translationLayout);
    });
    
    // Show/hide side columns based on config
    document.querySelectorAll('.dm-row-left').forEach(el => {
      el.style.visibility = showTechCues ? 'visible' : 'hidden';
    });
    document.querySelectorAll('.dm-row-right').forEach(el => {
      el.style.visibility = showComments ? 'visible' : 'hidden';
    });
    
    // Show/hide comments in center when sidebar is hidden
    document.querySelectorAll('.dm-row-center .dm-comment').forEach(el => {
      el.style.display = showComments ? 'none' : '';
    });
    
    // Show/hide tech cues in center when sidebar is hidden
    document.querySelectorAll('.dm-row-center .dm-tech-cue-block').forEach(el => {
      el.style.display = showTechCues ? 'none' : '';
    });
    
    // Update translation visibility
    document.querySelectorAll('.dm-translation-source').forEach(el => {
      el.style.display = (translationMode === 'target-only') ? 'none' : '';
    });
    document.querySelectorAll('.dm-translation-target').forEach(el => {
      el.style.display = (translationMode === 'source-only') ? 'none' : '';
    });
  }
  
  // Attach event listeners
  document.querySelectorAll('[data-config]').forEach(input => {
    input.addEventListener('change', updateConfig);
  });
  
  // Initialize
  updateConfig();
  
  // Handle responsive layout: move side-only blocks to center on narrow screens
  // Matches CSS container query breakpoints:
  // - >=960px: 3 columns
  // - 600-959px: 2 columns (prioritize right)
  // - <600px: 1 column
  function handleResponsiveLayout() {
    const preview = document.querySelector('.dramark-preview');
    if (!preview) return;
    
    // Get container width (matches @container preview)
    const containerWidth = preview.getBoundingClientRect().width;
    const isWide = containerWidth >= 960;
    const isMedium = containerWidth >= 600 && containerWidth < 960;
    const isNarrow = containerWidth < 600;
    const preview = document.querySelector('.dramark-preview');
    const hasLeft = preview?.getAttribute('data-has-left') === 'true';
    const hasRight = preview?.getAttribute('data-has-right') === 'true';
    
    const hasLeft = preview.getAttribute('data-has-left') === 'true';
    const hasRight = preview.getAttribute('data-has-right') === 'true';
    
    // Determine which sidebars are visible based on container width and config
    // >=960px: 3 columns - show all visible sidebars
    // 600-959px: 2 columns - hide left sidebar (CSS prioritizes right)
    // <600px: 1 column - hide both sidebars
    const showLeftColumn = isWide && hasLeft;
    const showRightColumn = (isWide || isMedium) && hasRight;
    
    // Process each row
    document.querySelectorAll('.dm-row').forEach(row => {
      const leftCell = row.querySelector('.dm-row-left');
      const centerCell = row.querySelector('.dm-row-center');
      const rightCell = row.querySelector('.dm-row-right');
      
      if (!centerCell) return;
      
      const hasLeftContent = leftCell && !leftCell.classList.contains('dm-row-empty') && leftCell.children.length > 0;
      const hasCenterContent = centerCell && !centerCell.classList.contains('dm-row-empty') && centerCell.children.length > 0;
      const hasRightContent = rightCell && !rightCell.classList.contains('dm-row-empty') && rightCell.children.length > 0;
      
      // Function to ensure content is cloned to center
      const ensureClonedToCenter = (sourceCell) => {
        if (!centerCell.dataset.clonedFrom?.includes(sourceCell.className)) {
          Array.from(sourceCell.children).forEach(child => {
            const clone = child.cloneNode(true);
            clone.dataset.cloned = 'true';
            centerCell.appendChild(clone);
          });
          const clonedFrom = centerCell.dataset.clonedFrom || '';
          centerCell.dataset.clonedFrom = clonedFrom + ' ' + sourceCell.className;
        }
      };
      
      // Clear cloned content when not needed
      const clearClonedContent = () => {
        centerCell.querySelectorAll('[data-cloned="true"]').forEach(el => el.remove());
        delete centerCell.dataset.clonedFrom;
      };
      
      // Case 1: Only left content, no center content
      if (hasLeftContent && !hasCenterContent) {
        if (!showLeftColumn) {
          // Left column hidden, show in center
          ensureClonedToCenter(leftCell);
          leftCell.style.display = 'none';
          centerCell.style.display = '';
        } else {
          // Left column visible
          clearClonedContent();
          leftCell.style.display = '';
          centerCell.style.display = 'none';
        }
      }
      
      // Case 2: Only right content, no center content
      if (hasRightContent && !hasCenterContent) {
        if (!showRightColumn) {
          // Right column hidden, show in center
          ensureClonedToCenter(rightCell);
          rightCell.style.display = 'none';
          centerCell.style.display = '';
        } else {
          // Right column visible
          clearClonedContent();
          rightCell.style.display = '';
          centerCell.style.display = 'none';
        }
      }
      
      // Case 3: Both left and right content, no center content
      if (hasLeftContent && hasRightContent && !hasCenterContent) {
        if (!showLeftColumn && !showRightColumn) {
          // Both columns hidden, show both in center
          ensureClonedToCenter(leftCell);
          ensureClonedToCenter(rightCell);
          leftCell.style.display = 'none';
          rightCell.style.display = 'none';
          centerCell.style.display = '';
        } else if (!showLeftColumn) {
          // Only left hidden
          clearClonedContent();
          ensureClonedToCenter(leftCell);
          leftCell.style.display = 'none';
          rightCell.style.display = '';
          centerCell.style.display = '';
        } else if (!showRightColumn) {
          // Only right hidden
          clearClonedContent();
          ensureClonedToCenter(rightCell);
          leftCell.style.display = '';
          rightCell.style.display = 'none';
          centerCell.style.display = '';
        } else {
          // Both visible
          clearClonedContent();
          leftCell.style.display = '';
          rightCell.style.display = '';
          centerCell.style.display = 'none';
        }
      }
    });
  }
  
  // Use ResizeObserver to watch container size changes
  const preview = document.querySelector('.dramark-preview');
  if (preview && window.ResizeObserver) {
    const resizeObserver = new ResizeObserver((entries) => {
      handleResponsiveLayout();
    });
    resizeObserver.observe(preview);
  } else {
    // Fallback to window resize
    window.addEventListener('resize', handleResponsiveLayout);
  }
  
  // Initial call
  handleResponsiveLayout();
})();
</script>
</body>
</html>`;

    // 让用户选择保存路径
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
      return; // 用户取消了
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

  private createExportConfigPanelHTML(): string {
    const { config, configOpen } = this;
    const effectiveTheme = this.resolveThemeMode();

    // Settings icon SVG
    const settingsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`;

    const configContent = `
      <div class="dm-export-content" id="configContent" style="display: ${configOpen ? 'block' : 'none'};">
        <div class="dm-export-item">
          <span class="dm-export-label">Tech Cues</span>
          <label class="dm-switch">
            <input type="checkbox" id="showTechCues" data-config="showTechCues" ${config.showTechCues ? 'checked' : ''}>
            <span class="dm-switch-slider"></span>
          </label>
        </div>

        <div class="dm-export-item">
          <span class="dm-export-label">Comments</span>
          <label class="dm-switch">
            <input type="checkbox" id="showComments" data-config="showComments" ${config.showComments ? 'checked' : ''}>
            <span class="dm-switch-slider"></span>
          </label>
        </div>

        <div class="dm-export-item">
          <span class="dm-export-label">Translation</span>
          <select id="translationMode" data-config="translationMode">
            <option value="source-only" ${config.translationMode === 'source-only' ? 'selected' : ''}>Source Only</option>
            <option value="target-only" ${config.translationMode === 'target-only' ? 'selected' : ''}>Target Only</option>
            <option value="bilingual" ${config.translationMode === 'bilingual' ? 'selected' : ''}>Bilingual</option>
          </select>
        </div>

        <div class="dm-export-item">
          <span class="dm-export-label">Layout</span>
          <select id="translationLayout" data-config="translationLayout">
            <option value="stack" ${config.translationLayout === 'stack' ? 'selected' : ''}>Stack</option>
            <option value="side-by-side" ${config.translationLayout === 'side-by-side' ? 'selected' : ''}>Side by Side</option>
          </select>
        </div>

        <div class="dm-export-item">
          <span class="dm-export-label">Theme</span>
          <select id="theme" data-config="theme">
            <option value="auto" ${effectiveTheme === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="light" ${effectiveTheme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${effectiveTheme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>

        <div class="dm-export-item dm-export-print">
          <button class="dm-export-print-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print / Save PDF
          </button>
        </div>
      </div>
    `;

    return `
      <div class="dm-export-panel">
        <button class="dm-export-trigger" id="configTrigger" aria-label="Settings" aria-expanded="${configOpen}">
          ${settingsIcon}
        </button>
        ${configContent}
      </div>
    `;
  }
}
