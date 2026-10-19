import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const BASE = '/eek-a-look/';

interface Photo {
  id: string;
  area: string;
  city?: string;
  title: string;
  file: string;
  width: number;
  height: number;
  measured?: object;
  study?: object;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Renders the example picker into index.html at build time, so the thumbnails
 * are part of the first paint instead of pushing the page down when the
 * manifest arrives. src/examples.ts attaches behaviour to this markup and
 * renders the same structure itself if it is missing.
 */
function prerenderPicker(): Plugin {
  return {
    name: 'eek-a-look:prerender-picker',
    transformIndexHtml(html) {
      const photos: Photo[] = JSON.parse(readFileSync('public/examples/examples.json', 'utf8'));
      const areas = [...new Set(photos.map((p) => p.area))];
      const groups = areas
        .map((area) => {
          const inArea = photos.filter((p) => p.area === area);
          const buttons = inArea
            .map((p) => {
              const thumb = `${BASE}examples/${p.file.replace(/\.jpg$/, '-thumb.jpg')}`;
              const h = Math.round((320 * p.height) / p.width);
              const measured = p.measured ? ' data-measured=""' : '';
              return `<button type="button" class="example" data-id="${escape(p.id)}"${measured} title="${escape(p.title)}" aria-pressed="false"><img src="${thumb}" alt="${escape(p.city ? `${p.title}, ${p.city}` : p.title)}" width="320" height="${h}"></button>`;
            })
            .join('');
          const note = inArea[0].measured ? 'measured eye tracking' : inArea[0].study ? 'predictions only' : (inArea[0].city ?? '');
          return `<div class="example-group"><h3 class="example-area">${escape(area)} <span>${escape(note)}</span></h3><div class="example-list">${buttons}</div></div>`;
        })
        .join('');
      const first = photos[0];
      return html
        .replace('<div id="examples" class="examples"></div>', `<div id="examples" class="examples">${groups}</div>`)
        .replace('<div id="stage" class="stage">', `<div id="stage" class="stage" style="aspect-ratio: ${first.width} / ${first.height}">`);
    },
  };
}

// `npm run local` only: the browser reaches the DeepGaze GPU helper through its
// own origin. The public site has no such path.
const localApi = {
  [`${BASE}local-api`]: {
    target: 'http://127.0.0.1:8765',
    rewrite: (path: string) => path.slice(`${BASE}local-api`.length),
  },
};

// The host's proxy cache can keep serving an old compressed copy of the manifest
// after a deploy, so the page asks for it with a version that changes with its content.
const examplesVersion = createHash('sha256').update(readFileSync('public/examples/examples.json')).digest('hex').slice(0, 10);

/** One content hash over every file in public folders (and their subfolders), for versioned URLs of pre-computed data. */
function folderVersion(...paths: string[]): string {
  const hash = createHash('sha256');
  const add = (path: string) => {
    if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) add(`${path}/${name}`);
    else hash.update(path).update(readFileSync(path));
  };
  paths.forEach(add);
  return hash.digest('hex').slice(0, 10);
}

export default defineConfig({
  base: BASE,
  plugins: [prerenderPicker()],
  define: {
    __EXAMPLES_VERSION__: JSON.stringify(examplesVersion),
    __AREAS_VERSION__: JSON.stringify(folderVersion('public/precomputed/areas')),
    __PANEL_VERSION__: JSON.stringify(folderVersion('public/precomputed/vlm-panel')),
    __QUALITIES_VERSION__: JSON.stringify(folderVersion('public/precomputed/qualities')),
    __UPCLIP_VERSION__: JSON.stringify(folderVersion('public/precomputed/up-clip')),
    __COMPARISONS_VERSION__: JSON.stringify(folderVersion('public/examples/comparisons.json', 'public/precomputed/comparisons')),
  },
  server: { proxy: localApi },
  preview: { proxy: localApi },
  build: {
    sourcemap: false,
    // The rating page for human raters (prompt 059), not linked from the main page. The main entry keeps
    // the name "index": the deploy workflow checks the live page for assets/index-*.js.
    rollupOptions: { input: { index: 'index.html', rate: 'rate.html' } },
  },
  // onnxruntime-web loads its WebAssembly at run time; pre-bundling breaks those paths.
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
