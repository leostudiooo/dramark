import { describe, expect, it } from 'vitest';
import { scanSegments } from '../parser.js';
import type { ScannedSegment } from '../parser.js';

// Helper: extract just the `kind` field from each segment for concise assertions.
function kinds(segs: ScannedSegment[]): string[] {
  return segs.map((s) => s.kind);
}

describe('scanSegments — Phase 1 (Lexical Shield)', () => {
  it('returns an empty array for an empty input', () => {
    expect(scanSegments([], 0)).toEqual([]);
  });

  it('returns a single content segment for plain text', () => {
    const lines = ['Hello world', 'second line'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['content']);
    expect((segs[0] as Extract<ScannedSegment, { kind: 'content' }>).lines).toEqual(['Hello world', 'second line']);
  });

  it('emits a song-toggle segment for $$', () => {
    const lines = ['$$'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['song-toggle']);
  });

  it('emits two song-toggle segments for paired $$', () => {
    const lines = ['$$', 'lyrics', '$$'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['song-toggle', 'content', 'song-toggle']);
  });

  it('emits a heading segment for ATX headings', () => {
    const lines = ['# Scene 1', 'Some text'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['heading', 'content']);
    const heading = segs[0] as Extract<ScannedSegment, { kind: 'heading' }>;
    expect(heading.raw).toBe('# Scene 1');
    expect(heading.lineNo).toBe(1);
  });

  it('emits a thematic-break segment for ---', () => {
    const segs = scanSegments(['---'], 0);
    expect(kinds(segs)).toEqual(['thematic-break']);
  });

  it('emits a thematic-break segment for ***', () => {
    expect(kinds(scanSegments(['***'], 0))).toEqual(['thematic-break']);
  });

  it('emits a thematic-break segment for ___', () => {
    expect(kinds(scanSegments(['___'], 0))).toEqual(['thematic-break']);
  });

  it('does NOT treat indented --- as a thematic-break', () => {
    // Inside a list item the --- keeps leading spaces — not a root directive.
    const segs = scanSegments(['  ---'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });

  it('emits a character segment for @Name', () => {
    const segs = scanSegments(['@Hamlet'], 0);
    expect(kinds(segs)).toEqual(['character']);
    const char = segs[0] as Extract<ScannedSegment, { kind: 'character' }>;
    expect(char.name).toBe('Hamlet');
    expect(char.names).toEqual(['Hamlet']);
    expect(char.mood).toBeUndefined();
  });

  it('parses mood annotation from @Name [Mood]', () => {
    const segs = scanSegments(['@A [angered]'], 0);
    const char = segs[0] as Extract<ScannedSegment, { kind: 'character' }>;
    expect(char.name).toBe('A');
    expect(char.mood).toBe('angered');
  });

  it('emits a translation-source segment for = …', () => {
    const segs = scanSegments(['= To be, or not to be'], 0);
    expect(kinds(segs)).toEqual(['translation-source']);
    const src = segs[0] as Extract<ScannedSegment, { kind: 'translation-source' }>;
    expect(src.text).toBe('To be, or not to be');
  });

  it('does NOT treat indented = … as a translation-source', () => {
    const segs = scanSegments(['  = indented'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });

  it('emits a comment-line segment for % …', () => {
    const segs = scanSegments(['% stage note'], 0);
    expect(kinds(segs)).toEqual(['comment-line']);
    const cmt = segs[0] as Extract<ScannedSegment, { kind: 'comment-line' }>;
    expect(cmt.value).toBe('stage note');
  });

  it('emits a closed comment-block segment for %% … %%', () => {
    const lines = ['%%', 'director note', '%%'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['comment-block']);
    const block = segs[0] as Extract<ScannedSegment, { kind: 'comment-block' }>;
    expect(block.value).toBe('director note');
    expect(block.closed).toBe(true);
  });

  it('emits an unclosed comment-block when %% is never closed', () => {
    const segs = scanSegments(['%%', 'note without close'], 0);
    const block = segs[0] as Extract<ScannedSegment, { kind: 'comment-block' }>;
    expect(block.closed).toBe(false);
  });

  it('emits a closed block-tech-cue for single-line <<< cue >>>', () => {
    const segs = scanSegments(['<<<LX01 GO>>>'], 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    const cue = segs[0] as Extract<ScannedSegment, { kind: 'block-tech-cue' }>;
    expect(cue.value).toBe('LX01 GO');
    expect(cue.closed).toBe(true);
  });

  it('emits a closed block-tech-cue for multi-line <<< … >>>', () => {
    const lines = ['<<<', 'LX01 GO', 'SND: CLICK', '>>>'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    const cue = segs[0] as Extract<ScannedSegment, { kind: 'block-tech-cue' }>;
    expect(cue.value).toBe('LX01 GO\nSND: CLICK');
    expect(cue.closed).toBe(true);
  });

  it('correctly sequences mixed segments in a typical scene', () => {
    const lines = [
      '# Scene 1',
      '@A',
      'Dialogue line',
      '= Source',
      'Target',
      '---',
    ];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['heading', 'character', 'content', 'translation-source', 'content', 'thematic-break']);
  });

  it('respects startIndex and skips frontmatter lines', () => {
    const lines = ['---', 'title: Demo', '---', '@A', 'text'];
    // startIndex=3 skips the 3-line frontmatter block
    const segs = scanSegments(lines, 3);
    expect(kinds(segs)).toEqual(['character', 'content']);
  });

  it('records correct lineNo for each segment', () => {
    const lines = ['@A', 'text', '---'];
    const segs = scanSegments(lines, 0);
    const [char, content, reset] = segs as [
      Extract<ScannedSegment, { kind: 'character' }>,
      Extract<ScannedSegment, { kind: 'content' }>,
      Extract<ScannedSegment, { kind: 'thematic-break' }>,
    ];
    expect(char.lineNo).toBe(1);
    expect(content.lineNo).toBe(2);
    expect(reset.lineNo).toBe(3);
  });

  it('does not merge consecutive content segments across a directive', () => {
    const lines = ['aaa', '@B', 'bbb'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['content', 'character', 'content']);
  });

  it('treats $$ inside indented content as plain text (container isolation)', () => {
    // An indented $$ is inside a list item — not a root directive.
    const segs = scanSegments(['  $$'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });

  it('treats @Name inside a list item as plain text (container isolation)', () => {
    // Leading hyphen makes it a list item marker, not a root @-directive.
    const segs = scanSegments(['- @Hamlet'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });
});
