import * as vscode from 'vscode';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { PreviewConfig } from '../../../apps/core/index.js';
import {
  buildTechCueColorMap,
  buildStandaloneExportHtml,
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
      rendererJs: this.getStandaloneRendererJs(),
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

  private buildStandaloneExportHtml(astJson: string, techConfigJson: string, initialConfigJson: string, initialTheme: string, previewCss: string): string {
    const rendererJs = this.getStandaloneRendererJs();
    
    return `<!DOCTYPE html>
<html lang="en" data-theme="${initialTheme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DraMark Export</title>
<style id="dramark-preview-css">
  ${previewCss}
</style>
<style>
  ${this.getExportCSS()}
</style>
</head>
<body>
<div id="preview-container"></div>
${this.createExportConfigPanelHTML()}

<script>
// Embedded DraMark Renderer
${rendererJs}

// Document data
const AST = ${astJson};
const TECH_CONFIG = ${techConfigJson};
let CURRENT_CONFIG = ${initialConfigJson};

// Render function
function renderPreview() {
  const result = DraMarkRenderer.render(AST, CURRENT_CONFIG, TECH_CONFIG);
  document.getElementById('preview-container').innerHTML = result.previewHTML;
  
  // Update CSS
  const cssEl = document.getElementById('dramark-preview-css');
  if (cssEl) {
    cssEl.textContent = result.css;
  }
  
  // Update theme on document element
  document.documentElement.setAttribute('data-theme', CURRENT_CONFIG.theme);
  
  // Apply translation visibility
  updateTranslationVisibility();
}

function updateTranslationVisibility() {
  document.querySelectorAll('.dm-translation-source').forEach(el => {
    el.style.display = (CURRENT_CONFIG.translationMode === 'target-only') ? 'none' : '';
  });
  document.querySelectorAll('.dm-translation-target').forEach(el => {
    el.style.display = (CURRENT_CONFIG.translationMode === 'source-only') ? 'none' : '';
  });
}

// Config panel toggle
document.getElementById('configTrigger')?.addEventListener('click', function() {
  const content = document.getElementById('configContent');
  if (content) {
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    this.setAttribute('aria-expanded', !isOpen);
  }
});

// Config change handlers
function handleConfigChange() {
  const showTechCues = document.getElementById('showTechCues')?.checked ?? true;
  const showComments = document.getElementById('showComments')?.checked ?? true;
  const translationMode = document.getElementById('translationMode')?.value ?? 'bilingual';
  const translationLayout = document.getElementById('translationLayout')?.value ?? 'side-by-side';
  const theme = document.getElementById('theme')?.value ?? 'auto';
  
  CURRENT_CONFIG = {
    ...CURRENT_CONFIG,
    showTechCues,
    showComments,
    translationMode,
    translationLayout,
    theme,
  };
  
  // Re-render with new config
  renderPreview();
}

// Attach listeners
document.querySelectorAll('[data-config]').forEach(input => {
  input.addEventListener('change', handleConfigChange);
});

// Initial render
renderPreview();
</script>
</body>
</html>`;
  }

  private getStandaloneRendererJs(): string {
    // Return the complete renderer JavaScript code as a string
    // This is the browser-compatible version of the render pipeline
    return `const DraMarkRenderer = (function() {
  // Theme
  const defaultTheme = {
    light: {
      background: '#ffffff',
      sungBackground: '#faf8f5',
      spokenBackground: '#f5f7fa',
      text: '#1a1a1a',
      textMuted: '#666666',
      border: '#e0e0e0',
      characterName: '#d97706',
      techCueBorder: '#888888',
      commentText: '#6b7280',
    },
    dark: {
      background: '#1a1a1a',
      sungBackground: '#2a2520',
      spokenBackground: '#1f2428',
      text: '#e0e0e0',
      textMuted: '#999999',
      border: '#404040',
      characterName: '#f59e0b',
      techCueBorder: '#aaaaaa',
      commentText: '#9ca3af',
    },
  };

  function getColorScheme(theme, colorScheme) {
    return colorScheme === 'dark' ? theme.dark : theme.light;
  }

  // Tech cue utilities
  function matchTechCue(payload, colorMap) {
    const firstToken = extractFirstToken(payload).toLowerCase();
    
    // Priority 1: Match category name
    const categoryColor = colorMap.categories.get(firstToken);
    if (categoryColor) {
      return { category: firstToken, color: categoryColor };
    }
    
    // Priority 2: Match entry id
    const entryColor = colorMap.entries.get(firstToken);
    if (entryColor) {
      return { category: 'unknown', color: entryColor, entryId: firstToken };
    }
    
    // Priority 3: Use fallback color
    return { category: 'unknown', color: colorMap.fallbackColor };
  }

  function extractFirstToken(payload) {
    const trimmed = payload.trim();
    const tokenMatch = trimmed.match(/^[^\s:]+/u);
    if (tokenMatch) {
      return tokenMatch[0];
    }
    return trimmed;
  }

  function buildTechCueColorMap(techConfig) {
    const categories = new Map();
    const entries = new Map();
    const fallbackColor = (techConfig && techConfig.color) ? techConfig.color : '#888888';

    if (!techConfig) {
      return { categories, entries, fallbackColor };
    }

    for (const [key, value] of Object.entries(techConfig)) {
      if (key === 'mics' || key === 'color' || key === 'keywords') {
        continue;
      }

      if (isTechCategory(value)) {
        // Dynamic category with color and entries
        if (value.color) {
          categories.set(key.toLowerCase(), value.color);
        }
        
        if (value.entries) {
          for (const entry of value.entries) {
            if (typeof entry.id === 'string') {
              const entryColor = typeof entry.color === 'string' ? entry.color : value.color;
              if (entryColor) {
                entries.set(entry.id.toLowerCase(), entryColor);
              }
            }
          }
        }
      } else if (Array.isArray(value)) {
        // Legacy array format - entries without explicit category
        for (const entry of value) {
          if (isTechEntry(entry) && typeof entry.color === 'string') {
            entries.set(entry.id.toLowerCase(), entry.color);
          }
        }
      }
    }

    return { categories, entries, fallbackColor };
  }

  function isTechCategory(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return 'color' in value || 'entries' in value;
  }

  function isTechEntry(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return 'id' in value && typeof value.id === 'string';
  }

  // AST conversion
  function convertAstToRenderBlocks(context) {
    const blocks = [];
    const ast = context.ast;
    
    if (!ast.children || !Array.isArray(ast.children)) {
      return blocks;
    }

    for (const node of ast.children) {
      const block = convertNode(node, context, 'spoken');
      if (block) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  function convertNode(node, context, performanceMode) {
    if (!node || typeof node !== 'object') return null;

    const nodeType = node.type;
    switch (nodeType) {
      case 'character-block':
        return convertCharacterBlock(node, context, performanceMode);
      case 'song-container':
        return convertSongContainer(node, context);
      case 'spoken-segment':
        return convertSpokenSegment(node, context);
      case 'block-tech-cue':
        return convertBlockTechCue(node, context, performanceMode);
      case 'comment-line':
        return convertCommentLine(node, context, performanceMode);
      case 'comment-block':
        return convertCommentBlock(node, context, performanceMode);
      case 'paragraph':
      case 'list':
      case 'blockquote':
        return convertStandaloneGlobalContent(node, context, performanceMode);
      case 'thematicBreak':
        return { type: 'thematic-break', performanceMode };
      case 'heading':
        return convertHeading(node, context, performanceMode);
      default:
        return null;
    }
  }

  function convertCharacterBlock(node, context, performanceMode) {
    const names = Array.isArray(node.names) ? node.names : [String(node.name || 'Unknown')];
    const contextStr = node.mood ? String(node.mood) : (node.context ? String(node.context) : undefined);
    
    const content = [];
    const techCues = [];
    const comments = [];

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child?.type === 'comment-line') {
          comments.push(convertCommentLine(child, context, performanceMode));
          continue;
        }
        if (child?.type === 'comment-block') {
          comments.push(convertCommentBlock(child, context, performanceMode));
          continue;
        }
        const result = convertContentNode(child, context);
        if (result) {
          if (result.isTechCue) {
            techCues.push(result.data);
          } else {
            content.push(result.data);
          }
        }
      }
    }

    return {
      type: 'character',
      names,
      context: contextStr,
      content,
      techCues,
      comments,
      performanceMode,
    };
  }

  function convertContentNode(node, context) {
    if (!node || typeof node !== 'object') return null;

    const nodeType = node.type;
    switch (nodeType) {
      case 'paragraph':
        return {
          isTechCue: false,
          data: {
            type: 'paragraph',
            children: collectInlineChildren(node, context),
          },
        };
      case 'list':
        return {
          isTechCue: false,
          data: {
            type: 'list',
            children: collectInlineChildren(node, context),
          },
        };
      case 'blockquote':
        return {
          isTechCue: false,
          data: {
            type: 'blockquote',
            children: collectInlineChildren(node, context),
          },
        };
      case 'translation-pair':
        return {
          isTechCue: false,
          data: {
            type: 'translation',
            children: [],
            sourceText: String(node.sourceText || ''),
            targetText: extractTextContent(node.target),
          },
        };
      case 'inline-action':
        return {
          isTechCue: false,
          data: { type: 'text', value: String(node.value || '') },
        };
      case 'inline-song':
        return {
          isTechCue: false,
          data: { type: 'inline-song', value: String(node.value || '') },
        };
      case 'inline-spoken':
        return {
          isTechCue: false,
          data: { type: 'inline-spoken', value: String(node.value || '') },
        };
      case 'inline-tech-cue':
        if (!context.config.showTechCues) return null;
        const payload = String(node.payload || node.value || '');
        const match = matchTechCue(payload, context.techColorMap);
        return {
          isTechCue: true,
          data: { payload, color: match.color },
        };
      default:
        return null;
    }
  }

  function convertInlineChild(node, context) {
    if (!node || typeof node !== 'object') return null;

    const nodeType = node.type;
    switch (nodeType) {
      case 'text':
        return { type: 'text', value: String(node.value || '') };
      case 'break':
        return { type: 'break' };
      case 'emphasis':
        return { type: 'emphasis', children: extractTextChildren(node.children) };
      case 'strong':
        return { type: 'strong', children: extractTextChildren(node.children) };
      case 'inline-action':
        return { type: 'inline-action', value: String(node.value || '') };
      case 'inline-song':
        return { type: 'inline-song', value: String(node.value || '') };
      case 'image':
        return {
          type: 'image',
          url: String(node.url || ''),
          alt: extractTextContent(node.alt ?? node.children),
          title: typeof node.title === 'string' ? node.title : undefined,
        };
      case 'inline-spoken':
        return { type: 'inline-spoken', value: String(node.value || '') };
      case 'inline-tech-cue':
        if (!context.config.showTechCues) return null;
        const tcPayload = String(node.payload || node.value || '');
        const tcMatch = matchTechCue(tcPayload, context.techColorMap);
        return { type: 'inline-tech-cue', payload: tcPayload, color: tcMatch.color };
      default:
        return null;
    }
  }

  function collectInlineChildren(node, context) {
    const collected = [];
    function walk(current) {
      if (!current || typeof current !== 'object') return;
      const converted = convertInlineChild(current, context);
      if (converted !== null) {
        collected.push(converted);
        return;
      }
      const children = current.children;
      if (Array.isArray(children)) {
        for (const child of children) walk(child);
      }
    }
    walk(node);
    return collected;
  }

  function extractTextChildren(children) {
    if (!Array.isArray(children)) return [];
    return children
      .filter(child => child && typeof child === 'object' && child.type === 'text')
      .map(child => ({ type: 'text', value: String(child.value || '') }));
  }

  function extractTextContent(children) {
    if (!Array.isArray(children)) return '';
    return children
      .map(child => {
        if (typeof child === 'string') return child;
        if (child && typeof child === 'object') {
          if (child.value && typeof child.value === 'string') return child.value;
          if (child.children) return extractTextContent(child.children);
        }
        return '';
      })
      .join('');
  }

  function convertSongContainer(node, context) {
    const title = node.title ? String(node.title) : undefined;
    const children = [];

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const converted = convertNode(child, context, 'sung');
        if (converted) children.push(converted);
      }
    }

    return {
      type: 'song-container',
      title,
      children,
      performanceMode: 'sung',
    };
  }

  function convertSpokenSegment(node, context) {
    const children = [];

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const converted = convertNode(child, context, 'spoken');
        if (converted) children.push(converted);
      }
    }

    return {
      type: 'song-container',
      title: undefined,
      children,
      performanceMode: 'spoken',
    };
  }

  function convertBlockTechCue(node, context, performanceMode) {
    const payload = String(node.value || node.payload || '');
    const header = node.header
      ? String(node.header)
      : (payload.trim().split(/\\s+/)[0] || undefined);
    const match = matchTechCue(payload, context.techColorMap);

    return {
      type: 'tech-cue',
      variant: 'block',
      header,
      payload,
      color: match.color,
      performanceMode,
    };
  }

  function convertStandaloneGlobalContent(node, context, performanceMode) {
    const result = convertContentNode(node, context);
    if (!result || result.isTechCue) return null;
    return {
      type: 'global-action',
      content: [result.data],
      performanceMode,
    };
  }

  function convertCommentLine(node, context, performanceMode) {
    return {
      type: 'comment',
      variant: 'line',
      content: String(node.value || ''),
      performanceMode,
    };
  }

  function convertCommentBlock(node, context, performanceMode) {
    return {
      type: 'comment',
      variant: 'block',
      content: String(node.value || ''),
      performanceMode,
    };
  }

  function convertHeading(node, context, performanceMode) {
    const depth = typeof node.depth === 'number' ? node.depth : 1;
    const content = extractTextContent(node.children);
    return { type: 'heading', depth, content, performanceMode };
  }

  // Layout building
  function buildColumnarLayout(blocks, context) {
    const left = [];
    const center = [];
    const right = [];
    const rows = [];
    const pendingSideBlocks = [];

    function flushPendingSideBlocks() {
      for (const item of pendingSideBlocks) {
        if (item.side === 'left') {
          left.push(item.block);
          rows.push({ left: item.block, center: null, right: null });
        } else {
          right.push(item.block);
          rows.push({ left: null, center: null, right: item.block });
        }
      }
      pendingSideBlocks.length = 0;
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.type === 'song-container') {
        flushPendingSideBlocks();
        const separated = separateSongContainerSideBlocks(block);
        const visibleTechCues = context.config.showTechCues ? separated.techCues : [];
        const visibleComments = context.config.showComments ? separated.comments : [];

        center.push(separated.block);

        const rowLeft = [];
        const rowRight = [];

        for (const techCue of visibleTechCues) {
          left.push(techCue);
          rowLeft.push(techCue);
        }
        for (const comment of visibleComments) {
          right.push(comment);
          rowRight.push(comment);
        }

        if (rowLeft.length > 0 || rowRight.length > 0) {
          rows.push({
            left: rowLeft[0] ?? null,
            center: separated.block,
            right: rowRight[0] ?? null,
          });

          const maxExtra = Math.max(rowLeft.length - 1, rowRight.length - 1);
          for (let j = 1; j <= maxExtra; j++) {
            rows.push({
              left: rowLeft[j] ?? null,
              center: null,
              right: rowRight[j] ?? null,
            });
          }
        } else {
          rows.push({ left: null, center: separated.block, right: null });
        }
        continue;
      }

      if (block.type === 'character') {
        flushPendingSideBlocks();
        center.push(block);

        const visibleComments = context.config.showComments ? block.comments : [];
        for (const comment of visibleComments) {
          right.push(comment);
        }

        if (visibleComments.length > 0) {
          rows.push({
            left: null,
            center: block,
            right: visibleComments[0],
          });

          for (let j = 1; j < visibleComments.length; j++) {
            rows.push({
              left: null,
              center: null,
              right: visibleComments[j],
            });
          }
        } else {
          rows.push({ left: null, center: block, right: null });
        }
        continue;
      }

      if (block.type === 'tech-cue' && block.variant === 'block') {
        if (context.config.showTechCues) {
          pendingSideBlocks.push({ side: 'left', block });
        }
        continue;
      }

      if (block.type === 'tech-cue' && block.variant === 'inline') {
        if (context.config.showTechCues) {
          flushPendingSideBlocks();
          center.push(block);
          rows.push({ left: null, center: block, right: null });
        }
        continue;
      }

      if (block.type === 'comment') {
        if (context.config.showComments) {
          pendingSideBlocks.push({ side: 'right', block });
        }
        continue;
      }

      flushPendingSideBlocks();
      center.push(block);
      rows.push({ left: null, center: block, right: null });
    }

    flushPendingSideBlocks();
    return { left, center, right, rows };
  }

  function separateSongContainerSideBlocks(block) {
    const techCues = [];
    const comments = [];
    const children = [];

    for (const child of block.children) {
      if (child.type === 'tech-cue' && child.variant === 'block') {
        techCues.push(child);
        continue;
      }
      if (child.type === 'comment') {
        comments.push(child);
        continue;
      }
      if (child.type === 'character') {
        if (child.comments.length > 0) {
          comments.push(...child.comments);
        }
        children.push(child);
        continue;
      }
      if (child.type === 'song-container') {
        const nested = separateSongContainerSideBlocks(child);
        children.push(nested.block);
        techCues.push(...nested.techCues);
        comments.push(...nested.comments);
        continue;
      }
      children.push(child);
    }

    return {
      block: { ...block, children },
      techCues,
      comments,
    };
  }

  // HTML Generation
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderInlineTechCue(tc) {
    const style = tc.color ? 'style="border-color: ' + tc.color + '; color: ' + tc.color + '; background: ' + tc.color + '15;"' : '';
    return '<span class="dm-inline-tech-cue" ' + style + '>' + escapeHtml(tc.payload) + '</span>';
  }

  function renderInlineChildren(children) {
    if (!Array.isArray(children)) return '';
    
    return children.map(child => {
      switch (child.type) {
        case 'text':
          return escapeHtml(child.value);
        case 'break':
          return '<br />';
        case 'emphasis':
          return '<em>' + child.children?.map(c => escapeHtml(c.value)).join('') + '</em>';
        case 'strong':
          return '<strong>' + child.children?.map(c => escapeHtml(c.value)).join('') + '</strong>';
        case 'inline-action':
          return '<span class="dm-inline-action">{' + escapeHtml(child.value || '') + '}</span>';
        case 'inline-song':
          return '<span class="dm-inline-song">' + escapeHtml(child.value || '') + '</span>';
        case 'image': {
          const url = escapeHtml(child.url || '');
          const alt = escapeHtml(child.alt || '');
          const titleAttr = child.title ? ' title="' + escapeHtml(child.title) + '"' : '';
          return '<img class="dm-inline-image" src="' + url + '" alt="' + alt + '"' + titleAttr + ' loading="lazy" />';
        }
        case 'inline-spoken':
          return '<span class="dm-inline-spoken">' + escapeHtml(child.value || '') + '</span>';
        case 'inline-tech-cue':
          return renderInlineTechCue({ payload: child.payload || '', color: child.color });
        default:
          return '';
      }
    }).join('');
  }

  function renderDialogueContent(content, config, performanceMode) {
    if (content.type === 'paragraph') {
      return '<p class="dm-paragraph">' + renderInlineChildren(content.children) + '</p>';
    }
    if (content.type === 'list') {
      return '<ul class="dm-list"><li>' + renderInlineChildren(content.children) + '</li></ul>';
    }
    if (content.type === 'blockquote') {
      return '<blockquote class="dm-blockquote"><p class="dm-paragraph">' + renderInlineChildren(content.children) + '</p></blockquote>';
    }
    if (content.type === 'translation') {
      const showSource = config.translationMode !== 'target-only';
      const showTarget = config.translationMode !== 'source-only';
      const sourceHtml = showSource ? '<div class="dm-translation-source">' + escapeHtml(content.sourceText || '') + '</div>' : '';
      const targetHtml = showTarget ? '<div class="dm-translation-target">' + escapeHtml(content.targetText || '') + '</div>' : '';
      if (!showSource && !showTarget) return '';
      return '<div class="dm-translation" data-layout="' + config.translationLayout + '">' + sourceHtml + targetHtml + '</div>';
    }
    return '';
  }

  function renderBlock(block, config) {
    switch (block.type) {
      case 'character':
        return renderCharacterBlock(block, config);
      case 'global-action':
        return renderGlobalActionBlock(block, config);
      case 'song-container':
        return renderSongContainerBlock(block, config);
      case 'tech-cue':
        return renderTechCueBlock(block);
      case 'comment':
        return renderCommentBlock(block);
      case 'thematic-break':
        return '<hr class="dm-thematic-break" />';
      case 'heading':
        return '<h' + block.depth + ' class="dm-heading" data-depth="' + block.depth + '">' + escapeHtml(block.content) + '</h' + block.depth + '>';
      default:
        return '';
    }
  }

  function renderCharacterBlock(block, config) {
    const namesHtml = block.names.map(name => '<span class="dm-character-name">' + escapeHtml(name) + '</span>').join('<span class="dm-character-sep"> </span>');
    const contextHtml = block.context ? '<div class="dm-character-context">[' + escapeHtml(block.context) + ']</div>' : '';
    const contentHtml = block.content.map(content => renderDialogueContent(content, config, block.performanceMode)).join('');
    const techCuesHtml = block.techCues.length > 0
      ? '<div class="dm-character-tech-cues">' + block.techCues.map(tc => renderInlineTechCue(tc)).join('') + '</div>'
      : '';

    return '<div class="dm-character" data-mode="' + block.performanceMode + '"><div class="dm-character-names"><div class="dm-character-name-row">' + namesHtml + '</div>' + contextHtml + '</div><div class="dm-character-content">' + contentHtml + techCuesHtml + '</div></div>';
  }

  function renderGlobalActionBlock(block, config) {
    const contentHtml = block.content.map(content => renderDialogueContent(content, config, block.performanceMode)).join('');
    return '<div class="dm-global-action" data-mode="' + block.performanceMode + '">' + contentHtml + '</div>';
  }

  function renderSongContainerBlock(block, config) {
    const titleHtml = block.title ? '<div class="dm-song-title">' + escapeHtml(block.title) + '</div>' : '';
    const childrenHtml = block.children.map(child => renderBlock(child, config)).join('');
    return '<div class="dm-song-container" data-mode="' + block.performanceMode + '">' + titleHtml + childrenHtml + '</div>';
  }

  function renderTechCueBlock(block) {
    const headerHtml = block.header ? '<div class="dm-tech-cue-header">' + escapeHtml(block.header) + '</div>' : '';
    const style = block.color ? 'style="border-color: ' + block.color + '; background: ' + block.color + '15;"' : '';
    return '<div class="dm-tech-cue-block" ' + style + ' data-mode="' + block.performanceMode + '">' + headerHtml + '<div class="dm-tech-cue-content">' + escapeHtml(block.payload) + '</div></div>';
  }

  function renderCommentBlock(block) {
    const variantClass = block.variant === 'block' ? 'dm-comment-block' : '';
    return '<div class="dm-comment ' + variantClass + '" data-mode="' + block.performanceMode + '">' + escapeHtml(block.content) + '</div>';
  }

  function renderDesktopRow(row, config, hasLeft, hasRight) {
    if (!row.left && !row.center && !row.right) return '';
    
    const leftHtml = hasLeft
      ? (row.left ? '<div class="dm-row-left">' + renderTechCueBlock(row.left) + '</div>' : '<div class="dm-row-left dm-row-empty" aria-hidden="true"></div>')
      : '<div class="dm-row-left dm-row-empty" aria-hidden="true"></div>';
    
    const centerHtml = row.center
      ? '<div class="dm-row-center">' + renderBlock(row.center, config) + '</div>'
      : '<div class="dm-row-center dm-row-empty" aria-hidden="true"></div>';
    
    const rightHtml = hasRight
      ? (row.right ? '<div class="dm-row-right">' + renderCommentBlock(row.right) + '</div>' : '<div class="dm-row-right dm-row-empty" aria-hidden="true"></div>')
      : '<div class="dm-row-right dm-row-empty" aria-hidden="true"></div>';
    
    return '<div class="dm-row" data-has-left="' + !!row.left + '" data-has-center="' + !!row.center + '" data-has-right="' + !!row.right + '">' + leftHtml + centerHtml + rightHtml + '</div>';
  }

  function renderTabletRow(row, config) {
    const centerParts = [];
    if (row.left !== null) {
      centerParts.push(renderTechCueBlock(row.left));
    }
    if (row.center !== null) {
      centerParts.push(renderBlock(row.center, config));
    }
    
    const centerHtml = centerParts.length > 0
      ? '<div class="dm-row-center">' + centerParts.join('') + '</div>'
      : '<div class="dm-row-center dm-row-empty" aria-hidden="true"></div>';
    
    const rightHtml = row.right !== null
      ? '<div class="dm-row-right">' + renderCommentBlock(row.right) + '</div>'
      : '<div class="dm-row-right dm-row-empty" aria-hidden="true"></div>';
    
    return '<div class="dm-row" data-has-left="' + !!row.left + '" data-has-center="' + !!row.center + '" data-has-right="' + !!row.right + '">' + centerHtml + rightHtml + '</div>';
  }

  function renderMobileRow(row, config) {
    const htmlParts = [];
    if (row.center !== null) {
      htmlParts.push(renderBlock(row.center, config));
    }
    if (row.left !== null) {
      htmlParts.push(renderTechCueBlock(row.left));
    }
    if (row.right !== null) {
      htmlParts.push(renderCommentBlock(row.right));
    }
    return htmlParts.join('');
  }

  function createPreviewHTML(layout, config) {
    const hasLeft = config.showTechCues && layout.left.length > 0;
    const hasRight = config.showComments && layout.right.length > 0;
    const columnCount = hasLeft && hasRight ? 3 : hasLeft || hasRight ? 2 : 1;

    return '<div class="dramark-preview" data-theme="' + config.theme + '" data-columns="' + columnCount + '" data-has-left="' + hasLeft + '" data-has-right="' + hasRight + '"><div class="dramark-layout dm-layout-desktop">' + layout.rows.map(row => renderDesktopRow(row, config, hasLeft, hasRight)).join('') + '</div><div class="dramark-layout dm-layout-tablet"><div class="dm-layout-tablet-inner">' + layout.rows.map(row => renderTabletRow(row, config)).join('') + '</div></div><div class="dramark-layout dm-layout-mobile"><div class="dramark-center">' + layout.rows.map(row => renderMobileRow(row, config)).join('') + '</div></div></div>';
  }

  // CSS Generation
  function generateCSS(theme, config) {
    const isDark = config.theme === 'dark' || 
      (config.theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const colors = getColorScheme(theme, isDark ? 'dark' : 'light');
    
    return \`/* DraMark Preview Styles */
:root, .dramark-preview {
  --dm-bg: \${colors.background};
  --dm-sung-bg: \${colors.sungBackground};
  --dm-spoken-bg: \${colors.spokenBackground};
  --dm-text: \${colors.text};
  --dm-text-muted: \${colors.textMuted};
  --dm-border: \${colors.border};
  --dm-character: \${colors.characterName};
  --dm-tech-border: \${colors.techCueBorder};
  --dm-comment: \${colors.commentText};
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.4;
  container-type: inline-size;
  container-name: preview;
}

.dramark-layout {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.dm-layout-mobile, .dm-layout-tablet { display: none; }

.dm-row {
  display: grid;
  gap: 1.1rem;
  align-items: start;
  grid-template-columns: 200px 1fr 200px;
}

.dramark-preview[data-has-left="false"] .dm-row { grid-template-columns: 0 1fr 200px; }
.dramark-preview[data-has-right="false"] .dm-row { grid-template-columns: 200px 1fr 0; }
.dramark-preview[data-has-left="false"][data-has-right="false"] .dm-row { grid-template-columns: 0 1fr 0; }

.dm-row-left, .dm-row-center, .dm-row-right { min-width: 0; }
.dm-row-empty { min-height: 1.35rem; visibility: hidden; }
.dramark-preview[data-has-right="true"] .dm-row-center .dm-comment { display: none; }

@container preview (min-width: 600px) and (max-width: 959px) {
  .dm-layout-desktop { display: none; }
  .dm-layout-tablet { display: block; }
  .dm-layout-mobile { display: none; }
  .dm-layout-tablet-inner .dm-row {
    display: grid;
    gap: 1.5rem;
    align-items: start;
    grid-template-columns: 1fr 200px;
  }
  .dm-layout-tablet-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
  }
}

@container preview (max-width: 599px) {
  .dm-layout-desktop, .dm-layout-tablet { display: none; }
  .dm-layout-mobile { display: grid; grid-template-columns: 1fr; gap: 0.75rem; padding: 1rem; }
}

.dm-character {
  display: flex;
  gap: 0.6rem;
  margin: 0.5rem 0;
  padding: 0.15rem 0;
  border-radius: 4px;
}
.dm-character[data-mode="sung"], .dm-character[data-mode="spoken"] { background: transparent; }
.dm-character-names {
  width: 100px;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--dm-character);
  white-space: normal;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
}
.dm-character-name-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem; }
.dm-character-name { display: inline-block; }
.dm-character-sep { display: inline-block; width: 0.3rem; }
.dm-character-content { flex: 1; }
.dm-character-context { font-size: 0.875rem; color: var(--dm-text-muted); margin-top: 0; }
.dm-paragraph { margin: 0.35rem 0; white-space: pre-wrap; }
.dm-paragraph:first-child { margin-top: 0; }
.dm-paragraph:last-child { margin-bottom: 0; }
.dm-inline-action { font-style: italic; color: var(--dm-text-muted); }
.dm-inline-song { font-style: italic; background: rgba(196, 168, 106, 0.1); padding: 0 0.25rem; border-radius: 2px; }
.dm-inline-image { max-width: min(100%, 560px); height: auto; display: block; margin: 0.45rem 0; border-radius: 4px; }
.dm-inline-spoken { color: var(--dm-text-muted); font-style: normal; }
.dm-inline-tech-cue {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.125rem 0.5rem; border-radius: 3px;
  font-size: 0.75rem; font-family: monospace;
  border: 1px solid var(--dm-tech-border);
  background: rgba(128, 128, 128, 0.1);
}
.dm-tech-cue-block {
  border: 1px solid var(--dm-tech-border); border-radius: 4px;
  padding: 0.45rem 0.55rem; margin: 0.25rem 0;
  background: rgba(128, 128, 128, 0.05);
}
.dm-tech-cue-header {
  font-size: 0.75rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--dm-text-muted); margin-bottom: 0.25rem;
  padding-bottom: 0.15rem; border-bottom: 1px solid var(--dm-border);
}
.dm-tech-cue-content { font-family: monospace; font-size: 0.875rem; white-space: pre-wrap; }
.dm-song-container {
  border: 0; padding: 0; margin: 0.6rem 0;
  border-radius: 0; position: relative; isolation: isolate;
}
.dm-song-container::before {
  content: ""; position: absolute;
  left: -0.6rem; right: -0.6rem; top: -0.35rem; bottom: -0.35rem;
  z-index: -1;
}
.dm-song-container[data-mode="sung"]::before { background: var(--dm-sung-bg); }
.dm-song-container[data-mode="spoken"]::before { background: var(--dm-spoken-bg); }
.dm-song-title { font-weight: 600; font-size: 1rem; margin: 0.3rem 0 0.2rem; color: var(--dm-text-muted); }
.dm-comment {
  font-size: 0.875rem; color: var(--dm-comment); font-style: italic;
  white-space: pre-wrap; padding: 0.3rem 0.45rem;
  border-left: 2px solid var(--dm-border); margin: 0.35rem 0;
}
.dm-comment-block { background: rgba(128, 128, 128, 0.05); border-radius: 4px; padding: 0.45rem; }
.dm-thematic-break { border: none; border-top: 1px solid var(--dm-border); margin: 0.6rem 0; }
.dm-heading { margin: 0.65rem 0 0.35rem; font-weight: 600; line-height: 1.3; }
.dm-heading[data-depth="1"] { font-size: 1.5rem; }
.dm-heading[data-depth="2"] { font-size: 1.25rem; }
.dm-heading[data-depth="3"] { font-size: 1.1rem; }
.dm-global-action { margin: 0.35rem 0; padding: 0.2rem 0; font-style: italic; color: var(--dm-text-muted); }
.dm-translation { display: flex; gap: 1rem; margin: 0.5rem 0; }
.dm-translation[data-layout="stack"] { flex-direction: column; gap: 0.25rem; }
.dm-translation-source { flex: 1; font-style: italic; color: var(--dm-text-muted); min-width: 0; }
.dm-translation-target { flex: 1; min-width: 0; }

.dm-row-center, .dm-layout-mobile, .dm-layout-tablet-inner .dm-row-center {
  container-type: inline-size;
  container-name: translation-container;
}
@container translation-container (max-width: 480px) {
  .dm-translation[data-layout="side-by-side"] { flex-direction: column; gap: 0.25rem; }
}\`;
  }

  // Main render function
  function renderDraMark(ast, config, techConfig) {
    const techColorMap = buildTechCueColorMap(techConfig);
    const context = {
      ast,
      techConfig,
      config,
      theme: defaultTheme,
      techColorMap,
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);
    const previewHTML = createPreviewHTML(layout, config);
    const css = generateCSS(defaultTheme, config);

    return { previewHTML, css, layout };
  }

  return { render: renderDraMark, defaultTheme };
})();`;
  }

  private getExportCSS(): string {
    // CSS styles for exported HTML
    return [
      '/* DraMark Export Styles */',
      'body {',
      '  font-family: system-ui, -apple-system, sans-serif;',
      '  background: var(--dm-bg);',
      '  color: var(--dm-text);',
      '  margin: 0;',
      '  padding: 0;',
      '}',
      '',
      '/* Export Config Panel */',
      '.dm-export-panel {',
      '  position: fixed;',
      '  bottom: 16px;',
      '  right: 16px;',
      '  z-index: 1000;',
      '}',
      '',
      '.dm-export-trigger {',
      '  width: 42px;',
      '  height: 42px;',
      '  border-radius: 50%;',
      '  background: var(--dm-bg);',
      '  color: var(--dm-text);',
      '  border: 1px solid var(--dm-border);',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);',
      '  transition: transform 0.2s;',
      '}',
      '',
      '.dm-export-trigger:hover { transform: scale(1.05); }',
      '',
      '.dm-export-content {',
      '  position: absolute;',
      '  bottom: 52px;',
      '  right: 0;',
      '  width: 280px;',
      '  background: var(--dm-bg);',
      '  border: 1px solid var(--dm-border);',
      '  border-radius: 8px;',
      '  padding: 12px;',
      '  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);',
      '  display: none;',
      '}',
      '',
      '.dm-export-item {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  padding: 8px 0;',
      '  border-bottom: 1px solid var(--dm-border);',
      '}',
      '',
      '.dm-export-item:last-child { border-bottom: none; }',
      '.dm-export-label { font-size: 14px; color: var(--dm-text); }',
      '',
      '.dm-export-item select {',
      '  padding: 4px 8px;',
      '  border: 1px solid var(--dm-border);',
      '  border-radius: 4px;',
      '  background: var(--dm-bg);',
      '  color: var(--dm-text);',
      '  font-size: 14px;',
      '  min-width: 120px;',
      '}',
      '',
      '.dm-export-print { padding-top: 12px; }',
      '',
      '.dm-export-print-btn {',
      '  width: 100%;',
      '  padding: 10px;',
      '  border: 1px solid var(--dm-border);',
      '  border-radius: 6px;',
      '  background: var(--dm-bg);',
      '  color: var(--dm-text);',
      '  cursor: pointer;',
      '  font-size: 14px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 8px;',
      '}',
      '',
      '.dm-export-print-btn:hover { background: var(--dm-sung-bg); }',
      '',
      '/* Switch Component */',
      '.dm-switch {',
      '  position: relative;',
      '  display: inline-block;',
      '  width: 40px;',
      '  height: 20px;',
      '}',
      '',
      '.dm-switch input { opacity: 0; width: 0; height: 0; }',
      '',
      '.dm-switch-slider {',
      '  position: absolute;',
      '  cursor: pointer;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  background-color: #ccc;',
      '  transition: 0.3s;',
      '  border-radius: 20px;',
      '}',
      '',
      '.dm-switch-slider:before {',
      '  position: absolute;',
      '  content: "";',
      '  height: 16px;',
      '  width: 16px;',
      '  left: 2px;',
      '  bottom: 2px;',
      '  background-color: white;',
      '  transition: 0.3s;',
      '  border-radius: 50%;',
      '}',
      '',
      '.dm-switch input:checked + .dm-switch-slider {',
      '  background-color: var(--dm-character, #555);',
      '}',
      '',
      '.dm-switch input:checked + .dm-switch-slider:before {',
      '  transform: translateX(20px);',
      '}',
      '',
      '/* Print Optimizations */',
      '@media print {',
      '  .dm-export-panel { display: none !important; }',
      '  body { padding: 0 !important; background: white !important; }',
      '  .dramark-layout { padding: 0 !important; max-width: none !important; }',
      '  .dm-song-container {',
      '    border: 1px solid #ccc !important;',
      '    border-radius: 4px !important;',
      '    padding: 8px !important;',
      '    margin: 8px 0 !important;',
      '  }',
      '  .dm-song-container::before { display: none !important; }',
      '  .dm-character, .dm-song-container, .dm-comment, .dm-tech-cue-block {',
      '    break-inside: avoid;',
      '  }',
      '  * {',
      '    -webkit-print-color-adjust: exact !important;',
      '    print-color-adjust: exact !important;',
      '  }',
      '}',
    ].join('\n');
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
