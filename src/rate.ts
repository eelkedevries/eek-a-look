import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';
import './rate.css';
import type { ExamplePhoto } from './examples';

/** Content hash of examples.json, set by vite.config.ts. */
declare const __EXAMPLES_VERSION__: string;

/**
 * The rating page (prompt 059): raters judge each example photo on the three design principles, on the
 * 2020 panel's scale, and download their ratings as CSV for `tools/qualities/agreement.py`. Nothing the
 * site computes is shown here. The rubric's wording is also in the developer notes (rating_rubric.md).
 */

type Label = 'present' | 'ambiguous' | 'absent';
type Principle = 'rhythm' | 'groundFloor' | 'materials';
interface Answer {
  rhythm?: Label;
  groundFloor?: Label;
  materials?: Label;
  note?: string;
}
interface Saved {
  initials: string;
  position: number;
  answers: Record<string, Answer>;
}

const STORAGE_KEY = 'eek-a-look:ratings:v1';
const LABELS: [Label, string][] = [
  ['present', 'Present'],
  ['ambiguous', 'Ambiguous'],
  ['absent', 'Absent'],
];
const PRINCIPLES: { id: Principle; name: string; cue: string }[] = [
  {
    id: 'rhythm',
    name: 'Horizontal–vertical rhythm and variety',
    cue: 'Façades divided into horizontal layers (base, middle, top; floor lines, cornices) and vertical units (bays, plots, columns of windows) that repeat with some variation; variety between neighbouring buildings in height, colour, material or plot width. Against: a uniform or monotonous surface, or one large building without articulation.',
  },
  {
    id: 'groundFloor',
    name: 'Active ground floor',
    cue: 'Entrances and shopfronts at street level, how often they occur and whether you can see in. Blank walls, closed façades, garage doors and service entries count against. As a guide, the Urban Design Compendium’s best frontage (grade A) has more than 15 premises and more than 25 doors and windows every 100 m and no blind façades; its worst (grade E) has 1 or 2 premises every 100 m and mostly blind or passive façades. Judge only what the photo shows, not a use you know or assume.',
  },
  {
    id: 'materials',
    name: 'Tactile materials',
    cue: 'Materials with visible texture or fine detail near eye level (within about 3 m of the ground), on the façades and in the street space: brick, natural stone, wood, tiles or setts, planting, benches and other street furniture. Smooth glass, metal, render and polished stone count against.',
  },
];
const KIND: Record<string, string> = {
  render: 'Design rendering',
  panorama: '360° panorama, shown flat',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      if (saved && typeof saved === 'object' && saved.answers) return { initials: saved.initials ?? '', position: saved.position ?? 0, answers: saved.answers };
    }
  } catch {
    // Storage may be blocked; the page still works for this visit.
  }
  return { initials: '', position: 0, answers: {} };
}

function save(state: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not saved; the download still has everything.
  }
}

/** A small seeded generator (mulberry32) so each rater's order is fixed by their initials. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const c of text.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], key: string): T[] {
  const out = [...items];
  const random = seeded(key || 'anonymous');
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const complete = (a: Answer | undefined) => !!a && PRINCIPLES.every((p) => a[p.id]);

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(photos: ExamplePhoto[], state: Saved): string {
  const rows = [['photo', 'principle', 'label', 'rater', 'note']];
  for (const photo of photos) {
    const answer = state.answers[photo.id] ?? {};
    for (const p of PRINCIPLES) rows.push([photo.id, p.id, answer[p.id] ?? '', state.initials, answer.note ?? '']);
  }
  return rows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
}

function rubric(): HTMLElement {
  const details = el('details', 'rate-rubric');
  details.append(el('summary', undefined, 'What to look at'));
  const list = el('ol');
  for (const p of PRINCIPLES) {
    const item = el('li');
    item.append(el('strong', undefined, p.name), document.createTextNode(`. ${p.cue}`));
    list.append(item);
  }
  details.append(
    el('p', undefined, 'These cues guide what to look at; they are not a scoring rule. Your own professional judgement counts.'),
    list,
    el(
      'p',
      undefined,
      'Some photos come from published studies. Design renderings are computer-made images of planned streets. 360° panoramas are shown flat: the left and right edges join, and straight lines curve. Judge them as you would a photo.',
    ),
  );
  return details;
}

/** The rating set is the 49 photos of prompt 059; the photos of Andersson et al. (2017), added in prompt 069, are not rated. */
const NOT_RATED = 'Andersson et al. (2017)';

async function loadPhotos(): Promise<ExamplePhoto[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}examples/examples.json?v=${__EXAMPLES_VERSION__}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return ((await response.json()) as ExamplePhoto[]).filter((photo) => photo.area !== NOT_RATED);
}

async function mount(root: HTMLElement): Promise<void> {
  const photos = await loadPhotos();
  const state = load();

  const intro = el('section', 'rate-intro');
  intro.append(
    el('h2', 'rate-heading', 'Rate 49 street photos on three design principles'),
    el(
      'p',
      undefined,
      'In 2020, fourteen experts judged photos of streets in high-rise areas on three design principles (Spanjar & Suurenbroek, Eye-tracking the city). We ask you the same question about 49 photos: for each photo and principle, is the principle present, ambiguous or absent? Use your own professional judgement. There are no right answers, and nothing on this page shows what any computer method decided.',
    ),
  );
  const scale = el('ul', 'rate-scale');
  for (const [term, text] of [
    ['Present', 'the principle is clearly applied in this street.'],
    ['Ambiguous', 'partly applied, or you cannot tell from the photo.'],
    ['Absent', 'not applied.'],
  ]) {
    const item = el('li');
    item.append(el('strong', undefined, `${term}: `), document.createTextNode(text));
    scale.append(item);
  }
  intro.append(scale, rubric());

  const who = el('label', 'rate-initials');
  who.append(el('span', undefined, 'Your initials'));
  const initials = el('input');
  initials.type = 'text';
  initials.maxLength = 12;
  initials.autocomplete = 'off';
  initials.value = state.initials;
  who.append(initials);
  const whoNote = el('small', undefined, 'They go into your download and set the order of the photos.');
  who.append(whoNote);

  const card = el('section', 'rate-card');
  const status = el('p', 'rate-status');
  const figure = el('figure', 'rate-figure');
  const image = el('img');
  image.alt = '';
  const caption = el('figcaption');
  figure.append(image, caption);
  const form = el('form', 'rate-form');
  form.addEventListener('submit', (event) => event.preventDefault());
  const groups = new Map<Principle, HTMLInputElement[]>();
  for (const p of PRINCIPLES) {
    const fieldset = el('fieldset', 'rate-question');
    fieldset.append(el('legend', undefined, p.name));
    const inputs: HTMLInputElement[] = [];
    const options = el('div', 'rate-options');
    for (const [value, text] of LABELS) {
      const label = el('label', 'rate-option');
      const input = el('input');
      input.type = 'radio';
      input.name = p.id;
      input.value = value;
      input.addEventListener('change', () => answer(p.id, value));
      label.append(input, el('span', undefined, text));
      options.append(label);
      inputs.push(input);
    }
    fieldset.append(options);
    form.append(fieldset);
    groups.set(p.id, inputs);
  }
  const noteLabel = el('label', 'rate-note');
  noteLabel.append(el('span', undefined, 'Note (optional)'));
  const note = el('textarea');
  note.rows = 2;
  note.addEventListener('input', () => {
    const id = current().id;
    state.answers[id] = { ...state.answers[id], note: note.value };
    save(state);
  });
  noteLabel.append(note);
  form.append(noteLabel);

  const nav = el('div', 'rate-nav');
  const previous = el('button', 'button', 'Previous');
  const next = el('button', 'button', 'Next');
  const nextOpen = el('button', 'button button-primary', 'Next unrated');
  for (const b of [previous, next, nextOpen]) b.type = 'button';
  nav.append(previous, next, nextOpen);
  card.append(status, figure, form, nav);

  const finish = el('section', 'rate-finish');
  const download = el('button', 'button button-primary', 'Download ratings (CSV)');
  download.type = 'button';
  const finishNote = el('p', 'rate-finish-note');
  const clear = el('button', 'link-button', 'Clear my ratings in this browser');
  clear.type = 'button';
  finish.append(download, finishNote, clear);

  root.replaceChildren(intro, who, card, finish);

  let order = shuffled(photos, state.initials);
  const current = () => order[Math.min(Math.max(state.position, 0), order.length - 1)];

  function answer(principle: Principle, value: Label) {
    const id = current().id;
    state.answers[id] = { ...state.answers[id], [principle]: value };
    save(state);
    render();
  }

  function render() {
    const photo = current();
    const done = photos.filter((p) => complete(state.answers[p.id])).length;
    status.textContent = `Photo ${state.position + 1} of ${order.length} · ${done} of ${order.length} rated`;
    image.src = `${import.meta.env.BASE_URL}examples/${photo.file}`;
    image.width = photo.width;
    image.height = photo.height;
    const kind = photo.imageKind;
    caption.replaceChildren(
      el('span', 'rate-place', [photo.city, kind ? KIND[kind] : ''].filter(Boolean).join(' · ')),
      document.createTextNode(`. Photo: ${photo.author}, `),
      Object.assign(el('a', undefined, photo.licence), { href: photo.licenceUrl, rel: 'noopener', target: '_blank' }),
      document.createTextNode('.'),
    );
    const saved = state.answers[photo.id] ?? {};
    for (const [principle, inputs] of groups) for (const input of inputs) input.checked = saved[principle] === input.value;
    note.value = saved.note ?? '';
    previous.disabled = state.position === 0;
    next.disabled = state.position === order.length - 1;
    nextOpen.disabled = done === order.length;
    const ready = initials.value.trim().length > 0;
    download.disabled = !ready || done === 0;
    finishNote.textContent = !ready
      ? 'Enter your initials to download.'
      : done === order.length
        ? 'All photos rated. Download the file and send it to the person who asked you to rate.'
        : `You can download at any time; ${order.length - done} photos are not fully rated yet.`;
  }

  function go(position: number) {
    state.position = Math.min(Math.max(position, 0), order.length - 1);
    save(state);
    render();
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  previous.addEventListener('click', () => go(state.position - 1));
  next.addEventListener('click', () => go(state.position + 1));
  nextOpen.addEventListener('click', () => {
    for (let step = 1; step <= order.length; step++) {
      const k = (state.position + step) % order.length;
      if (!complete(state.answers[order[k].id])) return go(k);
    }
  });
  initials.addEventListener('change', () => {
    const id = current().id;
    state.initials = initials.value.trim();
    order = shuffled(photos, state.initials);
    state.position = Math.max(0, order.findIndex((p) => p.id === id));
    save(state);
    render();
  });
  initials.addEventListener('input', render);
  download.addEventListener('click', () => {
    state.initials = initials.value.trim();
    save(state);
    const blob = new Blob([toCsv(photos, state)], { type: 'text/csv' });
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `eek-a-look-ratings-${state.initials.replace(/[^\w-]/g, '') || 'rater'}.csv`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  });
  clear.addEventListener('click', () => {
    if (!confirm('Clear all your ratings in this browser? Download them first if you want to keep them.')) return;
    state.answers = {};
    state.position = 0;
    save(state);
    render();
  });
  render();
}

const root = document.querySelector<HTMLElement>('#rate')!;
mount(root).catch((error: unknown) => {
  root.replaceChildren(el('p', 'rate-error', `The photos could not be loaded: ${error instanceof Error ? error.message : String(error)}`));
});
