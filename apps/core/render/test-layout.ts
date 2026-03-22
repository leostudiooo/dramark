import { convertAstToRenderBlocks, buildColumnarLayout } from './ast-to-blocks.js';
import type { RenderContext, RenderBlock } from './types.js';

// 创建一个模拟的 AST，包含 character 和其中的 comment-block
const mockAst = {
  type: 'root',
  children: [
    {
      type: 'character-block',
      name: '小塔',
      names: ['小塔'],
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '哈？' }]
        },
        {
          type: 'comment-block',
          value: '这是一个块注释测试\n在多行上'
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '更多台词' }]
        }
      ]
    },
    {
      type: 'block-tech-cue',
      value: 'LX: SPOT_DUO 灯光变化'
    },
    {
      type: 'character-block',
      name: '小帕',
      names: ['小帕'],
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '嗯？' }]
        }
      ]
    }
  ]
};

const context: RenderContext = {
  ast: mockAst,
  techConfig: { mics: [] },
  config: {
    showTechCues: true,
    showComments: true,
    translationMode: 'bilingual',
    translationLayout: 'side-by-side',
    theme: 'light'
  },
  theme: {
    name: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      border: '#e0e0e0',
      text: '#333333',
      textMuted: '#666666',
      character: '#2196f3',
      song: '#9c27b0',
      techCue: '#ff9800',
      comment: '#4caf50',
      highlight: '#ffeb3b'
    },
    typography: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
      lineHeight: 1.6
    }
  },
  techColorMap: new Map()
};

const blocks = convertAstToRenderBlocks(context);
console.log('\n=== Render Blocks ===\n');
blocks.forEach((block, i) => {
  console.log(`Block ${i}: ${block.type}`);
  if (block.type === 'character') {
    console.log(`  Names: ${block.names.join(', ')}`);
    console.log(`  Comments count: ${block.comments.length}`);
    block.comments.forEach((c, j) => {
      console.log(`    Comment ${j}: "${c.content.slice(0, 30)}..."`);
    });
  }
  if (block.type === 'tech-cue') {
    console.log(`  Variant: ${block.variant}`);
    console.log(`  Payload: ${block.payload.slice(0, 30)}`);
  }
});

const layout = buildColumnarLayout(blocks, context);
console.log('\n=== Columnar Layout ===\n');
console.log(`Left (tech-cues): ${layout.left.length} items`);
console.log(`Center: ${layout.center.length} items`);
console.log(`Right (comments): ${layout.right.length} items`);
console.log(`\nRows (${layout.rows.length}):`);
layout.rows.forEach((row, i) => {
  const left = row.left ? (row.left.type === 'tech-cue' ? `TechCue: ${row.left.payload.slice(0, 20)}` : 'TechCue') : 'null';
  const center = row.center ? (row.center.type === 'character' ? `Character: ${row.center.names?.[0] || '?'}` : row.center.type) : 'null';
  const right = row.right ? `Comment: ${row.right.content.slice(0, 20)}...` : 'null';
  console.log(`  Row ${i}: left=${left}, center=${center}, right=${right}`);
});
