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

  // 第一遍：收集所有独立的 side blocks 并分配它们的位置
  const pendingSideBlocks: Array<
    | { side: 'left'; block: TechCueBlock }
    | { side: 'right'; block: CommentRenderBlock }
  > = [];

  function flushPendingSideBlocks(
    anchorRowIndex: number,
    attachTo: 'before' | 'after'
  ): void {
    // 独立的 side blocks 应该对齐到上下节点之间的缝
    // 这里我们简单地将它们作为独立行添加
    for (const item of pendingSideBlocks) {
      if (item.side === 'left') {
        left.push(item.block);
        rows.push({ left: item.block, center: null, right: null });
      } else {
        right.push(item.block);
        rows.push({ left: null, center: null, right: item.block });
      }
    }
    pendingSideBlocks.length = 0;
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (block.type === 'song-container') {
      flushPendingSideBlocks(i, 'before');

      const separated = separateSongContainerSideBlocks(block);
      const visibleTechCues = context.config.showTechCues ? separated.techCues : [];
      const visibleComments = context.config.showComments ? separated.comments : [];

      // Song container 作为主锚点
      center.push(separated.block);

      // 收集所有属于这个 song container 的 side blocks
      const rowLeft: TechCueBlock[] = [];
      const rowRight: CommentRenderBlock[] = [];

      for (const techCue of visibleTechCues) {
        left.push(techCue);
        rowLeft.push(techCue);
      }
      for (const comment of visibleComments) {
        right.push(comment);
        rowRight.push(comment);
      }

      // 创建行：第一个 side block 与 center 同行，其余的独立成行
      if (rowLeft.length > 0 || rowRight.length > 0) {
        rows.push({
          left: rowLeft[0] ?? null,
          center: separated.block,
          right: rowRight[0] ?? null,
        });

        // 剩余的 side blocks 各自成行
        const maxExtra = Math.max(rowLeft.length - 1, rowRight.length - 1);
        for (let j = 1; j <= maxExtra; j += 1) {
          rows.push({
            left: rowLeft[j] ?? null,
            center: null,
            right: rowRight[j] ?? null,
          });
        }
      } else {
        rows.push({ left: null, center: separated.block, right: null });
      }

      continue;
    }

    if (block.type === 'character') {
      flushPendingSideBlocks(i, 'before');

      // Character 作为主锚点
      center.push(block);

      // 内联 comments 应该与 character 对齐到同一行
      const visibleComments = context.config.showComments ? block.comments : [];
      for (const comment of visibleComments) {
        right.push(comment);
      }

      if (visibleComments.length > 0) {
        rows.push({
          left: null,
          center: block,
          right: visibleComments[0],
        });

        // 剩余的 comments 各自成行（但仍属于这个 character 的右侧）
        for (let j = 1; j < visibleComments.length; j += 1) {
          rows.push({
            left: null,
            center: null,
            right: visibleComments[j],
          });
        }
      } else {
        rows.push({ left: null, center: block, right: null });
      }

      continue;
    }

    if (block.type === 'tech-cue' && block.variant === 'block') {
      if (context.config.showTechCues) {
        // 独立的 tech-cue：暂存，等待下一个 center 锚点或作为独立行
        pendingSideBlocks.push({ side: 'left', block });
      }
      continue;
    }

    if (block.type === 'tech-cue' && block.variant === 'inline') {
      if (context.config.showTechCues) {
        flushPendingSideBlocks(i, 'before');
        // inline tech-cue 作为主内容
        center.push(block);
        rows.push({ left: null, center: block, right: null });
      }
      continue;
    }

    if (block.type === 'comment') {
      if (context.config.showComments) {
        // 独立的 comment：暂存，等待下一个 center 锚点或作为独立行
        pendingSideBlocks.push({ side: 'right', block });
      }
      continue;
    }

    // 其他 block（global-action, heading, thematic-break 等）作为主锚点
    flushPendingSideBlocks(i, 'before');
    center.push(block);
    rows.push({ left: null, center: block, right: null });
  }

  // 处理最后剩余的 side blocks
  flushPendingSideBlocks(blocks.length, 'after');

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
      // 提取到侧栏，不再保留在 children 中
      techCues.push(child);
      continue;
    }
    if (child.type === 'comment') {
      // 提取到侧栏，不再保留在 children 中
      comments.push(child);
      continue;
    }
    if (child.type === 'character') {
      // character 的 comments 仍然需要提取，但 character 本身保留
      if (child.comments.length > 0) {
        comments.push(...child.comments);
      }
      children.push(child);
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
  const comments: CharacterRenderBlock['comments'] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childNode = child as Record<string, unknown>;
      if (childNode?.type === 'comment-line') {
        const converted = convertCommentLine(childNode, context, performanceMode);
        comments.push(converted);
        content.push({
          type: 'comment',
          children: [],
          targetText: converted.content,
          commentVariant: converted.variant,
        });
        continue;
      }
      if (childNode?.type === 'comment-block') {
        const converted = convertCommentBlock(childNode, context, performanceMode);
        comments.push(converted);
        content.push({
          type: 'comment',
          children: [],
          targetText: converted.content,
          commentVariant: converted.variant,
        });
        continue;
      }
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
    comments,
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
