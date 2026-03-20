import type { Theme, PreviewConfig, ColorScheme } from './types.js';
import { getColorScheme } from './default-theme.js';

export function generateCSS(theme: Theme, config: PreviewConfig): string {
  const isDark = config.theme === 'dark' || 
    (config.theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const colors = getColorScheme(theme, isDark ? 'dark' : 'light');
  
  return `
/* DraMark Preview Styles */
:root,
.dramark-preview {
  --dm-bg: ${colors.background};
  --dm-sung-bg: ${colors.sungBackground};
  --dm-spoken-bg: ${colors.spokenBackground};
  --dm-text: ${colors.text};
  --dm-text-muted: ${colors.textMuted};
  --dm-border: ${colors.border};
  --dm-character: ${colors.characterName};
  --dm-tech-border: ${colors.techCueBorder};
  --dm-comment: ${colors.commentText};
  
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.4;
  container-type: inline-size;
  container-name: preview;
}

/* Layout */
.dramark-layout {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.dm-layout-mobile {
  display: none;
}

.dm-row-slot {
  min-height: 1.5rem;
}

.dm-row-placeholder {
  min-height: 1.5rem;
}

/* Three column layout (>960px) */
@container preview (min-width: 960px) {
  .dramark-layout {
    grid-template-columns: 200px 1fr 200px;
  }
  
  .dramark-left {
    display: block;
  }
  
  .dramark-right {
    display: block;
  }
}

/* Two column layout (>600px) */
@container preview (min-width: 600px) and (max-width: 959px) {
  .dm-layout-desktop {
    grid-template-columns: 1fr 200px;
  }
  
  .dramark-left {
    display: none;
  }
  
  .dm-layout-mobile {
    display: none;
  }
}

/* Single column layout (<=600px) */
@container preview (max-width: 599px) {
  .dm-layout-desktop {
    display: none;
  }

  .dm-layout-mobile {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 1rem;
  }
}

/* Character Block */
.dm-character {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  padding: 0.75rem;
  border-radius: 4px;
}

.dm-character[data-mode="sung"] {
  background: var(--dm-sung-bg);
}

.dm-character[data-mode="spoken"] {
  background: var(--dm-spoken-bg);
}

.dm-character-names {
  width: 100px;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--dm-character);
  white-space: nowrap;
}

.dm-character-content {
  flex: 1;
}

.dm-character-context {
  font-size: 0.875rem;
  color: var(--dm-text-muted);
  margin-bottom: 0.25rem;
}

/* Dialogue Content */
.dm-paragraph {
  margin: 0.5rem 0;
  white-space: pre-wrap;
}

.dm-paragraph:first-child {
  margin-top: 0;
}

.dm-paragraph:last-child {
  margin-bottom: 0;
}

/* Inline Elements */
.dm-inline-action {
  font-style: italic;
  color: var(--dm-text-muted);
}

.dm-inline-song {
  font-style: italic;
  background: rgba(196, 168, 106, 0.1);
  padding: 0 0.25rem;
  border-radius: 2px;
}

.dm-inline-tech-cue {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: monospace;
  border: 1px solid var(--dm-tech-border);
}

/* Tech Cue Colors */
${generateTechCueCSS()}

/* Block Tech Cue */
.dm-tech-cue-block {
  border: 1px solid var(--dm-tech-border);
  border-radius: 4px;
  padding: 0.75rem;
  margin: 0.5rem 0;
  background: rgba(128, 128, 128, 0.05);
}

.dm-tech-cue-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--dm-text-muted);
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--dm-border);
}

.dm-tech-cue-content {
  font-family: monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
}

/* Song Container */
.dm-song-container {
  border-left: 3px solid var(--dm-border);
  padding-left: 1rem;
  margin: 1rem 0;
}

.dm-song-title {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: var(--dm-text-muted);
}

/* Comments */
.dm-comment {
  font-size: 0.875rem;
  color: var(--dm-comment);
  font-style: italic;
  white-space: pre-wrap;
  padding: 0.5rem;
  border-left: 2px solid var(--dm-border);
  margin: 0.5rem 0;
}

.dm-comment-block {
  background: rgba(128, 128, 128, 0.05);
  border-radius: 4px;
  padding: 0.75rem;
}

/* Thematic Break */
.dm-thematic-break {
  border: none;
  border-top: 1px solid var(--dm-border);
  margin: 1.5rem 0;
}

/* Headings */
.dm-heading {
  margin: 1.5rem 0 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.dm-heading[data-depth="1"] {
  font-size: 1.5rem;
}

.dm-heading[data-depth="2"] {
  font-size: 1.25rem;
}

.dm-heading[data-depth="3"] {
  font-size: 1.1rem;
}

/* Global Action */
.dm-global-action {
  margin: 1rem 0;
  padding: 0.75rem;
  font-style: italic;
  color: var(--dm-text-muted);
}

/* Translation */
.dm-translation {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0;
}

.dm-translation-source {
  flex: 1;
  font-style: italic;
  color: var(--dm-text-muted);
}

.dm-translation-target {
  flex: 1;
}

@container preview (max-width: 600px) {
  .dm-translation[data-layout="side-by-side"] {
    flex-direction: column;
  }
}

/* Config Panel */
.dm-config-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1000;
}

.dm-config-trigger {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--dm-character);
  color: var(--dm-bg);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.dm-config-trigger:hover {
  transform: scale(1.05);
}

.dm-config-content {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 280px;
  background: var(--dm-bg);
  border: 1px solid var(--dm-border);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.dm-config-content select {
  min-width: 132px;
  background: var(--dm-bg);
  color: var(--dm-text);
  border: 1px solid var(--dm-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}

.dm-config-content select option {
  background: var(--dm-bg);
  color: var(--dm-text);
}

.dm-config-content input[type="checkbox"] {
  accent-color: var(--dm-character);
}

.dm-config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--dm-border);
}

.dm-config-item:last-child {
  border-bottom: none;
}

.dm-config-label {
  font-size: 0.875rem;
  color: var(--dm-text);
}
`.trim();
}

function generateTechCueCSS(): string {
  // Generate CSS for tech cues with dynamic colors
  return `
.dm-inline-tech-cue {
  background: rgba(128, 128, 128, 0.1);
}

.dm-tech-cue-block {
  background: rgba(128, 128, 128, 0.05);
}
`.trim();
}

export function generateTechCueColorCSS(color: string): string {
  const bgColor = color + '26'; // 15% opacity in hex
  return `
    background-color: ${bgColor};
    border-color: ${color};
    color: ${color};
  `;
}
