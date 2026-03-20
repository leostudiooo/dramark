import React from 'react';
import ReactDOM from 'react-dom/client';
import { DocumentEngine } from '../../../packages/app-core/index.js';
import type { OutlineItem } from '../../../src/core/index.js';
import type { DraMarkRootContent } from '../../../src/types.js';
import './styles.css';

interface RenderNode {
  type: string;
  value?: string;
  depth?: number;
  name?: string;
  sourceText?: string;
  children?: RenderNode[];
  target?: RenderNode[];
}

const INITIAL_TEXT = `---
meta:
  title: Hamlet Demo
translation:
  enabled: true
casting:
  characters:
    - name: 哈姆雷特
      actor: 演员A
tech:
  mics:
    - id: HM1
      label: Hamlet 主麦
---

# 第一幕

@哈姆雷特
= To be, or not to be
生存还是毁灭

---

$$
@奥菲莉娅
$我听见风在唱$
$$
`;

const DOC_URI = 'dramark://editor/current';

function App(): React.JSX.Element {
  const engineRef = React.useRef<DocumentEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new DocumentEngine({ debounceMs: 180 });
  }

  const initialSnapshot = React.useMemo(
    () => {
      const engine = engineRef.current!;
      engine.openDocument(DOC_URI, INITIAL_TEXT);
      return engine.getSnapshot(DOC_URI)!;
    },
    [],
  );

  const [sourceText, setSourceText] = React.useState(INITIAL_TEXT);
  const [activeLine, setActiveLine] = React.useState<number | null>(null);
  const [viewModel, setViewModel] = React.useState(initialSnapshot.viewModel);

  React.useEffect(() => {
    const engine = engineRef.current!;
    return engine.subscribe((snapshot) => {
      if (snapshot.uri === DOC_URI) {
        setViewModel(snapshot.viewModel);
      }
    });
  }, []);

  React.useEffect(() => {
    engineRef.current!.updateDocument(DOC_URI, sourceText);
  }, [sourceText]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>DraMark Web MVP</h1>
          <p>Legacy parser | Debounced parse | Actor script preview</p>
        </div>
        <div className="status-badges">
          <span>Warnings {viewModel.warnings.length}</span>
          <span>Diagnostics {viewModel.diagnostics.length}</span>
        </div>
      </header>

      <main className="layout-grid">
        <section className="panel panel-editor">
          <h2>Source</h2>
          <textarea
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setActiveLine(null);
            }}
            spellCheck={false}
            aria-label="DraMark source editor"
          />
        </section>

        <section className="panel panel-preview">
          <h2>Actor Preview</h2>
          <div className="preview-content">{renderNodes(viewModel.tree.children)}</div>
        </section>

        <section className="panel panel-warning">
          <h2>Warnings & Diagnostics</h2>
          <ul className="list">
            {viewModel.diagnostics.length === 0 && <li>No diagnostics</li>}
            {viewModel.diagnostics.map((item: { source: string; code: string; message: string; line?: number; column?: number }, index: number) => (
              <li key={`${item.code}-${index}`}>
                <button
                  type="button"
                  className={item.line === activeLine ? 'active' : ''}
                  onClick={() => {
                    if (item.line !== undefined) {
                      setActiveLine(item.line);
                    }
                  }}
                >
                  <strong>[{item.source}]</strong> {item.code}
                  {item.line !== undefined ? ` @${item.line}:${item.column ?? 1}` : ''}
                  <br />
                  <span>{item.message}</span>
                </button>
              </li>
            ))}
          </ul>
          {activeLine !== null && <p className="hint">Selected line: {activeLine}</p>}
        </section>

        <section className="panel panel-outline">
          <h2>Outline</h2>
          <OutlineList items={viewModel.outline} />

          <h2>Config</h2>
          <pre>{JSON.stringify(viewModel.config, null, 2)}</pre>
        </section>
      </main>
    </div>
  );
}

function OutlineList({ items }: { items: OutlineItem[] }): React.JSX.Element {
  return (
    <ul className="list">
      {items.length === 0 && <li>No outline items</li>}
      {items.map((item, index) => (
        <li key={`${item.kind}-${index}`}>
          <span className="outline-kind">{item.kind}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function renderNodes(nodes: DraMarkRootContent[]): React.JSX.Element[] {
  return nodes.map((node, index) => <div key={`root-${index}`}>{renderNode(node)}</div>);
}

function renderNode(node: DraMarkRootContent | RenderNode): React.JSX.Element {
  if (node.type === 'character-block') {
    return (
      <article className="preview-card character-card">
        <h3>@{node.name ?? ''}</h3>
        {(node.children ?? []).map((child, childIndex) => (
          <div key={`character-child-${childIndex}`}>{renderNode(child as DraMarkRootContent)}</div>
        ))}
      </article>
    );
  }

  if (node.type === 'song-container') {
    return (
      <article className="preview-card song-card">
        <h3>Song</h3>
        {(node.children ?? []).map((child, childIndex) => (
          <div key={`song-child-${childIndex}`}>{renderNode(child as DraMarkRootContent)}</div>
        ))}
      </article>
    );
  }

  if (node.type === 'heading') {
    const content = renderPhrasingChildren((node as RenderNode).children);
    return <h3>{content}</h3>;
  }

  if (node.type === 'thematicBreak') {
    return <hr />;
  }

  if (node.type === 'translation-pair') {
    return (
      <div className="translation-pair">
        <p className="translation-source">= {node.sourceText ?? ''}</p>
        {(node.target ?? []).map((targetNode, index) => (
          <div key={`target-${index}`}>{renderMarkdownBlock(targetNode as RenderNode)}</div>
        ))}
      </div>
    );
  }

  if (node.type === 'paragraph') {
    return <p>{renderPhrasingChildren((node as RenderNode).children)}</p>;
  }

  if (node.type === 'list') {
    return (
      <ul>
        {(node.children ?? []).map((item, itemIndex) => (
          <li key={`list-item-${itemIndex}`}>{renderMarkdownBlock(item as RenderNode)}</li>
        ))}
      </ul>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote>
        {(node.children ?? []).map((item, itemIndex) => (
          <div key={`blockquote-item-${itemIndex}`}>{renderMarkdownBlock(item as RenderNode)}</div>
        ))}
      </blockquote>
    );
  }

  if (node.type === 'frontmatter') {
    return <p className="muted">frontmatter loaded</p>;
  }

  if (node.type === 'block-tech-cue') {
    return <pre className="block-tech-cue">{node.value ?? ''}</pre>;
  }

  if (node.type === 'comment-line' || node.type === 'comment-block') {
    return <p className="muted">[{node.type}]</p>;
  }

  return <p className="muted">[{node.type}]</p>;
}

function renderMarkdownBlock(node: RenderNode): React.JSX.Element {
  if (node.type === 'paragraph') {
    return <p>{renderPhrasingChildren(node.children)}</p>;
  }

  if (node.type === 'list') {
    return (
      <ul>
        {(node.children ?? []).map((child, index) => (
          <li key={`nested-list-item-${index}`}>{renderMarkdownBlock(child)}</li>
        ))}
      </ul>
    );
  }

  if (node.type === 'listItem') {
    return (
      <>
        {(node.children ?? []).map((child, index) => (
          <div key={`list-item-child-${index}`}>{renderMarkdownBlock(child)}</div>
        ))}
      </>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote>
        {(node.children ?? []).map((child, index) => (
          <div key={`nested-blockquote-${index}`}>{renderMarkdownBlock(child)}</div>
        ))}
      </blockquote>
    );
  }

  if (node.type === 'text') {
    return <>{node.value}</>;
  }

  return <p>{flattenTextFromNode(node)}</p>;
}

function renderPhrasingChildren(children?: RenderNode[]): React.ReactNode {
  if (!Array.isArray(children)) {
    return '';
  }

  return children.map((child, index) => {
    if (child.type === 'text') {
      return <React.Fragment key={`text-${index}`}>{child.value}</React.Fragment>;
    }

    if (child.type === 'emphasis') {
      return <em key={`emphasis-${index}`}>{renderPhrasingChildren(child.children)}</em>;
    }

    if (child.type === 'strong') {
      return <strong key={`strong-${index}`}>{renderPhrasingChildren(child.children)}</strong>;
    }

    if (child.type === 'inline-action') {
      return (
        <span key={`action-${index}`} className="inline-action">
          {`{${flattenTextFromNode(child)}}`}
        </span>
      );
    }

    if (child.type === 'inline-song') {
      return (
        <span key={`song-${index}`} className="inline-song">
          {child.value}
        </span>
      );
    }

    if (child.type === 'inline-tech-cue') {
      return (
        <span key={`cue-${index}`} className="inline-tech-cue">
          {'<<'}{child.value ?? ''}{'>>'}
        </span>
      );
    }

    if ('children' in child && Array.isArray(child.children)) {
      return <React.Fragment key={`nested-${index}`}>{renderPhrasingChildren(child.children)}</React.Fragment>;
    }

    if ('value' in child && typeof child.value === 'string') {
      return <React.Fragment key={`value-${index}`}>{child.value}</React.Fragment>;
    }

    return null;
  });
}

function flattenTextFromNode(node: RenderNode): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => flattenTextFromNode(child)).join('').trim();
  }

  return '';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
