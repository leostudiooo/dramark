import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  // esbuild is runtime dependency: preview-panel.ts calls esbuild.build() to compile
  // standalone-runtime.ts into browser JS for HTML/PDF export
  external: ['vscode', 'esbuild'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  loader: { '.json': 'json' },
  plugins: [
    {
      name: 'puppeteer-externals',
      setup(build) {
        build.onResolve({ filter: /^(spawn-sync|puppeteer\/internal\/.*)$/ }, () => ({
          path: '',
          external: true,
          namespace: 'puppeteer-externals',
        }));
      },
    },
  ],
};

if (watch) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('watching...');
} else {
  await esbuild.build(buildOptions);
  console.log('built');
}
