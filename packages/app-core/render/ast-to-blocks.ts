import type {
  RenderBlock,
  CharacterRenderBlock,
  TechCueBlock,
  CommentRenderBlock,
  ColumnarLayout,
  RenderContext,
  DialogueContent,
} from './types.js';
import { matchTechCue } from './tech-cue-colors.js';

interface InlineChild {
  type: 'text' | 'emphasis' | 'strong' | 'inline-action' | 'inline-song' | 'inline-tech-cue';
  value?: string;
  children?: Array<{ type: 'text'; value: string }>;
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

  for (const block of blocks) {
    if (block.type === 'tech-cue') {
      if (block.variant === 'block' && context.config.showTechCues) {
        left.push(block);
      } else if (block.variant === 'inline' && context.config.showTechCues) {
        center.push(block);
      }
    } else if (block.type === 'comment') {
      if (context.config.showComments) {
        right.push(block);
      }
    } else {
      center.push(block);
    }
  }

  return { left, center, right };
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
    case 'block-tech-cue':
      return convertBlockTechCue(typedNode, context, performanceMode);
    case 'comment-line':
      return convertCommentLine(typedNode, context, performanceMode);
    case 'comment-block':
      return convertCommentBlock(typedNode, context, performanceMode);
    case 'thematicBreak':
      return { type: 'thematic-break', performanceMode };
    case 'heading':
      return convertHeading(typedNode, context, performanceMode);
    default:
      // Global action or other content
      if (typedNode.children) {
        return convertGlobalAction(typedNode, context, performanceMode);
      }
      return null;
  }
}

function convertCharacterBlock(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): CharacterRenderBlock {
  const names = Array.isArray(node.names) ? node.names as string[] : [String(node.name || 'Unknown')];
  const contextStr = node.context ? String(node.context) : undefined;
  
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
          children: convertInlineChildren(typedNode.children, context),
        } as DialogueContent,
      };
    case 'list':
      return {
        isTechCue: false,
        data: {
          type: 'list',
          children: convertInlineChildren(typedNode.children, context),
        } as DialogueContent,
      };
    case 'blockquote':
      return {
        isTechCue: false,
        data: {
          type: 'blockquote',
          children: convertInlineChildren(typedNode.children, context),
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
    case 'inline-tech-cue': {
      const payload = String(typedNode.payload || '');
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

function convertInlineChildren(children: unknown, context: RenderContext): InlineChild[] {
  if (!Array.isArray(children)) {
    return [];
  }

  const result: InlineChild[] = [];
  for (const child of children) {
    const converted = convertInlineChild(child, context);
    if (converted) {
      result.push(converted);
    }
  }
  return result;
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
    case 'inline-tech-cue': {
      const payload = String(typedNode.payload || '');
      const match = matchTechCue(payload, context.techColorMap);
      return { type: 'inline-tech-cue', payload, color: match.color };
    }
    default:
      return null;
  }
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

function convertBlockTechCue(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): TechCueBlock {
  const payload = String(node.payload || '');
  const header = node.header ? String(node.header) : undefined;
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

function convertGlobalAction(
  node: Record<string, unknown>,
  context: RenderContext,
  performanceMode: 'spoken' | 'sung'
): RenderBlock {
  const content: DialogueContent[] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = convertContentNode(child, context);
      if (result && !result.isTechCue) {
        content.push(result.data as DialogueContent);
      }
    }
  }

  return {
    type: 'global-action',
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
