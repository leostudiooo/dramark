import type { PreviewConfig } from './render/types.js';

interface BuildStandaloneExportHtmlParams {
  astJson: string;
  techConfigJson: string;
  initialConfigJson: string;
  initialTheme: string;
  previewCss: string;
  rendererJs: string;
  config: PreviewConfig;
  configOpen: boolean;
}

export function buildStandaloneExportHtml(params: BuildStandaloneExportHtmlParams): string {
  const {
    astJson,
    techConfigJson,
    initialConfigJson,
    initialTheme,
    previewCss,
    rendererJs,
    config,
    configOpen,
  } = params;

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
  ${getExportCSS()}
</style>
</head>
<body>
<div id="preview-container"></div>
${createExportConfigPanelHTML(config, configOpen, initialTheme)}

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
  document.querySelectorAll('.dm-translation-source').forEach((el) => {
    el.style.display = (CURRENT_CONFIG.translationMode === 'target-only') ? 'none' : '';
  });
  document.querySelectorAll('.dm-translation-target').forEach((el) => {
    el.style.display = (CURRENT_CONFIG.translationMode === 'source-only') ? 'none' : '';
  });
}

// Config panel toggle
document.getElementById('configTrigger')?.addEventListener('click', function() {
  const content = document.getElementById('configContent');
  if (content) {
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    this.setAttribute('aria-expanded', String(!isOpen));
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
document.querySelectorAll('[data-config]').forEach((input) => {
  input.addEventListener('change', handleConfigChange);
});

// Initial render
renderPreview();
</script>
</body>
</html>`;
}

function getExportCSS(): string {
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
    '',
    '  html, body, .dramark-preview, .dramark-layout,',
    '  .dm-tech-cue-block, .dm-inline-tech-cue, .dm-song-container,',
    '  .dm-character, .dm-global-action, .dm-comment, .dm-translation {',
    '    -webkit-print-color-adjust: exact !important;',
    '    print-color-adjust: exact !important;',
    '  }',
    '',
    '  body,',
    '  .dramark-preview {',
    '    font-family: Georgia, "Times New Roman", serif !important;',
    '  }',
    '',
    '  body {',
    '    padding: 1rem !important;',
    '    background: white !important;',
    '    color: #1a1a1a !important;',
    '  }',
    '',
    '  .dramark-layout {',
    '    padding: 1rem !important;',
    '    max-width: none !important;',
    '  }',
    '',
    '  .dm-song-container {',
    '    box-decoration-break: clone;',
    '    -webkit-box-decoration-break: clone;',
    '  }',
    '  .dm-song-container::before { display: none !important; }',
    '',
    '  .dm-song-container[data-mode="sung"] {',
    '    --dm-print-border: #c4a86a;',
    '    border: 1px solid var(--dm-print-border) !important;',
    '    border-radius: 4px !important;',
    '    padding: 0.5rem 0.75rem !important;',
    '    margin: 0.5rem 0 !important;',
    '  }',
    '',
    '  .dm-song-container[data-mode="spoken"] {',
    '    --dm-print-border: #8a9aaa;',
    '    border: 1px dashed var(--dm-print-border) !important;',
    '    border-radius: 4px !important;',
    '    padding: 0.35rem 0.5rem !important;',
    '    margin: 0.35rem 0 !important;',
    '    background: transparent !important;',
    '  }',
    '',
    '  .dm-song-title { break-after: avoid; }',
    '',
    '  .dm-character,',
    '  .dm-tech-cue-block,',
    '  .dm-comment,',
    '  .dm-translation {',
    '    break-inside: avoid;',
    '  }',
    '',
    '  .dm-character-name { color: #b45309 !important; }',
    '  .dm-comment { color: #6b7280 !important; }',
    '  .dm-tech-cue-header { color: #374151 !important; border-bottom-color: #d1d5db !important; }',
    '  .dm-tech-cue-content { color: #374151 !important; }',
    '  .dm-tech-cue-block { border-color: #9ca3af; background: #f5f5f5; }',
    '}',
  ].join('\n');
}

function createExportConfigPanelHTML(config: PreviewConfig, configOpen: boolean, effectiveTheme: string): string {
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
            <option value="print" ${effectiveTheme === 'print' ? 'selected' : ''}>Print</option>
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
