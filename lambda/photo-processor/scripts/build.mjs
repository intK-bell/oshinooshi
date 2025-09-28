import { build } from 'esbuild';
import { mkdir, rm, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outDir = resolve('dist');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ['src/handler.js'],
  outfile: resolve(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['sharp'],
  format: 'cjs',
  sourcemap: false,
  minify: false
});

await copyFile('package.json', resolve(outDir, 'package.json'));
