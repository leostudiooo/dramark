import type { Content } from 'mdast';

export type PerformanceContext = 'global' | 'character';
export type MusicalContext = 'spoken' | 'sung';

export interface FrontmatterBlock {
  type: 'frontmatter';
  value: string;
}

export interface CharacterBlock {
  type: 'character-block';
  name: string;
  names: string[];
  mood?: string;
  children: DraMarkRootContent[];
}

export interface TranslationPair {
  type: 'translation-pair';
  sourceText: string;
  target: Content[];
  children: DraMarkRootContent[];
}

export interface SongContainer {
  type: 'song-container';
  children: DraMarkRootContent[];
}

export interface InlineAction {
  type: 'inline-action';
  value: string;
}

export interface InlineSongSegment {
  type: 'inline-song';
  value: string;
}

export interface InlineTechCue {
  type: 'inline-tech-cue';
  value: string;
}

export interface BlockTechCue {
  type: 'block-tech-cue';
  value: string;
}

export interface CommentLine {
  type: 'comment-line';
  value: string;
}

export interface CommentBlock {
  type: 'comment-block';
  value: string;
}

export type DraMarkRootContent =
  | Content
  | FrontmatterBlock
  | CharacterBlock
  | TranslationPair
  | SongContainer
  | BlockTechCue
  | CommentLine
  | CommentBlock;

export interface DraMarkRoot {
  type: 'root';
  children: DraMarkRootContent[];
}

export interface DraMarkWarning {
  code:
    | 'UNCLOSED_BLOCK_COMMENT'
    | 'UNCLOSED_BLOCK_TECH_CUE'
    | 'UNCLOSED_SONG_CONTAINER'
    | 'NESTED_SONG_CONTAINER'
    | 'TRANSLATION_OUTSIDE_CHARACTER';
  message: string;
  line: number;
  column: number;
}

export interface DraMarkParseResult {
  tree: DraMarkRoot;
  warnings: DraMarkWarning[];
  metadata: {
    translationEnabledFromFrontmatter: boolean;
  };
}

export interface DraMarkOptions {
  translationEnabled?: boolean;
  includeComments?: boolean;
  strictMode?: boolean;
  allowNestedSongContainers?: boolean;
}

declare module 'mdast' {
  interface RootContentMap {
    'frontmatter': FrontmatterBlock;
    'character-block': CharacterBlock;
    'translation-pair': TranslationPair;
    'song-container': SongContainer;
    'block-tech-cue': BlockTechCue;
    'comment-line': CommentLine;
    'comment-block': CommentBlock;
  }

  interface PhrasingContentMap {
    'inline-action': InlineAction;
    'inline-song': InlineSongSegment;
    'inline-tech-cue': InlineTechCue;
  }
}