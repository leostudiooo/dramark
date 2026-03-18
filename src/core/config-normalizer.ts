import { parse } from 'yaml';
import type {
  CastingCharacter,
  CastingConfig,
  CastingGroup,
  CoreDiagnostic,
  DocumentConfig,
  NormalizationResult,
  TechConfig,
  TechEntry,
  TechKeywordEntry,
  TranslationConfig,
} from './types.js';

const KNOWN_TOP_LEVEL_KEYS = new Set(['meta', 'casting', 'translation', 'tech']);

export function normalizeFrontmatter(frontmatterRaw?: string): NormalizationResult {
  const diagnostics: CoreDiagnostic[] = [];
  const config: DocumentConfig = { extras: {} };

  if (frontmatterRaw === undefined || frontmatterRaw.trim() === '') {
    return { config, diagnostics };
  }

  let parsed: unknown;
  try {
    parsed = parse(frontmatterRaw);
  } catch (error) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_FRONTMATTER_PARSE_ERROR',
      message: `Failed to parse frontmatter: ${String(error)}`,
      severity: 'warning',
      path: 'frontmatter',
    });
    return { config, diagnostics };
  }

  if (!isRecord(parsed)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_FRONTMATTER_ROOT_TYPE',
      message: 'Frontmatter root should be an object.',
      severity: 'warning',
      path: 'frontmatter',
    });
    return { config, diagnostics };
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      config.extras[key] = value;
      continue;
    }

    if (key === 'meta') {
      config.meta = normalizeMeta(value, diagnostics);
      continue;
    }

    if (key === 'casting') {
      config.casting = normalizeCasting(value, diagnostics);
      continue;
    }

    if (key === 'translation') {
      config.translation = normalizeTranslation(value, diagnostics);
      continue;
    }

    if (key === 'tech') {
      config.tech = normalizeTech(value, diagnostics);
    }
  }

  return { config, diagnostics };
}

function normalizeMeta(value: unknown, diagnostics: CoreDiagnostic[]): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_META_TYPE',
      message: 'meta should be an object.',
      severity: 'warning',
      path: 'meta',
    });
    return undefined;
  }
  return { ...value };
}

function normalizeCasting(value: unknown, diagnostics: CoreDiagnostic[]): CastingConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_CASTING_TYPE',
      message: 'casting should be an object.',
      severity: 'warning',
      path: 'casting',
    });
    return undefined;
  }

  const characters = normalizeCastingCharacters(value.characters, diagnostics);
  const groups = normalizeCastingGroups(value.groups, diagnostics);

  return {
    ...value,
    characters,
    groups,
  };
}

function normalizeCastingCharacters(value: unknown, diagnostics: CoreDiagnostic[]): CastingCharacter[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_CASTING_CHARACTERS_TYPE',
      message: 'casting.characters should be an array.',
      severity: 'warning',
      path: 'casting.characters',
    });
    return [];
  }

  const out: CastingCharacter[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isRecord(item)) {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_CHARACTER_ITEM_TYPE',
        message: 'casting.characters item should be an object.',
        severity: 'warning',
        path: `casting.characters[${i}]`,
      });
      continue;
    }

    if (typeof item.name !== 'string' || item.name.trim() === '') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_CHARACTER_NAME_REQUIRED',
        message: 'casting.characters item requires a non-empty name.',
        severity: 'warning',
        path: `casting.characters[${i}].name`,
      });
      continue;
    }

    const normalized: CastingCharacter = {
      ...item,
      name: item.name,
    };

    if (item.id !== undefined && typeof item.id !== 'string') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_CHARACTER_ID_TYPE',
        message: 'casting.characters[].id should be a string.',
        severity: 'warning',
        path: `casting.characters[${i}].id`,
      });
      delete normalized.id;
    }

    if (item.actor !== undefined && typeof item.actor !== 'string') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_CHARACTER_ACTOR_TYPE',
        message: 'casting.characters[].actor should be a string.',
        severity: 'warning',
        path: `casting.characters[${i}].actor`,
      });
      delete normalized.actor;
    }

    if (item.mic !== undefined && typeof item.mic !== 'string') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_CHARACTER_MIC_TYPE',
        message: 'casting.characters[].mic should be a string.',
        severity: 'warning',
        path: `casting.characters[${i}].mic`,
      });
      delete normalized.mic;
    }

    if (item.aliases !== undefined) {
      if (!Array.isArray(item.aliases) || !item.aliases.every((alias) => typeof alias === 'string')) {
        diagnostics.push({
          source: 'config',
          code: 'CONFIG_CASTING_CHARACTER_ALIASES_TYPE',
          message: 'casting.characters[].aliases should be an array of strings.',
          severity: 'warning',
          path: `casting.characters[${i}].aliases`,
        });
        delete normalized.aliases;
      }
    }

    out.push(normalized);
  }

  return out;
}

function normalizeCastingGroups(value: unknown, diagnostics: CoreDiagnostic[]): Record<string, CastingGroup> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_CASTING_GROUPS_TYPE',
      message: 'casting.groups should be an object.',
      severity: 'warning',
      path: 'casting.groups',
    });
    return {};
  }

  const out: Record<string, CastingGroup> = {};

  for (const [groupName, groupValue] of Object.entries(value)) {
    if (!isRecord(groupValue)) {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_GROUP_ITEM_TYPE',
        message: 'casting.groups.<group> should be an object.',
        severity: 'warning',
        path: `casting.groups.${groupName}`,
      });
      continue;
    }

    if (!Array.isArray(groupValue.members) || !groupValue.members.every((member) => typeof member === 'string')) {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_CASTING_GROUP_MEMBERS_TYPE',
        message: 'casting.groups.<group>.members should be an array of strings.',
        severity: 'warning',
        path: `casting.groups.${groupName}.members`,
      });
      continue;
    }

    out[groupName] = {
      ...groupValue,
      members: groupValue.members,
    };
  }

  return out;
}

function normalizeTranslation(value: unknown, diagnostics: CoreDiagnostic[]): TranslationConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_TRANSLATION_TYPE',
      message: 'translation should be an object.',
      severity: 'warning',
      path: 'translation',
    });
    return undefined;
  }

  const normalized: TranslationConfig = { ...value };

  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_TRANSLATION_ENABLED_TYPE',
      message: 'translation.enabled should be a boolean.',
      severity: 'warning',
      path: 'translation.enabled',
    });
    delete normalized.enabled;
  }

  return normalized;
}

function normalizeTech(value: unknown, diagnostics: CoreDiagnostic[]): TechConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_TECH_TYPE',
      message: 'tech should be an object.',
      severity: 'warning',
      path: 'tech',
    });
    return undefined;
  }

  const normalizedMics = normalizeTechEntries('mics', value.mics, diagnostics);
  const normalizedSfx = normalizeTechEntries('sfx', value.sfx, diagnostics);
  const normalizedLx = normalizeTechEntries('lx', value.lx, diagnostics);
  const normalizedKeywords = normalizeTechKeywords(value.keywords, diagnostics);

  return {
    ...value,
    mics: normalizedMics,
    sfx: normalizedSfx,
    lx: normalizedLx,
    keywords: normalizedKeywords,
  };
}

function normalizeTechEntries(category: 'mics' | 'sfx' | 'lx', value: unknown, diagnostics: CoreDiagnostic[]): TechEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    diagnostics.push({
      source: 'config',
      code: `CONFIG_TECH_${category.toUpperCase()}_TYPE`,
      message: `tech.${category} should be an array.`,
      severity: 'warning',
      path: `tech.${category}`,
    });
    return [];
  }

  const out: TechEntry[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isRecord(item)) {
      diagnostics.push({
        source: 'config',
        code: `CONFIG_TECH_${category.toUpperCase()}_ITEM_TYPE`,
        message: `tech.${category} item should be an object.`,
        severity: 'warning',
        path: `tech.${category}[${i}]`,
      });
      continue;
    }

    if (typeof item.id !== 'string' || item.id.trim() === '') {
      diagnostics.push({
        source: 'config',
        code: `CONFIG_TECH_${category.toUpperCase()}_ID_REQUIRED`,
        message: `tech.${category} item requires a non-empty id.`,
        severity: 'warning',
        path: `tech.${category}[${i}].id`,
      });
      continue;
    }

    if (seenIds.has(item.id)) {
      diagnostics.push({
        source: 'config',
        code: `CONFIG_TECH_${category.toUpperCase()}_DUPLICATE_ID`,
        message: `Duplicate tech.${category} id: ${item.id}.`,
        severity: 'warning',
        path: `tech.${category}[${i}].id`,
      });
      continue;
    }

    seenIds.add(item.id);
    out.push({ ...item, id: item.id });
  }

  return out;
}

function normalizeTechKeywords(value: unknown, diagnostics: CoreDiagnostic[]): TechKeywordEntry[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    diagnostics.push({
      source: 'config',
      code: 'CONFIG_TECH_KEYWORDS_TYPE',
      message: 'tech.keywords should be an array.',
      severity: 'warning',
      path: 'tech.keywords',
    });
    return [];
  }

  const out: TechKeywordEntry[] = [];
  const seenTokens = new Set<string>();

  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isRecord(item)) {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_TECH_KEYWORDS_ITEM_TYPE',
        message: 'tech.keywords item should be an object.',
        severity: 'warning',
        path: `tech.keywords[${i}]`,
      });
      continue;
    }

    if (typeof item.token !== 'string' || item.token.trim() === '') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_TECH_KEYWORDS_TOKEN_REQUIRED',
        message: 'tech.keywords item requires a non-empty token.',
        severity: 'warning',
        path: `tech.keywords[${i}].token`,
      });
      continue;
    }

    if (typeof item.label !== 'string' || item.label.trim() === '') {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_TECH_KEYWORDS_LABEL_REQUIRED',
        message: 'tech.keywords item requires a non-empty label.',
        severity: 'warning',
        path: `tech.keywords[${i}].label`,
      });
      continue;
    }

    if (seenTokens.has(item.token)) {
      diagnostics.push({
        source: 'config',
        code: 'CONFIG_TECH_KEYWORDS_DUPLICATE_TOKEN',
        message: `Duplicate tech.keywords token: ${item.token}.`,
        severity: 'warning',
        path: `tech.keywords[${i}].token`,
      });
      continue;
    }

    seenTokens.add(item.token);
    out.push({ ...item, token: item.token, label: item.label });
  }

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
