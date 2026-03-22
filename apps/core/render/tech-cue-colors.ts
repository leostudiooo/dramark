import type { TechConfig, TechCategory, TechEntry } from '../../../src/core/types.js';
import type { TechCueColorMap, TechCueMatch } from './types.js';

export function buildTechCueColorMap(techConfig: TechConfig | undefined): TechCueColorMap {
  const categories = new Map<string, string>();
  const entries = new Map<string, string>();
  const fallbackColor = techConfig?.color ?? '#888888';

  if (!techConfig) {
    return { categories, entries, fallbackColor };
  }

  for (const [key, value] of Object.entries(techConfig)) {
    if (key === 'mics' || key === 'color') {
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
    } else if (Array.isArray(value) && key !== 'keywords') {
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

export function matchTechCue(payload: string, colorMap: TechCueColorMap): TechCueMatch {
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

function extractFirstToken(payload: string): string {
  const trimmed = payload.trim();
  const tokenMatch = trimmed.match(/^[^\s:]+/u);
  if (tokenMatch) {
    return tokenMatch[0];
  }
  return trimmed;
}

export function getContrastColor(hexColor: string): 'black' | 'white' {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'black' : 'white';
}

export function applyAlpha(hexColor: string, alpha: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isTechCategory(value: unknown): value is TechCategory {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return 'color' in obj || 'entries' in obj;
}

function isTechEntry(value: unknown): value is TechEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return 'id' in obj && typeof obj.id === 'string';
}
