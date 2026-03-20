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

  return `
    <div class="dramark-preview" data-theme="${config.theme}">
      <div class="dramark-layout dm-layout-desktop">
        <div class="dramark-left">
          ${layout.rows.map((row) => renderRowLeft(row.left)).join('')}
        </div>
        <div class="dramark-center">
          ${layout.rows.map((row) => renderRowCenter(row.center)).join('')}
        </div>
        <div class="dramark-right">
          ${layout.rows.map((row) => renderRowRight(row.right)).join('')}
        </div>
      </div>
      <div class="dramark-layout dm-layout-mobile">
        <div class="dramark-center">
          ${layout.rows.map((row) => renderRowForMobile(row)).join('')}
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

function renderRowCenter(block: RenderBlock | null): string {
  if (block === null) {
    return '<div class="dm-row-placeholder" aria-hidden="true"></div>';
  }
  return `<div class="dm-row-slot">${renderBlock(block)}</div>`;
}

function renderRowRight(block: CommentRenderBlock | null): string {
  if (block === null) {
    return '<div class="dm-row-placeholder" aria-hidden="true"></div>';
  }
  return `<div class="dm-row-slot">${renderCommentBlock(block)}</div>`;
}

function renderRowForMobile(row: { left: TechCueBlock | null; center: RenderBlock | null; right: CommentRenderBlock | null }): string {
  if (row.center !== null) {
    return renderBlock(row.center);
  }
  if (row.left !== null) {
    return renderTechCueBlock(row.left);
  }
  if (row.right !== null) {
    return renderCommentBlock(row.right);
  }
  return '';
}

function renderBlock(block: RenderBlock): string {
  switch (block.type) {
    case 'character':
      return renderCharacterBlock(block);
    case 'global-action':
      return renderGlobalActionBlock(block);
    case 'song-container':
      return renderSongContainerBlock(block);
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

function renderCharacterBlock(block: CharacterRenderBlock): string {
  const namesHtml = block.names.map(name => `<span class="dm-character-name">${escapeHtml(name)}</span>`).join('');
  const contextHtml = block.context ? `<div class="dm-character-context">${escapeHtml(block.context)}</div>` : '';
  
  const contentHtml = block.content.map(content => renderDialogueContent(content)).join('');

  const techCuesHtml = block.techCues.length > 0
    ? `<div class="dm-character-tech-cues">${block.techCues.map(tc => renderInlineTechCue(tc)).join('')}</div>`
    : '';

  return `
    <div class="dm-character" data-mode="${block.performanceMode}">
      <div class="dm-character-names">${namesHtml}</div>
      <div class="dm-character-content">
        ${contextHtml}
        ${contentHtml}
        ${techCuesHtml}
      </div>
    </div>
  `;
}

function renderGlobalActionBlock(block: GlobalActionBlock): string {
  const contentHtml = block.content.map(content => renderDialogueContent(content)).join('');

  return `<div class="dm-global-action" data-mode="${block.performanceMode}">${contentHtml}</div>`;
}

function renderSongContainerBlock(block: SongContainerBlock): string {
  const titleHtml = block.title ? `<div class="dm-song-title">${escapeHtml(block.title)}</div>` : '';
  const childrenHtml = block.children.map(child => renderBlock(child)).join('');

  return `
    <div class="dm-song-container" data-mode="sung">
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

function renderDialogueContent(content: { type: string; children: DialogueChild[] }): string {
  if (content.type === 'paragraph') {
    return `<p class="dm-paragraph">${renderInlineChildren(content.children)}</p>`;
  }
  if (content.type === 'list') {
    return `<ul class="dm-list"><li>${renderInlineChildren(content.children)}</li></ul>`;
  }
  if (content.type === 'blockquote') {
    return `<blockquote class="dm-blockquote"><p class="dm-paragraph">${renderInlineChildren(content.children)}</p></blockquote>`;
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
