import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', 'esbuild'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  loader: { '.json': 'json' },
};

if (watch) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('watching...');
} else {
  await esbuild.build(buildOptions);
  console.log('built');
}
