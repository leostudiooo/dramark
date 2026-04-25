import { describe, expect, it } from 'vitest';
import { resolveFrontmatterPosition, getFrontmatterCompletions } from './frontmatter-completions.js';

describe('frontmatter-completions', () => {
  describe('resolveFrontmatterPosition', () => {
    it('empty frontmatter', () => {
      const result = resolveFrontmatterPosition('', 1, 1);
      expect(result).toEqual({ path: [], existingKeys: [], target: 'key' });
    });

    it('root level', () => {
      const result = resolveFrontmatterPosition('meta:\n  title: test\n', 1, 1);
      expect(result).toEqual({ path: [], existingKeys: ['meta'], target: 'key' });
    });

    it('after translation: with null value', () => {
      const result = resolveFrontmatterPosition('translation:\n  ', 2, 3);
      expect(result).toEqual({ path: ['translation'], existingKeys: [], target: 'key' });
    });

    it('inside nested map casting.characters', () => {
      const result = resolveFrontmatterPosition('casting:\n  characters:\n    ', 3, 5);
      expect(result).toEqual({ path: ['casting', 'characters'], existingKeys: [], target: 'key' });
    });

    it('inside seq item casting.characters[0]', () => {
      const result = resolveFrontmatterPosition('casting:\n  characters:\n    - ', 3, 7);
      expect(result).toEqual({ path: ['casting', 'characters'], existingKeys: [], target: 'seq-item' });
    });

    it('in value area of scalar key', () => {
      const result = resolveFrontmatterPosition('meta:\n  title: ', 2, 10);
      expect(result).toEqual({ path: ['meta'], existingKeys: ['title'], target: 'value', valueKey: 'title' });
    });

    it('incomplete YAML', () => {
      const result = resolveFrontmatterPosition('casting:\n  charact', 2, 10);
      expect(result.target).toBeDefined();
    });
  });

  describe('getFrontmatterCompletions', () => {
    it('root level', () => {
      const result = getFrontmatterCompletions({ path: [], existingKeys: [], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['meta', 'casting', 'translation', 'tech']);
    });

    it('after translation', () => {
      const result = getFrontmatterCompletions({ path: ['translation'], existingKeys: [], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['enabled', 'source_lang', 'target_lang', 'render_mode', 'render']);
    });

    it('after casting', () => {
      const result = getFrontmatterCompletions({ path: ['casting'], existingKeys: [], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['characters', 'groups']);
    });

    it('after tech', () => {
      const result = getFrontmatterCompletions({ path: ['tech'], existingKeys: [], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['mics', 'keywords', 'color']);
    });

    it('inside characters[] seq item', () => {
      const result = getFrontmatterCompletions({ path: ['casting', 'characters'], existingKeys: [], target: 'seq-item' });
      expect(result.map(r => r.label)).toEqual(['name', 'id', 'actor', 'mic', 'aliases']);
    });

    it('inside mics[] seq item', () => {
      const result = getFrontmatterCompletions({ path: ['tech', 'mics'], existingKeys: [], target: 'seq-item' });
      expect(result.map(r => r.label)).toEqual(['id', 'label', 'desc']);
    });

    it('inside keywords[] seq item', () => {
      const result = getFrontmatterCompletions({ path: ['tech', 'keywords'], existingKeys: [], target: 'seq-item' });
      expect(result.map(r => r.label)).toEqual(['token', 'label']);
    });

    it('value for enabled', () => {
      const result = getFrontmatterCompletions({ path: ['translation'], existingKeys: [], target: 'value', valueKey: 'enabled' });
      expect(result.map(r => r.label)).toEqual(['true', 'false']);
    });

    it('value for render_mode', () => {
      const result = getFrontmatterCompletions({ path: ['translation'], existingKeys: [], target: 'value', valueKey: 'render_mode' });
      expect(result.map(r => r.label)).toEqual(['bilingual', 'source', 'target', 'script']);
    });

    it('value for mic with config', () => {
      const config = { tech: { mics: [{ id: 'mic1', label: 'Mic 1' }] }, extras: {} };
      const result = getFrontmatterCompletions({ path: ['casting', 'characters'], existingKeys: [], target: 'value', valueKey: 'mic' }, config);
      expect(result.map(r => r.label)).toEqual(['mic1']);
    });

    it('filters out existing keys', () => {
      const result = getFrontmatterCompletions({ path: ['translation'], existingKeys: ['enabled'], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['source_lang', 'target_lang', 'render_mode', 'render']);
    });

    it('unknown path', () => {
      const result = getFrontmatterCompletions({ path: ['unknown'], existingKeys: [], target: 'key' });
      expect(result).toEqual([]);
    });

    it('dynamic tech category', () => {
      const result = getFrontmatterCompletions({ path: ['tech', 'sfx'], existingKeys: [], target: 'key' });
      expect(result.map(r => r.label)).toEqual(['color', 'entries']);
    });

    it('dynamic tech category entries[]', () => {
      const result = getFrontmatterCompletions({ path: ['tech', 'sfx', 'entries'], existingKeys: [], target: 'seq-item' });
      expect(result.map(r => r.label)).toEqual(['id', 'label', 'desc']);
    });
  });
});
