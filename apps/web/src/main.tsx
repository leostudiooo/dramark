import React from 'react';
import ReactDOM from 'react-dom/client';
import { createParseViewModel } from '../../../src/core/index.js';
import type { OutlineItem } from '../../../src/core/index.js';
import type { DraMarkRootContent } from '../../../src/types.js';
import './styles.css';

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

function App(): React.JSX.Element {
  const [sourceText, setSourceText] = React.useState(INITIAL_TEXT);
  const [activeLine, setActiveLine] = React.useState<number | null>(null);
  const [viewModel, setViewModel] = React.useState(() => createParseViewModel(INITIAL_TEXT));

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setViewModel(createParseViewModel(sourceText));
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
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
  return nodes.map((node, index) => {
    if (node.type === 'character-block') {
      return (
        <article key={`character-${index}`} className="preview-card character-card">
          <h3>@{node.name}</h3>
          {node.children.map((child, childIndex) => (
            <div key={`character-child-${childIndex}`}>{renderNode(child)}</div>
          ))}
        </article>
      );
    }

    if (node.type === 'song-container') {
      return (
        <article key={`song-${index}`} className="preview-card song-card">
          <h3>Song</h3>
          {node.children.map((child, childIndex) => (
            <div key={`song-child-${childIndex}`}>{renderNode(child)}</div>
          ))}
        </article>
      );
    }

    return <div key={`root-${index}`}>{renderNode(node)}</div>;
  });
}

function renderNode(node: DraMarkRootContent): React.JSX.Element {
  if (node.type === 'heading') {
    const content = flattenText(node as unknown as { children?: Array<{ value?: string }> });
    return <h3>{content}</h3>;
  }

  if (node.type === 'thematicBreak') {
    return <hr />;
  }

  if (node.type === 'translation-pair') {
    return (
      <div className="translation-pair">
        <p className="translation-source">= {node.sourceText}</p>
        {node.target.map((targetNode, index) => (
          <p key={`target-${index}`}>{flattenText(targetNode as unknown as { children?: Array<{ value?: string }>; value?: string })}</p>
        ))}
      </div>
    );
  }

  if (node.type === 'paragraph') {
    return <p>{flattenText(node as unknown as { children?: Array<{ value?: string }> })}</p>;
  }

  if (node.type === 'frontmatter') {
    return <p className="muted">frontmatter loaded</p>;
  }

  if (node.type === 'comment-line' || node.type === 'comment-block' || node.type === 'block-tech-cue') {
    return <p className="muted">[{node.type}]</p>;
  }

  return <p className="muted">[{node.type}]</p>;
}

function flattenText(node: { value?: string; children?: Array<{ value?: string; children?: Array<{ value?: string }> }> }): string {
  if (typeof node.value === 'string') {
    return node.value;
  }
  if (!Array.isArray(node.children)) {
    return '';
  }

  return node.children
    .map((child) => flattenText(child as { value?: string; children?: Array<{ value?: string }> }))
    .join('')
    .trim();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
