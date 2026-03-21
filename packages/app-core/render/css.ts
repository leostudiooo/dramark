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

/* Layout - Row-based */
.dramark-layout {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.dm-layout-mobile {
  display: none;
}

/* Row container - always 3 columns */
/* gap = 0.5rem (间距) + 0.6rem (外扩背景) = 1.1rem */
.dm-row {
  display: grid;
  gap: 1.1rem;
  align-items: start;
  grid-template-columns: 200px 1fr 200px;
}

/* When no left sidebar at document level, collapse left column */
.dramark-preview[data-has-left="false"] .dm-row {
  grid-template-columns: 0 1fr 200px;
}

/* When no right sidebar at document level, collapse right column */
.dramark-preview[data-has-right="false"] .dm-row {
  grid-template-columns: 200px 1fr 0;
}

/* When no sidebars */
.dramark-preview[data-has-left="false"][data-has-right="false"] .dm-row {
  grid-template-columns: 0 1fr 0;
}

/* Row sections */
.dm-row-left {
  min-width: 0;
}

.dm-row-center {
  min-width: 0;
}

.dm-row-right {
  min-width: 0;
}

/* Empty placeholders still take up grid space but are invisible */
.dm-row-empty {
  min-height: 1.35rem;
  visibility: hidden;
}

/* Hide comments in center when right column is shown */
.dramark-preview[data-has-right="true"] .dm-row-center .dm-comment {
  display: none;
}

/* Responsive: Two column layout (600px-959px) - prioritize right column */
@container preview (min-width: 600px) and (max-width: 959px) {
  /* Default: show all three columns */
  .dramark-preview .dm-row {
    grid-template-columns: 200px 1fr 200px;
  }
  
  /* When both sidebars present, hide left column */
  .dramark-preview[data-columns="3"] .dm-row {
    grid-template-columns: 0 1fr 200px;
  }

  .dramark-preview[data-columns="3"] .dm-row-left {
    visibility: hidden;
  }

  /* No left sidebar */
  .dramark-preview[data-has-left="false"] .dm-row {
    grid-template-columns: 0 1fr 200px;
  }

  /* No right sidebar */
  .dramark-preview[data-has-right="false"] .dm-row {
    grid-template-columns: 200px 1fr 0;
  }
  
  /* Neither sidebar */
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
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 1rem;
  }
}

/* Character Block */
.dm-character {
  display: flex;
  gap: 0.6rem;
  margin: 0.5rem 0;
  padding: 0.15rem 0;
  border-radius: 4px;
}

.dm-character[data-mode="sung"] {
  background: transparent;
}

.dm-character[data-mode="spoken"] {
  background: transparent;
}

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

.dm-character-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem;
}

.dm-character-name {
  display: inline-block;
}

.dm-character-sep {
  display: inline-block;
  width: 0.3rem;
}

.dm-character-content {
  flex: 1;
}

.dm-character-context {
  font-size: 0.875rem;
  color: var(--dm-text-muted);
  margin-top: 0;
}

/* Dialogue Content */
.dm-paragraph {
  margin: 0.35rem 0;
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

.dm-inline-image {
  max-width: min(100%, 560px);
  height: auto;
  display: block;
  margin: 0.45rem 0;
  border-radius: 4px;
}

.dm-inline-spoken {
  color: var(--dm-text-muted);
  font-style: normal;
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
  padding: 0.45rem 0.55rem;
  margin: 0.25rem 0;
  background: rgba(128, 128, 128, 0.05);
}

.dm-tech-cue-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--dm-text-muted);
  margin-bottom: 0.25rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px solid var(--dm-border);
}

.dm-tech-cue-content {
  font-family: monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
}

/* Song Container */
.dm-song-container {
  border: 0;
  padding: 0;
  margin: 0.6rem 0;
  border-radius: 0;
  position: relative;
  isolation: isolate;
}

.dm-song-container::before {
  content: "";
  position: absolute;
  left: -0.6rem;
  right: -0.6rem;
  top: -0.35rem;
  bottom: -0.35rem;
  z-index: -1;
}

.dm-song-container[data-mode="sung"] {
  background: transparent;
}

.dm-song-container[data-mode="sung"]::before {
  background: var(--dm-sung-bg);
}

.dm-song-container[data-mode="spoken"] {
  background: transparent;
}

.dm-song-container[data-mode="spoken"]::before {
  background: var(--dm-spoken-bg);
}

.dm-song-container > .dm-character,
.dm-song-container > .dm-global-action,
.dm-song-container > .dm-tech-cue-block,
.dm-song-container > .dm-comment,
.dm-song-container > .dm-song-container,
.dm-song-container > .dm-heading,
.dm-song-container > .dm-thematic-break {
  margin-left: 0;
  margin-right: 0;
}

.dm-song-title {
  font-weight: 600;
  font-size: 1rem;
  margin: 0.3rem 0 0.2rem;
  color: var(--dm-text-muted);
}

/* Comments */
.dm-comment {
  font-size: 0.875rem;
  color: var(--dm-comment);
  font-style: italic;
  white-space: pre-wrap;
  padding: 0.3rem 0.45rem;
  border-left: 2px solid var(--dm-border);
  margin: 0.35rem 0;
}

.dm-comment-block {
  background: rgba(128, 128, 128, 0.05);
  border-radius: 4px;
  padding: 0.45rem;
}

/* Thematic Break */
.dm-thematic-break {
  border: none;
  border-top: 1px solid var(--dm-border);
  margin: 0.6rem 0;
}

/* Headings */
.dm-heading {
  margin: 0.65rem 0 0.35rem;
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
  margin: 0.35rem 0;
  padding: 0.2rem 0;
  font-style: italic;
  color: var(--dm-text-muted);
}

/* Translation */
.dm-translation {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0;
}

.dm-translation[data-layout="stack"] {
  flex-direction: column;
  gap: 0.25rem;
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
  width: 42px;
  height: 42px;
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

.dm-config-trigger svg {
  display: block;
}

.dm-config-trigger:hover {
  transform: scale(1.05);
}

.dm-config-content {
  position: absolute;
  bottom: 52px;
  right: 0;
  width: 272px;
  background: var(--dm-bg);
  border: 1px solid var(--dm-border);
  border-radius: 8px;
  padding: 0.7rem 0.75rem;
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
  padding: 0.35rem 0;
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
