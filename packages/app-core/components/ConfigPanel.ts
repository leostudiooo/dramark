import type { PreviewConfig, ThemeMode, TranslationDisplayMode, TranslationLayoutMode } from '../render/types.js';

export interface ConfigPanelProps {
  config: PreviewConfig;
  onChange: (config: PreviewConfig) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function createConfigPanelHTML(props: ConfigPanelProps): string {
  const { config, isOpen } = props;
  const icon = [
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">',
    '<path fill="currentColor" d="M10.9 2.1a1 1 0 0 1 2.2 0l.3 1.9a8 8 0 0 1 1.7.7l1.6-1a1 1 0 0 1 1.4.4l1.1 1.9a1 1 0 0 1-.3 1.3l-1.5 1.2a8 8 0 0 1 0 1.9l1.5 1.2a1 1 0 0 1 .3 1.3l-1.1 1.9a1 1 0 0 1-1.4.4l-1.6-1a8 8 0 0 1-1.7.7l-.3 1.9a1 1 0 0 1-2.2 0l-.3-1.9a8 8 0 0 1-1.7-.7l-1.6 1a1 1 0 0 1-1.4-.4l-1.1-1.9a1 1 0 0 1 .3-1.3l1.5-1.2a8 8 0 0 1 0-1.9L4.5 7.6a1 1 0 0 1-.3-1.3l1.1-1.9a1 1 0 0 1 1.4-.4l1.6 1a8 8 0 0 1 1.7-.7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    '</svg>',
  ].join('');

  return `
    <div class="dm-config-panel">
      <button class="dm-config-trigger" aria-label="配置" aria-expanded="${isOpen}">
        ${icon}
      </button>
      
      ${isOpen ? createConfigContentHTML(config) : ''}
    </div>
  `;
}

function createConfigContentHTML(config: PreviewConfig): string {
  return `
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
  `;
}

export function attachConfigPanelListeners(
  container: HTMLElement,
  props: ConfigPanelProps
): void {
  const { onChange, onToggle, config } = props;

  const trigger = container.querySelector('.dm-config-trigger');
  if (trigger) {
    trigger.addEventListener('click', onToggle);
  }

  const inputs = container.querySelectorAll('[data-config]');
  inputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      const key = target.dataset.config as keyof PreviewConfig;
      const value = target.type === 'checkbox' 
        ? (target as HTMLInputElement).checked 
        : target.value;
      
      onChange({
        ...config,
        [key]: value,
      });
    });
  });
}

export function parseConfigFromForm(container: HTMLElement): Partial<PreviewConfig> {
  const config: Partial<PreviewConfig> = {};
  
  const showTechCues = container.querySelector('[data-config="showTechCues"]') as HTMLInputElement | null;
  if (showTechCues) config.showTechCues = showTechCues.checked;
  
  const showComments = container.querySelector('[data-config="showComments"]') as HTMLInputElement | null;
  if (showComments) config.showComments = showComments.checked;
  
  const translationMode = container.querySelector('[data-config="translationMode"]') as HTMLSelectElement | null;
  if (translationMode) config.translationMode = translationMode.value as TranslationDisplayMode;
  
  const translationLayout = container.querySelector('[data-config="translationLayout"]') as HTMLSelectElement | null;
  if (translationLayout) config.translationLayout = translationLayout.value as TranslationLayoutMode;
  
  const theme = container.querySelector('[data-config="theme"]') as HTMLSelectElement | null;
  if (theme) config.theme = theme.value as ThemeMode;
  
  return config;
}
