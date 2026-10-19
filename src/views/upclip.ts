import { titleAndPlace } from '../examples';
import { onResults } from '../results';
import { loadUpClip, type PhotoInfo, type UpClipFile } from './qualities';

const BASE = import.meta.env.BASE_URL;
const TOP_DESCRIPTIONS = 5;
const TOP_PHOTOS = 8;

interface Recall {
  'R@1': number;
  'R@5': number;
  'R@10': number;
}
interface ModelRetrieval {
  full: { imageToText: Recall; textToImage: Recall };
  deduplicated: { imageToText: Recall; textToImage: Recall };
}
interface RetrievalTest {
  testPool?: number;
  dedupedPool?: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * UP-CLIP in the Qualities view: the descriptions that best match the current photo, and the example
 * photos that best match a chosen description, for the reproduction and for plain CLIP. Every score
 * says whether its use is one the authors tested (perception words) or an adaptation (principles).
 */
export function mountUpClip(container: HTMLElement, pickPhoto: (id: string) => void, photos: () => Map<string, PhotoInfo>): void {
  let modelId = 'up-clip-reproduction';
  let description: string | undefined;
  let photoId: string | undefined;
  let data: UpClipFile | null = null;

  const heading = el('h3', 'panel-heading upclip-heading', 'Descriptions and photos · UP-CLIP');
  const switcher = el('div', 'quality-switch');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Model');
  const forPhoto = el('div');
  const select = el('select', 'upclip-select');
  select.id = 'upclip-description';
  const selectLabel = el('label', 'section-label', 'Photos that match a description');
  selectLabel.htmlFor = select.id;
  const grid = el('ul', 'upclip-photos');
  const caption = el(
    'p',
    'agreement-caption',
    'UP-CLIP (Huang, Song & Jiao 2026) was trained on street-view photos from Wuhan to match photos with descriptions of how a street feels. Its trained model is not published, so this is the authors’ own training script re-run on their public sample of 1,000 of the 15,000 pairs. Scores compare descriptions within one model only. The principle descriptions are our adaptation, not tested by the authors, and CLIP cannot show where in the photo a match comes from.',
  );
  const retrieval = el('details', 'quality-definitions');
  select.addEventListener('change', () => {
    description = select.value;
    renderPhotos();
  });
  container.replaceChildren(heading, switcher, forPhoto, selectLabel, select, grid, caption, retrieval);

  function badge(use: 'supported' | 'adaptation', kind: string): HTMLElement {
    return el('span', `upclip-badge${use === 'adaptation' ? ' adaptation' : ''}`, kind === 'perception' ? 'Perception word · as published' : 'Principle description · adaptation');
  }

  function renderSwitch() {
    if (!data) return;
    switcher.replaceChildren(
      ...data.models.map((m) => {
        const button = el('button', 'model-button', m.id === 'up-clip-reproduction' ? 'UP-CLIP reproduction' : 'Plain CLIP');
        button.type = 'button';
        button.title = m.name;
        button.setAttribute('aria-pressed', String(m.id === modelId));
        button.addEventListener('click', () => {
          modelId = m.id;
          render();
        });
        return button;
      }),
    );
  }

  function renderForPhoto() {
    if (!data || !photoId) return forPhoto.replaceChildren();
    const row = data.photos.indexOf(photoId);
    const sims = data.similarity[modelId]?.[row];
    if (row < 0 || !sims) return forPhoto.replaceChildren();
    const order = sims.map((s, k) => [s, k] as const).sort((a, b) => b[0] - a[0]).slice(0, TOP_DESCRIPTIONS);
    const list = el('ol', 'upclip-list');
    for (const [s, k] of order) {
      const d = data.descriptions[k];
      const li = el('li');
      li.append(el('span', undefined, d.text), el('span', 'upclip-score', s.toFixed(3)), badge(d.use, d.kind));
      list.append(li);
    }
    forPhoto.replaceChildren(el('h4', 'section-label', 'Descriptions that best match this photo'), list);
  }

  function renderSelect() {
    if (!data) return;
    const groups: [string, string][] = [
      ['perception', 'Perception words (as published)'],
      ['principle', 'Principle descriptions (adaptation)'],
    ];
    select.replaceChildren(
      ...groups.map(([kind, label]) => {
        const group = el('optgroup');
        group.label = label;
        for (const d of data!.descriptions.filter((x) => x.kind === kind)) {
          const option = el('option', undefined, d.text);
          option.value = d.id;
          group.append(option);
        }
        return group;
      }),
    );
    description ??= data.descriptions[0]?.id;
    if (description) select.value = description;
  }

  function renderPhotos() {
    if (!data || !description) return grid.replaceChildren();
    const k = data.descriptions.findIndex((d) => d.id === description);
    const sims = data.similarity[modelId];
    if (k < 0 || !sims) return grid.replaceChildren();
    const info = photos();
    const order = data.photos.map((id, i) => [sims[i][k], id] as const).sort((a, b) => b[0] - a[0]).slice(0, TOP_PHOTOS);
    grid.replaceChildren(
      ...order.map(([s, id], rank) => {
        const p = info.get(id);
        const li = el('li');
        const button = el('button', 'upclip-photo');
        button.type = 'button';
        button.setAttribute('aria-current', String(id === photoId));
        if (p) {
          const img = el('img');
          img.src = `${BASE}examples/${p.file.replace(/\.jpg$/, '-thumb.jpg')}`;
          img.alt = titleAndPlace(p);
          img.loading = 'lazy';
          img.width = 320;
          img.height = Math.round((320 * p.height) / p.width);
          button.append(img);
        }
        button.append(el('span', undefined, `${rank + 1}. ${p?.title ?? id} · ${s.toFixed(3)}`));
        button.addEventListener('click', () => pickPhoto(id));
        li.append(button);
        return li;
      }),
    );
  }

  function renderRetrieval() {
    if (!data) return;
    const test = (data as unknown as { retrievalTest?: RetrievalTest }).retrievalTest ?? {};
    const table = el('table', 'agreement-matrix quality-methods-table');
    const head = el('tr');
    for (const h of ['Model', 'Photo → description R@1 / R@5 / R@10', 'Description → photo R@1 / R@5 / R@10']) head.append(el('th', undefined, h));
    table.append(head);
    for (const m of data.models) {
      const r = m.retrieval as ModelRetrieval;
      const tr = el('tr');
      const th = el('th', undefined, m.name);
      th.scope = 'row';
      const fmt = (x: Recall) => `${pct(x['R@1'])} / ${pct(x['R@5'])} / ${pct(x['R@10'])}`;
      tr.append(th, el('td', 'quality-value', fmt(r.full.imageToText)), el('td', 'quality-value', fmt(r.full.textToImage)));
      table.append(tr);
    }
    const wrap = el('div', 'agreement-wrap');
    wrap.append(table);
    retrieval.replaceChildren(
      el('summary', undefined, 'How well does the reproduction retrieve?'),
      el(
        'p',
        'agreement-caption',
        `On the ${test.testPool ?? 200} held-out pairs of the authors’ sample: how often the right caption (or photo) is the first, among the first five, or among the first ten. The paper reports Recall@5 above 70% on its own, larger test set, so the figures are not comparable.`,
      ),
      wrap,
    );
  }

  function render() {
    renderSwitch();
    renderForPhoto();
    renderPhotos();
  }

  onResults(async (results) => {
    const id = results.image.exampleId;
    if (id === photoId && data) return;
    photoId = id;
    if (!id) return container.replaceChildren();
    data ??= await loadUpClip();
    if (!data) return container.replaceChildren();
    if (!container.contains(heading)) container.replaceChildren(heading, switcher, forPhoto, selectLabel, select, grid, caption, retrieval);
    if (!select.options.length) {
      renderSelect();
      renderRetrieval();
    }
    render();
  });
}
