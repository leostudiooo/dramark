import type {
  RenderBlock,
  CharacterRenderBlock,
  TechCueBlock,
  CommentRenderBlock,
  SongContainerBlock,
  GlobalActionBlock,
  ColumnarLayout,
  PreviewConfig,
  DialogueChild,
} from '../render/types.js';

export interface PreviewProps {
  layout: ColumnarLayout;
  config: PreviewConfig;
}

export function createPreviewHTML(props: PreviewProps): string {
  const { layout, config } = props;
  const hasLeft = config.showTechCues && layout.left.length > 0;
  const hasRight = config.showComments && layout.right.length > 0;
  const columnCount = hasLeft && hasRight ? 3 : hasLeft || hasRight ? 2 : 1;

  return `
    <div class="dramark-preview" data-theme="${config.theme}" data-columns="${columnCount}" data-has-left="${hasLeft}" data-has-right="${hasRight}">
      <div class="dramark-layout dm-layout-desktop">
        <div class="dramark-left">
          ${layout.rows.map((row) => renderRowLeft(row.left)).join('')}
        </div>
        <div class="dramark-center">
          ${layout.rows.map((row) => renderRowCenter(row.center, config)).join('')}
        </div>
        <div class="dramark-right">
          ${layout.rows.map((row) => renderRowRight(row.right)).join('')}
        </div>
      </div>
      <div class="dramark-layout dm-layout-mobile">
        <div class="dramark-center">
          ${layout.rows.map((row) => renderRowForMobile(row, config)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderRowLeft(block: TechCueBlock | null): string {
  if (block === null) {
    return '<div class="dm-row-placeholder" aria-hidden="true"></div>';
  }
  return `<div class="dm-row-slot">${renderTechCueBlock(block)}</div>`;
}

function renderRowCenter(block: RenderBlock | null, config: PreviewConfig): string {
  if (block === null) {
    return '<div class="dm-row-placeholder" aria-hidden="true"></div>';
  }
  return `<div class="dm-row-slot">${renderBlock(block, config)}</div>`;
}

function renderRowRight(block: CommentRenderBlock | null): string {
  if (block === null) {
    return '<div class="dm-row-placeholder" aria-hidden="true"></div>';
  }
  return `<div class="dm-row-slot">${renderCommentBlock(block)}</div>`;
}

function renderRowForMobile(
  row: { left: TechCueBlock | null; center: RenderBlock | null; right: CommentRenderBlock | null },
  config: PreviewConfig,
): string {
  if (row.center !== null) {
    return renderBlock(row.center, config);
  }
  if (row.left !== null) {
    return renderTechCueBlock(row.left);
  }
  if (row.right !== null) {
    return renderCommentBlock(row.right);
  }
  return '';
}

function renderBlock(block: RenderBlock, config: PreviewConfig): string {
  switch (block.type) {
    case 'character':
      return renderCharacterBlock(block, config);
    case 'global-action':
      return renderGlobalActionBlock(block, config);
    case 'song-container':
      return renderSongContainerBlock(block, config);
    case 'tech-cue':
      return renderTechCueBlock(block);
    case 'comment':
      return renderCommentBlock(block);
    case 'thematic-break':
      return '<hr class="dm-thematic-break" />';
    case 'heading':
      return `<h${block.depth} class="dm-heading" data-depth="${block.depth}">${escapeHtml(block.content)}</h${block.depth}>`;
    default:
      return '';
  }
}

function renderCharacterBlock(block: CharacterRenderBlock, config: PreviewConfig): string {
  const namesHtml = block.names.map(name => `<span class="dm-character-name">${escapeHtml(name)}</span>`).join('<span class="dm-character-sep"> </span>');
  const contextHtml = block.context ? `<div class="dm-character-context">[${escapeHtml(block.context)}]</div>` : '';
  
  const contentHtml = block.content.map((content) => renderDialogueContent(content, config)).join('');

  const techCuesHtml = block.techCues.length > 0
    ? `<div class="dm-character-tech-cues">${block.techCues.map(tc => renderInlineTechCue(tc)).join('')}</div>`
    : '';

  return `
    <div class="dm-character" data-mode="${block.performanceMode}">
      <div class="dm-character-names">
        <div class="dm-character-name-row">${namesHtml}</div>
        ${contextHtml}
      </div>
      <div class="dm-character-content">
        ${contentHtml}
        ${techCuesHtml}
      </div>
    </div>
  `;
}

function renderGlobalActionBlock(block: GlobalActionBlock, config: PreviewConfig): string {
  const contentHtml = block.content.map((content) => renderDialogueContent(content, config)).join('');

  return `<div class="dm-global-action" data-mode="${block.performanceMode}">${contentHtml}</div>`;
}

function renderSongContainerBlock(block: SongContainerBlock, config: PreviewConfig): string {
  const titleHtml = block.title ? `<div class="dm-song-title">${escapeHtml(block.title)}</div>` : '';
  const childrenHtml = block.children.map((child) => renderBlock(child, config)).join('');

  return `
    <div class="dm-song-container" data-mode="${block.performanceMode}">
      ${titleHtml}
      ${childrenHtml}
    </div>
  `;
}

function renderTechCueBlock(block: TechCueBlock): string {
  const headerHtml = block.header 
    ? `<div class="dm-tech-cue-header">${escapeHtml(block.header)}</div>` 
    : '';
  
  const style = block.color ? `style="border-color: ${block.color}; background: ${block.color}15;"` : '';

  return `
    <div class="dm-tech-cue-block" ${style} data-mode="${block.performanceMode}">
      ${headerHtml}
      <div class="dm-tech-cue-content">${escapeHtml(block.payload)}</div>
    </div>
  `;
}

function renderCommentBlock(block: CommentRenderBlock): string {
  const variantClass = block.variant === 'block' ? 'dm-comment-block' : '';
  return `<div class="dm-comment ${variantClass}" data-mode="${block.performanceMode}">${escapeHtml(block.content)}</div>`;
}

function renderDialogueContent(content: { type: string; children: DialogueChild[]; sourceText?: string; targetText?: string }, config: PreviewConfig): string {
  if (content.type === 'paragraph') {
    return `<p class="dm-paragraph">${renderInlineChildren(content.children)}</p>`;
  }
  if (content.type === 'list') {
    return `<ul class="dm-list"><li>${renderInlineChildren(content.children)}</li></ul>`;
  }
  if (content.type === 'blockquote') {
    return `<blockquote class="dm-blockquote"><p class="dm-paragraph">${renderInlineChildren(content.children)}</p></blockquote>`;
  }
  if (content.type === 'translation') {
    const showSource = config.translationMode !== 'target-only';
    const showTarget = config.translationMode !== 'source-only';
    const sourceHtml = showSource ? `<div class="dm-translation-source">${escapeHtml(content.sourceText || '')}</div>` : '';
    const targetHtml = showTarget ? `<div class="dm-translation-target">${escapeHtml(content.targetText || '')}</div>` : '';
    if (!showSource && !showTarget) {
      return '';
    }
    return `<div class="dm-translation" data-layout="${config.translationLayout}">${sourceHtml}${targetHtml}</div>`;
  }
  return '';
}

function renderInlineChildren(children: DialogueChild[] | unknown): string {
  if (!Array.isArray(children)) return '';
  
  return children.map(child => {
    switch (child.type) {
      case 'text':
        return escapeHtml(child.value);
      case 'break':
        return '<br />';
      case 'emphasis':
        return `<em>${child.children?.map(c => escapeHtml(c.value)).join('') || ''}</em>`;
      case 'strong':
        return `<strong>${child.children?.map(c => escapeHtml(c.value)).join('') || ''}</strong>`;
      case 'inline-action':
        return `<span class="dm-inline-action">{${escapeHtml(child.value || '')}}</span>`;
      case 'inline-song':
        return `<span class="dm-inline-song">${escapeHtml(child.value || '')}</span>`;
      case 'image': {
        const url = escapeHtml(child.url || '');
        const alt = escapeHtml(child.alt || '');
        const titleAttr = child.title ? ` title="${escapeHtml(child.title)}"` : '';
        return `<img class="dm-inline-image" src="${url}" alt="${alt}"${titleAttr} loading="lazy" />`;
      }
      case 'inline-spoken':
        return `<span class="dm-inline-spoken">${escapeHtml(child.value || '')}</span>`;
      case 'inline-tech-cue':
        return renderInlineTechCue({ payload: child.payload || '', color: child.color });
      default:
        return '';
    }
  }).join('');
}

function renderInlineTechCue(tc: { payload: string; color?: string }): string {
  const style = tc.color ? `style="border-color: ${tc.color}; color: ${tc.color}; background: ${tc.color}15;"` : '';
  return `<span class="dm-inline-tech-cue" ${style}>${escapeHtml(tc.payload)}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
