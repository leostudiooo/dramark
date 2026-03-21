import type { TechConfig, TechEntry } from '../../../src/core/types.js';

export type PerformanceMode = 'spoken' | 'sung';
export type TranslationDisplayMode = 'source-only' | 'target-only' | 'bilingual';
export type TranslationLayoutMode = 'stack' | 'side-by-side';
export type ThemeMode = 'auto' | 'light' | 'dark';

export interface PreviewConfig {
  showTechCues: boolean;
  showComments: boolean;
  translationMode: TranslationDisplayMode;
  translationLayout: TranslationLayoutMode;
  theme: ThemeMode;
}

export interface ColorScheme {
  background: string;
  sungBackground: string;
  spokenBackground: string;
  text: string;
  textMuted: string;
  border: string;
  characterName: string;
  techCueBorder: string;
  commentText: string;
}

export interface Theme {
  name: string;
  light: ColorScheme;
  dark: ColorScheme;
}

export interface TechCueMatch {
  category: string;
  color: string;
  entryId?: string;
}

export interface TechCueColorMap {
  categories: Map<string, string>;
  entries: Map<string, string>;
  fallbackColor: string;
}

export type RenderBlock =
  | CharacterRenderBlock
  | GlobalActionBlock
  | SongContainerBlock
  | TechCueBlock
  | CommentRenderBlock
  | ThematicBreakBlock
  | HeadingBlock;

export interface BaseRenderBlock {
  type: string;
  performanceMode: PerformanceMode;
}

export interface CharacterRenderBlock extends BaseRenderBlock {
  type: 'character';
  names: string[];
  context?: string;
  content: DialogueContent[];
  techCues: Array<{ payload: string; color?: string }>;
  comments: CommentRenderBlock[];
  performanceMode: PerformanceMode;
}

export interface DialogueContent {
  type: 'paragraph' | 'list' | 'blockquote' | 'translation';
  children: Array<DialogueChild>;
  sourceText?: string;
  targetText?: string;
}

export type DialogueChild =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'emphasis'; children: Array<{ type: 'text'; value: string }> }
  | { type: 'strong'; children: Array<{ type: 'text'; value: string }> }
  | { type: 'image'; url: string; alt?: string; title?: string }
  | { type: 'inline-action'; value: string }
  | { type: 'inline-song'; value: string }
  | { type: 'inline-spoken'; value: string }
  | { type: 'inline-tech-cue'; payload: string; color?: string };

export interface GlobalActionBlock extends BaseRenderBlock {
  type: 'global-action';
  content: DialogueContent[];
}

export interface SongContainerBlock extends BaseRenderBlock {
  type: 'song-container';
  title?: string;
  children: RenderBlock[];
}

export interface TechCueBlock extends BaseRenderBlock {
  type: 'tech-cue';
  variant: 'inline' | 'block';
  header?: string;
  payload: string;
  color?: string;
}

export interface CommentRenderBlock extends BaseRenderBlock {
  type: 'comment';
  variant: 'line' | 'block';
  content: string;
}

export interface ThematicBreakBlock extends BaseRenderBlock {
  type: 'thematic-break';
}

export interface HeadingBlock extends BaseRenderBlock {
  type: 'heading';
  depth: number;
  content: string;
}

export interface ColumnarLayout {
  left: TechCueBlock[];
  center: RenderBlock[];
  right: CommentRenderBlock[];
  rows: ColumnarRow[];
}

export interface ColumnarRow {
  left: TechCueBlock | null;
  center: RenderBlock | null;
  right: CommentRenderBlock | null;
}

export interface RenderContext {
  ast: unknown;
  techConfig: TechConfig;
  config: PreviewConfig;
  theme: Theme;
  techColorMap: TechCueColorMap;
}

export interface RenderResult {
  blocks: RenderBlock[];
  layout: ColumnarLayout;
  css: string;
}
