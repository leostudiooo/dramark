import { describe, expect, it } from 'vitest';
import { scanSegments } from '../parser.js';
import type { ScannedSegment } from '../parser.js';

// Helper: extract just the `kind` field from each segment for concise assertions.
function kinds(segs: ScannedSegment[]): string[] {
  return segs.map((s) => s.kind);
}

// Type-narrowing helpers — avoids verbose `as Extract<…>` casts throughout the tests.
function asContent(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'content' }> {
  if (seg.kind !== 'content') throw new Error(`Expected content segment, got ${seg.kind}`);
  return seg;
}
function asHeadingSeg(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'heading' }> {
  if (seg.kind !== 'heading') throw new Error(`Expected heading segment, got ${seg.kind}`);
  return seg;
}
function asCharSeg(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'character' }> {
  if (seg.kind !== 'character') throw new Error(`Expected character segment, got ${seg.kind}`);
  return seg;
}
function asCommentBlock(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'comment-block' }> {
  if (seg.kind !== 'comment-block') throw new Error(`Expected comment-block segment, got ${seg.kind}`);
  return seg;
}
function asBlockTechCue(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'block-tech-cue' }> {
  if (seg.kind !== 'block-tech-cue') throw new Error(`Expected block-tech-cue segment, got ${seg.kind}`);
  return seg;
}
function asCommentLine(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'comment-line' }> {
  if (seg.kind !== 'comment-line') throw new Error(`Expected comment-line segment, got ${seg.kind}`);
  return seg;
}
function asTranslationSource(seg: ScannedSegment): Extract<ScannedSegment, { kind: 'translation-source' }> {
  if (seg.kind !== 'translation-source') throw new Error(`Expected translation-source segment, got ${seg.kind}`);
  return seg;
}

describe('scanSegments — Phase 1 (Lexical Shield)', () => {
  it('returns an empty array for an empty input', () => {
    expect(scanSegments([], 0)).toEqual([]);
  });

  it('returns a single content segment for plain text', () => {
    const lines = ['Hello world', 'second line'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['content']);
    expect(asContent(segs[0]).lines).toEqual(['Hello world', 'second line']);
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
    expect(asHeadingSeg(segs[0]).raw).toBe('# Scene 1');
    expect(asHeadingSeg(segs[0]).lineNo).toBe(1);
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
    expect(asCharSeg(segs[0]).name).toBe('Hamlet');
    expect(asCharSeg(segs[0]).names).toEqual(['Hamlet']);
    expect(asCharSeg(segs[0]).mood).toBeUndefined();
  });

  it('parses mood annotation from @Name [Mood]', () => {
    const segs = scanSegments(['@A [angered]'], 0);
    expect(asCharSeg(segs[0]).name).toBe('A');
    expect(asCharSeg(segs[0]).mood).toBe('angered');
  });

  it('emits a translation-source segment for = …', () => {
    const segs = scanSegments(['= To be, or not to be'], 0);
    expect(kinds(segs)).toEqual(['translation-source']);
    expect(asTranslationSource(segs[0]).text).toBe('To be, or not to be');
  });

  it('does NOT treat indented = … as a translation-source', () => {
    const segs = scanSegments(['  = indented'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });

  it('emits a comment-line segment for % …', () => {
    const segs = scanSegments(['% stage note'], 0);
    expect(kinds(segs)).toEqual(['comment-line']);
    expect(asCommentLine(segs[0]).value).toBe('stage note');
  });

  it('emits a closed comment-block segment for %% … %%', () => {
    const lines = ['%%', 'director note', '%%'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['comment-block']);
    expect(asCommentBlock(segs[0]).value).toBe('director note');
    expect(asCommentBlock(segs[0]).closed).toBe(true);
  });

  it('emits an unclosed comment-block when %% is never closed', () => {
    const segs = scanSegments(['%%', 'note without close'], 0);
    expect(asCommentBlock(segs[0]).closed).toBe(false);
  });

  it('emits a closed block-tech-cue for single-line <<< cue >>>', () => {
    const segs = scanSegments(['<<<LX01 GO>>>'], 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    expect(asBlockTechCue(segs[0]).value).toBe('LX01 GO');
    expect(asBlockTechCue(segs[0]).closed).toBe(true);
  });

  it('emits a closed block-tech-cue for multi-line <<< … >>>', () => {
    const lines = ['<<<', 'LX01 GO', 'SND: CLICK', '>>>'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    expect(asBlockTechCue(segs[0]).value).toBe('LX01 GO\nSND: CLICK');
    expect(asBlockTechCue(segs[0]).closed).toBe(true);
  });

  it('keeps inline-tech-cue text inside block-tech-cue payload as raw text', () => {
    const lines = ['<<<', '<<LX01>>', '>>>'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    expect(asBlockTechCue(segs[0]).value).toBe('<<LX01>>');
    expect(asBlockTechCue(segs[0]).closed).toBe(true);
  });

  it('supports multi-line block-tech-cue header with <<< closing marker', () => {
    const lines = ['<<< LX', '内容', '<<<'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['block-tech-cue']);
    expect(asBlockTechCue(segs[0]).value).toBe('LX\n内容');
    expect(asBlockTechCue(segs[0]).closed).toBe(true);
  });

  it('does not treat >>> quote lines as DraMark directives', () => {
    const lines = ['>>> 引用'];
    const segs = scanSegments(lines, 0);
    expect(kinds(segs)).toEqual(['content']);
    expect(asContent(segs[0]).lines).toEqual(['>>> 引用']);
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
    expect(asCharSeg(segs[0]).lineNo).toBe(1);
    expect(asContent(segs[1]).lineNo).toBe(2);
    expect(segs[2].lineNo).toBe(3); // thematic-break
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

  // ── v0.4.1: Song container with title
  it('parses song container with title', () => {
    const segs = scanSegments(['$$ My Shot', '@Hamilton', '$$'], 0);
    expect(kinds(segs)).toEqual(['song-toggle', 'character', 'song-toggle']);
    const songSeg = segs[0] as Extract<ScannedSegment, { kind: 'song-toggle' }>;
    expect(songSeg.title).toBe('My Shot');
  });

  it('parses song container without title', () => {
    const segs = scanSegments(['$$', '@Hamilton', '$$'], 0);
    expect(kinds(segs)).toEqual(['song-toggle', 'character', 'song-toggle']);
    const songSeg = segs[0] as Extract<ScannedSegment, { kind: 'song-toggle' }>;
    expect(songSeg.title).toBeUndefined();
  });

  it('parses song container with empty title after $$', () => {
    const segs = scanSegments(['$$ ', '@Hamilton', '$$'], 0);
    expect(kinds(segs)).toEqual(['song-toggle', 'character', 'song-toggle']);
    const songSeg = segs[0] as Extract<ScannedSegment, { kind: 'song-toggle' }>;
    expect(songSeg.title).toBeUndefined();
  });

  // ── v0.4.1: Spoken segment toggle
  it('parses spoken segment toggle !!', () => {
    const segs = scanSegments(['$$', '!!', '@A', '!!', '$$'], 0);
    expect(kinds(segs)).toEqual(['song-toggle', 'spoken-toggle', 'character', 'spoken-toggle', 'song-toggle']);
  });

  it('treats indented !! as plain text (container isolation)', () => {
    const segs = scanSegments(['  !!'], 0);
    expect(kinds(segs)).toEqual(['content']);
  });

  it('parses @@ as character-exit token', () => {
    const segs = scanSegments(['@A', '@@', 'line'], 0);
    expect(kinds(segs)).toEqual(['character', 'character-exit', 'content']);
  });

  it('parses single-line = as translation-exit token', () => {
    const segs = scanSegments(['= source', '=', 'after'], 0);
    expect(kinds(segs)).toEqual(['translation-source', 'translation-exit', 'content']);
  });
});
