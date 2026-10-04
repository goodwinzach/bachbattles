// Bundles src/ into one self-contained HTML file (works offline, from file://, or on any static host).
// Outputs:
//   dist/index.html        full document
//   .build/artifact.html   body fragment for publishing as a claude.ai Artifact
import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

const FONTS =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900' +
  '&family=Cinzel:wght@600;700&family=Courier+Prime:ital,wght@0,400;0,700;1,400' +
  '&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';

const options = {
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  write: false,
  outdir: join(root, '.build/out'),
  format: 'iife',
  target: ['es2020', 'chrome105', 'safari15', 'firefox110'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !watch,
  legalComments: 'none',
  sourcemap: false,
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'warning',
};

async function emit(result) {
  const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  const template = await readFile(join(root, 'src/template.html'), 'utf8');
  const html = template
    .replace('%FONTS%', FONTS)
    .replace('<!--STYLE-->', () => `<style>${safeCss}</style>`)
    .replace('<!--SCRIPT-->', () => `<script>${safeJs}</script>`);
  const titleMatch = template.match(/<title>.*?<\/title>/s)?.[0] ?? '';
  const fragment = [
    titleMatch,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${FONTS}">`,
    `<style>${safeCss}</style>`,
    `<div id="app"></div>`,
    `<script>${safeJs}</script>`,
  ].join('\n');
  await mkdir(join(root, 'dist'), { recursive: true });
  await mkdir(join(root, '.build'), { recursive: true });
  await writeFile(join(root, 'dist/index.html'), html);
  await writeFile(join(root, '.build/artifact.html'), fragment);
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`built dist/index.html (${kb(html.length)}; js ${kb(js.length)}, css ${kb(css.length)})`);
}

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: 'emit', setup(b) { b.onEnd((r) => r.errors.length || emit(r)); } }],
  });
  await ctx.watch();
  console.log('watching src/ … open dist/index.html and refresh after changes');
} else {
  const result = await esbuild.build(options);
  await emit(result);
}
