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
${rendererJs}

const AST = ${astJson};
const TECH_CONFIG = ${techConfigJson};
let CURRENT_CONFIG = ${initialConfigJson};

function renderPreview() {
  const result = DraMarkRenderer.render(AST, CURRENT_CONFIG, TECH_CONFIG);
  document.getElementById('preview-container').innerHTML = result.previewHTML;
  const cssEl = document.getElementById('dramark-preview-css');
  if (cssEl) {
    cssEl.textContent = result.css;
  }
  document.documentElement.setAttribute('data-theme', CURRENT_CONFIG.theme);
}

document.getElementById('configTrigger')?.addEventListener('click', function() {
  const content = document.getElementById('configContent');
  if (!content) return;
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  this.setAttribute('aria-expanded', String(!isOpen));
});

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

  renderPreview();
}

document.querySelectorAll('[data-config]').forEach((input) => {
  input.addEventListener('change', handleConfigChange);
});

renderPreview();
</script>
</body>
</html>`;
}

function getExportCSS(): string {
  return [
    'body { font-family: system-ui, -apple-system, sans-serif; background: var(--dm-bg); color: var(--dm-text); margin: 0; padding: 0; }',
    '.dm-export-panel { position: fixed; bottom: 16px; right: 16px; z-index: 1000; }',
    '.dm-export-trigger { width: 42px; height: 42px; border-radius: 50%; background: var(--dm-bg); color: var(--dm-text); border: 1px solid var(--dm-border); cursor: pointer; display: flex; align-items: center; justify-content: center; }',
    '.dm-export-content { position: absolute; bottom: 52px; right: 0; width: 280px; background: var(--dm-bg); border: 1px solid var(--dm-border); border-radius: 8px; padding: 12px; display: none; }',
    '.dm-export-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--dm-border); }',
    '.dm-export-item:last-child { border-bottom: none; }',
    '.dm-switch { position: relative; display: inline-block; width: 40px; height: 20px; }',
    '.dm-switch input { opacity: 0; width: 0; height: 0; }',
    '.dm-switch-slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: 0.3s; border-radius: 20px; }',
    '.dm-switch-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: 0.3s; border-radius: 50%; }',
    '.dm-switch input:checked + .dm-switch-slider { background-color: var(--dm-character, #555); }',
    '.dm-switch input:checked + .dm-switch-slider:before { transform: translateX(20px); }',
    '@media print { .dm-export-panel { display: none !important; } .dm-song-container { border: 1px solid #ccc !important; border-radius: 4px !important; padding: 8px !important; margin: 8px 0 !important; } .dm-song-container::before { display: none !important; } }',
  ].join('\n');
}

function createExportConfigPanelHTML(config: PreviewConfig, configOpen: boolean, effectiveTheme: string): string {
  const settingsIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>';
  return `<div class="dm-export-panel"><button class="dm-export-trigger" id="configTrigger" aria-label="Settings" aria-expanded="${configOpen}">${settingsIcon}</button><div class="dm-export-content" id="configContent" style="display: ${configOpen ? 'block' : 'none'};"><div class="dm-export-item"><span>Tech Cues</span><label class="dm-switch"><input type="checkbox" id="showTechCues" data-config="showTechCues" ${config.showTechCues ? 'checked' : ''}><span class="dm-switch-slider"></span></label></div><div class="dm-export-item"><span>Comments</span><label class="dm-switch"><input type="checkbox" id="showComments" data-config="showComments" ${config.showComments ? 'checked' : ''}><span class="dm-switch-slider"></span></label></div><div class="dm-export-item"><span>Translation</span><select id="translationMode" data-config="translationMode"><option value="source-only" ${config.translationMode === 'source-only' ? 'selected' : ''}>Source Only</option><option value="target-only" ${config.translationMode === 'target-only' ? 'selected' : ''}>Target Only</option><option value="bilingual" ${config.translationMode === 'bilingual' ? 'selected' : ''}>Bilingual</option></select></div><div class="dm-export-item"><span>Layout</span><select id="translationLayout" data-config="translationLayout"><option value="stack" ${config.translationLayout === 'stack' ? 'selected' : ''}>Stack</option><option value="side-by-side" ${config.translationLayout === 'side-by-side' ? 'selected' : ''}>Side by Side</option></select></div><div class="dm-export-item"><span>Theme</span><select id="theme" data-config="theme"><option value="auto" ${effectiveTheme === 'auto' ? 'selected' : ''}>Auto</option><option value="light" ${effectiveTheme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${effectiveTheme === 'dark' ? 'selected' : ''}>Dark</option></select></div><div class="dm-export-item"><button onclick="window.print()">Print / Save PDF</button></div></div></div>`;
}
