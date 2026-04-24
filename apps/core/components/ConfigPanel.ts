import type { PreviewConfig, ThemeMode, TranslationDisplayMode, TranslationLayoutMode } from '../render/types.js';

export interface ConfigPanelProps {
  config: PreviewConfig;
  onChange: (config: PreviewConfig) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export interface ConfigPanelRenderOptions {
  triggerAriaLabel?: string;
  triggerId?: string;
  contentId?: string;
  triggerIconHtml?: string;
  includePrintThemeOption?: boolean;
  themeValue?: ThemeMode;
  keepContentMounted?: boolean;
  contentStyle?: string;
  extraItemsHtml?: string;
}

const defaultSettingsIcon = '<span class="codicon codicon-settings-gear" aria-hidden="true"></span>';

export const settingsGearSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>';

export function createConfigPanelHTML(props: ConfigPanelProps, options: ConfigPanelRenderOptions = {}): string {
  const { config, isOpen } = props;
  const {
    triggerAriaLabel = 'Settings',
    triggerId,
    contentId,
    triggerIconHtml = defaultSettingsIcon,
    keepContentMounted = false,
  } = options;

  const renderContent = isOpen || keepContentMounted;
  const contentStyle = keepContentMounted
    ? ` style="display: ${isOpen ? 'block' : 'none'};${options.contentStyle ? ` ${options.contentStyle}` : ''}"`
    : (options.contentStyle ? ` style="${options.contentStyle}"` : '');
  const contentHtml = renderContent
    ? createConfigContentHTML(config, options, contentId, contentStyle)
    : '';
  const triggerIdAttr = triggerId ? ` id="${triggerId}"` : '';

  return `
    <div class="dm-config-panel">
      <button class="dm-config-trigger"${triggerIdAttr} aria-label="${triggerAriaLabel}" aria-expanded="${isOpen}">
        ${triggerIconHtml}
      </button>
      ${contentHtml}
    </div>
  `;
}

export function createConfigContentHTML(
  config: PreviewConfig,
  options: ConfigPanelRenderOptions = {},
  contentId?: string,
  contentStyleAttr = '',
): string {
  const themeValue = options.themeValue ?? config.theme;
  const themeOptions = [
    `<option value="auto" ${themeValue === 'auto' ? 'selected' : ''}>Auto</option>`,
    `<option value="light" ${themeValue === 'light' ? 'selected' : ''}>Light</option>`,
    `<option value="dark" ${themeValue === 'dark' ? 'selected' : ''}>Dark</option>`,
    options.includePrintThemeOption
      ? `<option value="print" ${themeValue === 'print' ? 'selected' : ''}>Print</option>`
      : '',
  ].join('');
  const contentIdAttr = contentId ? ` id="${contentId}"` : '';

  return `
    <div class="dm-config-content"${contentIdAttr}${contentStyleAttr}>
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
          ${themeOptions}
        </select>
      </div>

      ${options.extraItemsHtml ?? ''}
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
