# DraMark Web App + VS Code 插件架构重设计（v2）

> 状态：proposal（可直接进入实现）  
> 日期：2026-03-20

## 1. 设计目标

本次重设计目标不是增加功能点，而是把 Web 与 VS Code 插件从“各自拼装 parse 结果”的模式，升级为“共享同一文档引擎 + 同一渲染模型 + 同一诊断协议”的架构。

目标如下：

- 同一份 DraMark 源文在 Web 与 VS Code 中得到一致的 AST、诊断、outline 与渲染行为。
- 把 parse 与 UI 解耦，允许在 Worker/Extension Host 中独立演进性能策略。
- 保留现有 `src/core` 能力，避免大规模重写 parser。
- 为后续能力预留清晰扩展位：角色筛选、换麦事件、多视图渲染、增量解析。

## 2. 当前问题

基于现状（`apps/web/src/main.tsx` + `src/core/*`）的主要瓶颈：

- Web 侧 UI、状态、渲染映射与解析调度集中在单文件，模块边界弱。
- VS Code 插件尚未成型，没有与 Web 共享的前端协议和渲染运行时。
- 诊断、配置归一化、outline 已在 `src/core`，但缺少“文档生命周期引擎”层来统一调度。
- 解析过程缺少可观测的 session/cache 策略，后续性能优化缺入口。

## 3. v2 总体架构

统一分为四层：

1. 语言层（Language Layer）：`src/parser.ts` + `src/m2-extensions.ts` + `src/core`。
2. 文档引擎层（Document Engine Layer）：新增共享引擎，负责调度 parse、聚合 view model、管理增量状态与订阅。
3. 平台适配层（Platform Adapter Layer）：Web Worker 适配器、VS Code Extension Host 适配器。
4. 界面层（Presentation Layer）：Web React UI 与 VS Code Webview UI，共享渲染组件与消息协议。

核心原则：

- “解析与诊断”只发生在引擎层。
- “UI 不直接调用 `parseDraMark`”，只消费引擎快照。
- Web 与 VS Code 通过同一协议传递 `DocumentSnapshot`。

## 4. 目录重组建议

建议在 monorepo 内形成如下结构（保持 `src/` 现有语义核心不动）：

```text
src/
  ... parser + core (保留)

packages/
  app-core/
    document-engine.ts
    snapshot-cache.ts
    diagnostics-pipeline.ts
    protocol.ts
  ui-renderer/
    model-to-react.ts
    components/
    themes/

apps/
  web/
    src/
      app/
      features/
      adapters/web-worker-client.ts
      main.tsx

  vscode-extension/
    package.json
    src/
      extension.ts
      document-controller.ts
      diagnostics.ts
      preview-panel.ts
      webview/
        index.html
        main.tsx
```

说明：

- `apps/core` 负责“平台无关业务编排”。
- `packages/ui-renderer` 负责“跨端可复用 UI”。
- `apps/vscode-extension/webview` 与 `apps/web` 尽量共享同一 React 组件。

## 5. 共享文档引擎（Document Engine）

新增统一接口：

```ts
export interface DocumentSnapshot {
  uri: string;
  version: number;
  sourceText: string;
  viewModel: ParseViewModel;
  generatedAt: number;
  elapsedMs: number;
}

export interface DocumentEngine {
  openDocument(uri: string, sourceText: string): void;
  updateDocument(uri: string, sourceText: string, version: number): void;
  closeDocument(uri: string): void;
  getSnapshot(uri: string): DocumentSnapshot | undefined;
  subscribe(listener: (snapshot: DocumentSnapshot) => void): () => void;
}
```

职责：

- 统一调用 `createParseViewModel`。
- 实现 debounce/cancel-last（同一文档多次输入时只落地最新版本）。
- 记录性能指标（parse 耗时、文档大小、warning 数）。
- 统一提供 `multipassDebug` 数据出口（debug mode）。

## 6. Web App 架构（v2）

### 6.1 模块拆分

- `app/`：路由、布局、主题、全局 providers。
- `features/editor/`：文本编辑、行定位、selection 状态。
- `features/preview/`：Actor 视图渲染。
- `features/diagnostics/`：告警列表与跳转。
- `features/outline/`：场景大纲。
- `features/config/`：frontmatter 配置视图。
- `adapters/web-worker-client.ts`：与 Worker 中 Document Engine 通信。

### 6.2 线程模型

- 主线程：仅做 UI。
- Worker：运行 Document Engine + parser。
- 传输对象：`DocumentSnapshot`（结构化克隆）。

### 6.3 状态模型

- UI 本地状态：选中行、面板折叠、过滤条件。
- 文档状态：来自引擎快照（单向流）。
- 不允许 UI 自行 recompute diagnostics/outline，避免双份逻辑。

## 7. VS Code 插件架构（v2）

### 7.1 Extension Host

- `document-controller.ts`
  - 监听 `onDidOpenTextDocument` / `onDidChangeTextDocument` / `onDidCloseTextDocument`
  - 把文本变化送入 Document Engine
- `diagnostics.ts`
  - 把 `viewModel.diagnostics` 映射为 `vscode.Diagnostic`
- `preview-panel.ts`
  - 管理 Webview 生命周期
  - 向 Webview 推送 `DocumentSnapshot`

### 7.2 Webview

- 只负责渲染，不直接解析。
- 接收 host 的快照消息后更新 UI。
- 复用 `packages/ui-renderer` 的组件与样式 token。

### 7.3 命令面

- `dramark.showPreview`：打开/聚焦预览。
- `dramark.toggleDebugSnapshot`：显示 pass 快照。
- `dramark.copyDiagnostics`：导出当前诊断。

## 8. 跨端协议

定义统一消息协议（Web Worker 与 VS Code Webview 共享）：

```ts
type EngineMessage =
  | { type: 'document/update'; uri: string; version: number; sourceText: string }
  | { type: 'document/close'; uri: string }
  | { type: 'snapshot/push'; snapshot: DocumentSnapshot }
  | { type: 'engine/error'; uri: string; message: string };
```

要求：

- 所有消息可序列化。
- `snapshot/push` 必须幂等（同版本重复消息不触发重复渲染）。
- 每条错误消息必须带 `uri`，便于多文档场景定位。

## 9. 迁移步骤

### Phase A：抽离引擎（低风险）

- 从 `apps/web/src/main.tsx` 抽出 document engine。
- 保持现有 UI 不变，仅替换 parse 调用入口。

### Phase B：Web Worker 化

- 把引擎放入 Worker。
- 接入消息协议与快照缓存。

### Phase C：VS Code Extension MVP

- 建立 `apps/vscode-extension`。
- 完成 extension host 文档监听、诊断输出、webview 预览。

### Phase D：跨端 UI 复用

- 抽出 `packages/ui-renderer`。
- Web 与 Webview 共享预览与诊断组件。

## 10. 验收标准

- 同一输入文本在 Web 与 VS Code 产出相同 `viewModel.diagnostics`（code/line/column 一致）。
- 同一输入文本在 Web 与 VS Code 产出相同 outline 序列。
- 10k 行文档连续输入时，UI 主线程无明显卡顿（Web 在 Worker 模式下保持流畅滚动）。
- debug 模式下可查看 `multipassDebug.pass0/pass1/pass2/pass4`。
- 任一端修复渲染 bug 时，另一端无需重复实现（共享组件生效）。

## 11. 风险与对策

- 风险：跨端消息协议频繁改动导致双端联调成本高。
  - 对策：先冻结 `DocumentSnapshot` 最小字段，新增字段仅追加不破坏。
- 风险：VS Code webview CSP 限制影响资源加载。
  - 对策：UI 资源全部走本地打包产物，禁止远程脚本。
- 风险：大文档快照传输开销偏高。
  - 对策：先全量快照，后续按需引入 patch/delta 协议。

## 12. 与现有实现的兼容策略

- 保留 `src/core` API：`createParseViewModel` 继续作为语义入口。
- 不改变 parser 对 frontmatter 的职责边界（仍由应用层做 schema 与外链处理）。
- `apps/web` 先做“重构不改行为”，再逐步引入新特性。

---

该方案的核心价值是：把“语言能力”与“平台能力”真正分层，让 Web 和 VS Code 插件共享同一条语义链路，避免双端漂移。
