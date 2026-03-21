import type {
  RenderBlock,
  CharacterRenderBlock,
  TechCueBlock,
  CommentRenderBlock,
  SongContainerBlock,
  ColumnarLayout,
  RenderContext,
  DialogueContent,
} from './types.js';
import { matchTechCue } from './tech-cue-colors.js';

interface InlineChild {
  type: 'text' | 'break' | 'emphasis' | 'strong' | 'image' | 'inline-action' | 'inline-song' | 'inline-spoken' | 'inline-tech-cue';
  value?: string;
  children?: Array<{ type: 'text'; value: string }>;
  url?: string;
  alt?: string;
  title?: string;
  payload?: string;
  color?: string;
}

export function convertAstToRenderBlocks(context: RenderContext): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  const ast = context.ast as { children?: unknown[] };
  
  if (!ast.children || !Array.isArray(ast.children)) {
    return blocks;
  }

  for (const node of ast.children) {
    const block = convertNode(node, context, 'spoken');
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

export function buildColumnarLayout(
  blocks: RenderBlock[],
  context: RenderContext
): ColumnarLayout {
  const left: TechCueBlock[] = [];
  const center: RenderBlock[] = [];
  const right: CommentRenderBlock[] = [];
  const rows: ColumnarLayout['rows'] = [];

  for (const block of blocks) {
    if (block.type === 'song-container') {
      const separated = separateSongContainerSideBlocks(block);
      center.push(separated.block);
      rows.push({ left: null, center: separated.block, right: null });
      for (const techCue of separated.techCues) {
        if (context.config.showTechCues) {
          left.push(techCue);
          rows.push({ left: techCue, center: null, right: null });
        }
      }
      for (const comment of separated.comments) {
        if (context.config.showComments) {
          right.push(comment);
          rows.push({ left: null, center: null, right: comment });
        }
      }
      continue;
    }

    if (block.type === 'tech-cue') {
      if (block.variant === 'block' && context.config.showTechCues) {
        left.push(block);
        rows.push({ left: block, center: null, right: null });
      } else if (block.variant === 'inline' && context.config.showTechCues) {
        center.push(block);
        rows.push({ left: null, center: block, right: null });
      }
    } else if (block.type === 'comment') {
      if (context.config.showComments) {
        right.push(block);
        rows.push({ left: null, center: null, right: block });
      }
    } else {
      center.push(block);
      rows.push({ left: null, center: block, right: null });
    }
  }

  return { left, center, right, rows };
}

function separateSongContainerSideBlocks(block: SongContainerBlock): {
  block: SongContainerBlock;
  techCues: TechCueBlock[];
  comments: CommentRenderBlock[];
} {
  const techCues: TechCueBlock[] = [];
  const comments: CommentRenderBlock[] = [];
  const children: RenderBlock[] = [];

  for (const child of block.children) {
    if (child.type === 'tech-cue' && child.variant === 'block') {
      techCues.push(child);
      continue;
    }
    if (child.type === 'comment') {
      comments.push(child);
      continue;
    }
    if (child.type === 'song-container') {
      const nested = separateSongContainerSideBlocks(child);
      children.push(nested.block);
      techCues.push(...nested.techCues);
      comments.push(...nested.comments);
      continue;
    }
    children.push(child);
  }

  return {
    block: {
      ...block,
      children,
    },
    techCues,
    comments,
  };
}

function convertNode(node: unknown, context: RenderContext, performanceMode: 'spoken' | 'sung'): RenderBlock | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const typedNode = node as Record<string, unknown>;
  const nodeType = typedNode.type as string;

  switch (nodeType) {
    case 'character-block':
      return convertCharacterBlock(typedNode, context, performanceMode);
    case 'song-container':
      return convertSongContainer(typedNode, context);
    case 'spoken-segment':
      return convertSpokenSegment(typedNode, context);
    case 'block-tech-cue':
      return convertBlockTechCue(typedNode, context, performanceMode);
    case 'comment-line':
      return convertCommentLine(typedNode, context, performanceMode);
    case 'comment-block':
      return convertCommentBlock(typedNode, context, performanceMode);
    case 'paragraph':
    case 'list':
    case 'blockquote':
      return convertStandaloneGlobalContent(typedNode, context, performanceMode);
    case 'thematicBreak':
      return { type: 'thematic-break', performanceMode };
    case 'heading':
      return convertHeading(typedNode, context, performanceMode);
    default:
      return null;
  }
}

function convertCharacterBlock(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): CharacterRenderBlock {
  const names = Array.isArray(node.names) ? node.names as string[] : [String(node.name || 'Unknown')];
  const contextStr = node.mood ? String(node.mood) : (node.context ? String(node.context) : undefined);
  
  const content: CharacterRenderBlock['content'] = [];
  const techCues: CharacterRenderBlock['techCues'] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = convertContentNode(child, context);
      if (result) {
        if (result.isTechCue) {
          techCues.push(result.data as { payload: string; color?: string });
        } else {
          content.push(result.data as DialogueContent);
        }
      }
    }
  }

  return {
    type: 'character',
    names,
    context: contextStr,
    content,
    techCues,
    performanceMode,
  };
}

interface ContentNodeResult {
  isTechCue: boolean;
  data: unknown;
}

function convertContentNode(node: unknown, context: RenderContext): ContentNodeResult | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const typedNode = node as Record<string, unknown>;
  const nodeType = typedNode.type as string;

  switch (nodeType) {
    case 'paragraph':
      return {
        isTechCue: false,
        data: {
          type: 'paragraph',
          children: collectInlineChildren(node, context),
        } as DialogueContent,
      };
    case 'list':
      return {
        isTechCue: false,
        data: {
          type: 'list',
          children: collectInlineChildren(node, context),
        } as DialogueContent,
      };
    case 'blockquote':
      return {
        isTechCue: false,
        data: {
          type: 'blockquote',
          children: collectInlineChildren(node, context),
        } as DialogueContent,
      };
    case 'translation-pair':
      return {
        isTechCue: false,
        data: {
          type: 'translation',
          children: [],
          sourceText: String(typedNode.sourceText || ''),
          targetText: extractTextContent(typedNode.target),
        } as DialogueContent,
      };
    case 'inline-action':
      return {
        isTechCue: false,
        data: {
          type: 'text',
          value: String(typedNode.value || ''),
        } as InlineChild,
      };
    case 'inline-song':
      return {
        isTechCue: false,
        data: {
          type: 'inline-song',
          value: String(typedNode.value || ''),
        } as InlineChild,
      };
    case 'inline-spoken':
      return {
        isTechCue: false,
        data: {
          type: 'inline-spoken',
          value: String(typedNode.value || ''),
        } as InlineChild,
      };
    case 'inline-tech-cue': {
      if (!context.config.showTechCues) {
        return null;
      }
      const payload = String(typedNode.payload || typedNode.value || '');
      const match = matchTechCue(payload, context.techColorMap);
      return {
        isTechCue: true,
        data: { payload, color: match.color },
      };
    }
    default:
      return null;
  }
}

function convertInlineChild(node: unknown, context: RenderContext): InlineChild | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const typedNode = node as Record<string, unknown>;
  const nodeType = typedNode.type as string;

  switch (nodeType) {
    case 'text':
      return { type: 'text', value: String(typedNode.value || '') };
    case 'break':
      return { type: 'break' };
    case 'emphasis':
      return {
        type: 'emphasis',
        children: extractTextChildren(typedNode.children),
      };
    case 'strong':
      return {
        type: 'strong',
        children: extractTextChildren(typedNode.children),
      };
    case 'inline-action':
      return { type: 'inline-action', value: String(typedNode.value || '') };
    case 'inline-song':
      return { type: 'inline-song', value: String(typedNode.value || '') };
    case 'image':
      return {
        type: 'image',
        url: String(typedNode.url || ''),
        alt: extractTextContent(typedNode.alt ?? typedNode.children),
        title: typeof typedNode.title === 'string' ? typedNode.title : undefined,
      };
    case 'inline-spoken':
      return { type: 'inline-spoken', value: String(typedNode.value || '') };
    case 'inline-tech-cue': {
      if (!context.config.showTechCues) {
        return null;
      }
      const payload = String(typedNode.payload || typedNode.value || '');
      const match = matchTechCue(payload, context.techColorMap);
      return { type: 'inline-tech-cue', payload, color: match.color };
    }
    default:
      return null;
  }
}

function collectInlineChildren(node: unknown, context: RenderContext): InlineChild[] {
  const collected: InlineChild[] = [];

  function walk(current: unknown): void {
    if (!current || typeof current !== 'object') {
      return;
    }
    const converted = convertInlineChild(current, context);
    if (converted !== null) {
      collected.push(converted);
      return;
    }
    const children = (current as Record<string, unknown>).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        walk(child);
      }
    }
  }

  walk(node);
  return collected;
}

function extractTextChildren(children: unknown): Array<{ type: 'text'; value: string }> {
  if (!Array.isArray(children)) {
    return [];
  }

  return children
    .filter(child => child && typeof child === 'object' && (child as Record<string, unknown>).type === 'text')
    .map(child => ({
      type: 'text' as const,
      value: String((child as Record<string, unknown>).value || ''),
    }));
}

function convertSongContainer(node: Record<string, unknown>, context: RenderContext): RenderBlock {
  const title = node.title ? String(node.title) : undefined;
  const children: RenderBlock[] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const converted = convertNode(child, context, 'sung');
      if (converted) {
        children.push(converted);
      }
    }
  }

  return {
    type: 'song-container',
    title,
    children,
    performanceMode: 'sung',
  };
}

function convertSpokenSegment(node: Record<string, unknown>, context: RenderContext): RenderBlock {
  const children: RenderBlock[] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const converted = convertNode(child, context, 'spoken');
      if (converted) {
        children.push(converted);
      }
    }
  }

  return {
    type: 'song-container',
    title: undefined,
    children,
    performanceMode: 'spoken',
  };
}

function convertBlockTechCue(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): TechCueBlock {
  const payload = String(node.value || node.payload || '');
  const header = node.header
    ? String(node.header)
    : (payload.trim().split(/\s+/u)[0] || undefined);
  const match = matchTechCue(payload, context.techColorMap);

  return {
    type: 'tech-cue',
    variant: 'block',
    header,
    payload,
    color: match.color,
    performanceMode,
  };
}

function convertStandaloneGlobalContent(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung',
): RenderBlock | null {
  const result = convertContentNode(node, context);
  if (!result || result.isTechCue) {
    return null;
  }
  return {
    type: 'global-action',
    content: [result.data as DialogueContent],
    performanceMode,
  };
}

function convertCommentLine(
  node: Record<string, unknown>,
  _context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): CommentRenderBlock {
  return {
    type: 'comment',
    variant: 'line',
    content: String(node.value || ''),
    performanceMode,
  };
}

function convertCommentBlock(
  node: Record<string, unknown>,
  _context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): CommentRenderBlock {
  return {
    type: 'comment',
    variant: 'block',
    content: String(node.value || ''),
    performanceMode,
  };
}

function convertHeading(
  node: Record<string, unknown>,
  _context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): RenderBlock {
  const depth = typeof node.depth === 'number' ? node.depth : 1;
  const content = extractTextContent(node.children);

  return {
    type: 'heading',
    depth,
    content,
    performanceMode,
  };
}

function extractTextContent(children: unknown): string {
  if (!Array.isArray(children)) {
    return '';
  }

  return children
    .map(child => {
      if (typeof child === 'string') {
        return child;
      }
      if (child && typeof child === 'object') {
        const obj = child as Record<string, unknown>;
        if (obj.value && typeof obj.value === 'string') {
          return obj.value;
        }
        if (obj.children) {
          return extractTextContent(obj.children);
        }
      }
      return '';
    })
    .join('');
}
