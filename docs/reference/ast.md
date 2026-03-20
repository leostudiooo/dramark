# AST 节点类型

DraMark 解析器产生以下自定义 MDAST 节点类型。

## 块级节点

### Document

根节点。

```typescript
interface Document {
  frontmatter: any;
  blocks: Block[];
}
```

### CharacterBlock

角色块。

```typescript
interface CharacterBlock {
  type: "CharacterBlock";
  character: string;
  aliases?: string[];
  context?: string;  // 情绪/状态提示
  children: (Dialogue | AttachedNode | TechCueBlock)[];
}
```

### SongBlock

唱段块。

```typescript
interface SongBlock {
  type: "SongBlock";
  title?: string;
  children: (CharacterBlock | SpokenSegment | GlobalAction | TechCueBlock | AttachedNode)[];
}
```

### SpokenSegment

念白段落。

```typescript
interface SpokenSegment {
  type: "SpokenSegment";
  children: (CharacterBlock | GlobalAction | TechCueBlock | AttachedNode)[];
}
```

### TranslationBlock

译配块。

```typescript
interface TranslationBlock {
  type: "TranslationBlock";
  source: InlineContent[];
  target: Block[];
}
```

### TechCueBlock

块级技术提示。

```typescript
interface TechCueBlock {
  type: "TechCueBlock";
  variant: "single-line" | "multi-line";
  header?: string;
  content: (TechCueInline | TextNode)[];
}
```

### GlobalAction

全局动作/场景描述。

```typescript
interface GlobalAction {
  type: "GlobalAction";
  content: Block[];
}
```

## 行内节点

### Dialogue

对话内容。

```typescript
interface Dialogue {
  type: "Dialogue";
  content: InlineContent[];
}
```

### TechCueInline

行内技术提示。

```typescript
interface TechCueInline {
  type: "TechCue";
  variant: "inline";
  content: string;
}
```

### InlineAction

行内动作提示。

```typescript
interface InlineAction {
  type: "InlineAction";
  content: string;
}
```

### InlineSongSegment

行内唱段（在念白模式中）。

```typescript
interface InlineSongSegment {
  type: "inline-song";
  value: string;
}
```

### InlineSpokenSegment

行内念白（在唱段模式中）。

```typescript
interface InlineSpokenSegment {
  type: "inline-spoken";
  value: string;
}
```

## 通用节点

### TextNode

文本节点。

```typescript
interface TextNode {
  type: "text";
  value: string;
}
```

### Comment

注释。

```typescript
interface Comment {
  type: "Comment";
  variant: "line" | "block";
  content: string;
}
```

## 类型联合

```typescript
type Block =
  | GlobalAction
  | CharacterBlock
  | SongBlock
  | SpokenSegment
  | TranslationBlock
  | TechCueBlock
  | CommonMarkBlock;

type AttachedNode =
  | TechCueInline
  | Comment;

type InlineContent =
  | TextNode
  | InlineAction
  | InlineSongSegment
  | InlineSpokenSegment
  | TechCueInline
  | CommonMarkInline;
```
