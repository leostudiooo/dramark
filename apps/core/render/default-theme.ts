import type { Theme, ColorScheme } from './types.js';

export const defaultTheme: Theme = {
  name: 'default',
  light: {
    background: '#ffffff',
    sungBackground: '#f5f0e0',
    spokenBackground: '#f0f4f8',
    text: '#1a1a1a',
    textMuted: '#666666',
    border: '#e0ddd5',
    characterName: '#555555',
    techCueBorder: '#cccccc',
    commentText: '#888888',
  },
  dark: {
    background: '#1e1a14',
    sungBackground: '#2a2318',
    spokenBackground: '#1e2028',
    text: '#e8e4dc',
    textMuted: '#a09888',
    border: '#3a342a',
    characterName: '#c4a86a',
    techCueBorder: '#4a4438',
    commentText: '#7a7060',
  },
};

export function getColorScheme(theme: Theme, mode: 'light' | 'dark'): typeof theme.light {
  return mode === 'dark' ? theme.dark : theme.light;
}

export function getPrintColorScheme(): ColorScheme {
  return {
    background: '#ffffff',
    sungBackground: '#ffffff',
    spokenBackground: '#ffffff',
    text: '#1a1a1a',
    textMuted: '#4a4a4a',
    border: '#d0d0d0',
    characterName: '#b45309',
    techCueBorder: '#9ca3af',
    commentText: '#6b7280',
  };
}
