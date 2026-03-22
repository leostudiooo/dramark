import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { WebWorkerClient } from './adapters/web-worker-client.js';
import type { ParseViewModel } from '../../../src/core/index.js';
import type { PreviewConfig } from '../../../apps/core/index.js';
import {
  buildTechCueColorMap,
  convertAstToRenderBlocks,
  buildColumnarLayout,
  generateCSS,
  defaultTheme,
} from '../../../apps/core/index.js';
import { createPreviewHTML, createConfigPanelHTML, attachConfigPanelListeners } from '../../../apps/core/index.js';
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
  sfx:
    color: "#66ccff"
    entries:
      - id: BGM_ENTER
        desc: 入场音乐
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
  const client = useMemo(() => new WebWorkerClient(), []);
  const [sourceText, setSourceText] = useState(INITIAL_TEXT);
  const [viewModel, setViewModel] = useState<ParseViewModel | null>(null);
  const [config, setConfig] = useState<PreviewConfig>({
    showTechCues: true,
    showComments: true,
    translationMode: 'bilingual',
    translationLayout: 'side-by-side',
    theme: 'auto',
  });
  const [configOpen, setConfigOpen] = useState(false);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const configRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.openDocument(DOC_URI, INITIAL_TEXT).then((snapshot) => {
      setViewModel(snapshot.viewModel);
    });

    return client.subscribe((snapshot) => {
      if (snapshot.uri === DOC_URI) {
        setViewModel(snapshot.viewModel);
      }
    });
  }, [client]);

  useEffect(() => {
    if (viewModel !== null) {
      client.updateDocument(DOC_URI, sourceText);
    }
  }, [sourceText, viewModel, client]);

  // Generate preview HTML when viewModel or config changes
  const previewHTML = useMemo(() => {
    if (!viewModel) return '';

    const techConfig = viewModel.config.tech ?? { mics: [] };
    const techColorMap = buildTechCueColorMap(techConfig);
    const context = {
      ast: viewModel.tree,
      techConfig,
      config,
      theme: defaultTheme,
      techColorMap,
    };

    const blocks = convertAstToRenderBlocks(context);
    const layout = buildColumnarLayout(blocks, context);
    return createPreviewHTML({ layout, config });
  }, [viewModel, config]);

  // Generate CSS
  const previewCSS = useMemo(() => {
    return generateCSS(defaultTheme, config);
  }, [config]);

  // Attach event listeners after render
  useEffect(() => {
    if (configRef.current) {
      attachConfigPanelListeners(configRef.current, {
        config,
        onChange: setConfig,
        isOpen: configOpen,
        onToggle: () => setConfigOpen(!configOpen),
      });
    }
  }, [config, configOpen]);

  if (viewModel === null) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>DraMark Preview</h1>
            <p>Loading parser engine...</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>DraMark Preview</h1>
          <p>New renderer with tech cue colors & container queries</p>
        </div>
        <div className="status-badges">
          <span>Warnings {viewModel.warnings.length}</span>
          <span>Blocks {viewModel.tree.children?.length ?? 0}</span>
        </div>
      </header>

      <main className="layout-grid">
        <section className="panel panel-editor">
          <h2>Source</h2>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            spellCheck={false}
            aria-label="DraMark source editor"
          />
        </section>

        <section className="panel panel-preview">
          <h2>Preview</h2>
          <style>{previewCSS}</style>
          <div ref={previewRef} dangerouslySetInnerHTML={{ __html: previewHTML }} />
          <div ref={configRef} dangerouslySetInnerHTML={{
            __html: createConfigPanelHTML({
              config,
              onChange: setConfig,
              isOpen: configOpen,
              onToggle: () => setConfigOpen(!configOpen),
            })
          }} />
        </section>

        <section className="panel panel-outline">
          <h2>Outline</h2>
          <ul className="list">
            {viewModel.outline.map((item: { kind: string; label: string }, index: number) => (
              <li key={`${item.kind}-${index}`}>
                <span className="outline-kind">{item.kind}</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <h2>Config</h2>
          <pre>{JSON.stringify(viewModel.config, null, 2)}</pre>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
