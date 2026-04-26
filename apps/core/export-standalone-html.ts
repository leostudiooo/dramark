import serialize from 'serialize-javascript';
import type { PreviewConfig } from './render/types.js';
import { createConfigPanelHTML, settingsGearSvg } from './components/ConfigPanel.js';

interface BuildStandaloneExportHtmlParams {
  ast: unknown;
  techConfig: unknown;
  initialConfig: PreviewConfig;
  initialTheme: string;
  previewCss: string;
  overrideCss: string;
  rendererJs: string;
  config: PreviewConfig;
  configOpen: boolean;
}

export function buildStandaloneExportHtml(params: BuildStandaloneExportHtmlParams): string {
  const {
    ast,
    techConfig,
    initialConfig,
    initialTheme,
    previewCss,
    overrideCss,
    rendererJs,
    config,
    configOpen,
  } = params;

  const safeAst = serialize(ast, { isJSON: true });
  const safeTechConfig = serialize(techConfig, { isJSON: true });
  const safeInitialConfig = serialize(initialConfig, { isJSON: true });

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
  ${overrideCss}
</style>
</head>
<body>
<div id="preview-container"></div>
${createExportConfigPanelHTML(config, configOpen, initialTheme)}

<script>
// Embedded DraMark Renderer
${rendererJs}

// Document data
const AST = ${safeAst};
const TECH_CONFIG = ${safeTechConfig};
let CURRENT_CONFIG = ${safeInitialConfig};

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
  const nextConfig = {};
  document.querySelectorAll('[data-config]').forEach((input) => {
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) {
      return;
    }
    const key = input.dataset.config;
    if (!key) {
      return;
    }
    nextConfig[key] = input.type === 'checkbox' ? input.checked : input.value;
  });

  CURRENT_CONFIG = {
    ...CURRENT_CONFIG,
    ...nextConfig,
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

function createExportConfigPanelHTML(config: PreviewConfig, configOpen: boolean, effectiveTheme: string): string {
  const settingsIcon = settingsGearSvg;

  const printItemHtml = `
    <div class="dm-config-item dm-export-print">
      <button class="dm-export-print-btn" onclick="window.print()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save PDF
      </button>
    </div>
  `;

  return createConfigPanelHTML(
    {
      config,
      isOpen: configOpen,
      onChange: () => undefined,
      onToggle: () => undefined,
    },
    {
      triggerAriaLabel: 'Settings',
      triggerId: 'configTrigger',
      contentId: 'configContent',
      triggerIconHtml: settingsIcon,
      includePrintThemeOption: true,
      themeValue: effectiveTheme as PreviewConfig['theme'],
      keepContentMounted: true,
      extraItemsHtml: printItemHtml,
    },
  );
}
