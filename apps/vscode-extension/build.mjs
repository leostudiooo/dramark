import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  loader: { '.json': 'json', '.css': 'text' },
  plugins: [
    {
      name: 'puppeteer-externals',
      setup(build) {
        build.onResolve({ filter: /^(spawn-sync|puppeteer\/internal\/.*)$/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
};

async function buildStandaloneRenderer() {
  const runtimeEntryPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', 'core', 'standalone-runtime.ts',
  );
  const entryCode = [
    `import { renderStandalone } from ${JSON.stringify(runtimeEntryPath)};`,
    'globalThis.DraMarkRenderer = { render: renderStandalone };',
  ].join('\n');

  const result = await esbuild.build({
    stdin: {
      contents: entryCode,
      resolveDir: path.dirname(runtimeEntryPath),
      sourcefile: 'dramark-export-runtime-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
  });

  const output = result.outputFiles?.[0]?.text;
  if (!output) {
    throw new Error('Failed to bundle standalone renderer.');
  }

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/standalone-renderer.js', output);
  console.log('built dist/standalone-renderer.js');
}

if (watch) {
  await buildStandaloneRenderer();
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('watching...');
} else {
  await Promise.all([
    esbuild.build(buildOptions),
    buildStandaloneRenderer(),
  ]);
  console.log('built');
}
