import { setImage } from './state';

export interface ExamplePhoto {
  id: string;
  area: 'Zuidas' | 'Weena' | 'Wilhelminapier' | 'Beatrixkwartier' | 'Zürich' | 'Andersson et al. (2017)' | 'From published studies';
  /** Absent only for photos of Andersson et al. (2017) whose place is not certain (prompt 069). */
  city?: 'Amsterdam' | 'Rotterdam' | 'The Hague' | 'Zürich' | 'Rome' | 'Qinyang';
  title: string;
  file: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  changes: string;
  /** Only for photos with measured eye tracking. */
  measured?: { observers: number; fixations: number; viewingSeconds: number; citation: string };
  /** Only for images from a published eye-tracking study, whose heat map is linked, never used as measured gaze. */
  study?: { citation: string; heatmapFigure: string; heatmapUrl: string; viewing: string };
  /** Study images only (prompt 051): a design rendering or a 360° panorama. */
  imageKind?: 'render' | 'panorama';
  /** Edited images of the Example section only (prompt 058): the photo it was edited from, and what was changed. */
  editOf?: string;
  condition?: string;
}

/** The Example section's edited images and its three comparisons, each of image `a` against image `b`. */
export interface ComparisonManifest {
  images: ExamplePhoto[];
  examples: { id: string; a: string; b: string; reference?: string }[];
}

const EXAMPLES_URL = `${import.meta.env.BASE_URL}examples/`;

/** Content hash of examples.json, set by vite.config.ts, so a stale cached copy is never used. */
declare const __EXAMPLES_VERSION__: string;
/** Content hash of comparisons.json and public/precomputed/comparisons/, set by vite.config.ts. */
declare const __COMPARISONS_VERSION__: string;

export async function loadExamples(): Promise<ExamplePhoto[]> {
  const response = await fetch(`${EXAMPLES_URL}examples.json?v=${__EXAMPLES_VERSION__}`);
  if (!response.ok) throw new Error(`Could not load the example photos (HTTP ${response.status}).`);
  return response.json();
}

export async function loadComparisons(): Promise<ComparisonManifest> {
  const response = await fetch(`${EXAMPLES_URL}comparisons.json?v=${__COMPARISONS_VERSION__}`);
  if (!response.ok) throw new Error(`Could not load the comparisons (HTTP ${response.status}).`);
  return response.json();
}

/** The small text after an area heading: the city, or what the group is when the area is not a place. Matches vite.config.ts. */
const areaNote = (photo: ExamplePhoto) => (photo.measured ? 'measured eye tracking' : photo.study ? 'predictions only' : (photo.city ?? ''));

/** "Title, City", or the title alone where the place is not known. */
export const titleAndPlace = (photo: { title: string; city?: string }) => (photo.city ? `${photo.title}, ${photo.city}` : photo.title);

const thumbUrl = (photo: ExamplePhoto) => EXAMPLES_URL + photo.file.replace(/\.jpg$/, '-thumb.jpg');

export async function showExample(photo: ExamplePhoto): Promise<void> {
  const response = await fetch(EXAMPLES_URL + photo.file);
  const bitmap = await createImageBitmap(await response.blob());
  setImage({
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    source: 'example',
    exampleId: photo.id,
    measured: photo.measured !== undefined,
    measuredCounts: photo.measured && { observers: photo.measured.observers, fixations: photo.measured.fixations },
    study: photo.study !== undefined,
  });
}

/** Renders (or attaches to) the thumbnails grouped by area; the current photo is marked with aria-pressed. */
export function renderPicker(
  container: HTMLElement,
  photos: ExamplePhoto[],
  onPick: (photo: ExamplePhoto) => void,
): (id: string | undefined) => void {
  const buttons = new Map<string, HTMLButtonElement>();
  const mark = (id: string | undefined) => {
    for (const [photoId, button] of buttons) button.setAttribute('aria-pressed', String(photoId === id));
  };

  // The build pre-renders the picker (see vite.config.ts); attach to it if it matches the manifest.
  const prerendered = [...container.querySelectorAll<HTMLButtonElement>('button.example[data-id]')];
  if (prerendered.length === photos.length && photos.every((p, i) => prerendered[i].dataset.id === p.id)) {
    photos.forEach((photo, i) => {
      buttons.set(photo.id, prerendered[i]);
      prerendered[i].addEventListener('click', () => onPick(photo));
    });
    return mark;
  }

  const areas = [...new Set(photos.map((p) => p.area))];
  container.replaceChildren(
    ...areas.map((area) => {
      const group = document.createElement('div');
      group.className = 'example-group';
      const inArea = photos.filter((p) => p.area === area);

      const heading = document.createElement('h3');
      heading.className = 'example-area';
      const city = document.createElement('span');
      city.textContent = areaNote(inArea[0]);
      heading.append(`${area} `, city);

      const list = document.createElement('div');
      list.className = 'example-list';
      for (const photo of inArea) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'example';
        button.dataset.id = photo.id;
        if (photo.measured) button.dataset.measured = '';
        button.title = photo.title;
        button.setAttribute('aria-pressed', 'false');
        const img = document.createElement('img');
        img.src = thumbUrl(photo);
        img.alt = titleAndPlace(photo);
        img.loading = 'lazy';
        img.width = 320;
        img.height = Math.round((320 * photo.height) / photo.width);
        button.append(img);
        button.addEventListener('click', () => onPick(photo));
        buttons.set(photo.id, button);
        list.append(button);
      }
      group.append(heading, list);
      return group;
    }),
  );

  return mark;
}

type Filter = 'all' | 'measured' | 'dutch' | 'study';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['measured', 'Measured gaze'],
  ['dutch', 'Dutch high-rise'],
  ['study', 'Published studies'],
];
const kind = (photo: ExamplePhoto): Filter => (photo.measured ? 'measured' : photo.study ? 'study' : 'dutch');

/** Search and filter buttons for the library: hides thumbnails (and empty groups) that do not match. */
export function mountLibraryFilter(container: HTMLElement, photos: ExamplePhoto[], search: HTMLInputElement, filterGroup: HTMLElement, count: HTMLElement): void {
  let filter: Filter = 'all';
  const byId = new Map(photos.map((p) => [p.id, p]));
  const haystack = (p: ExamplePhoto) => `${p.title} ${p.area} ${p.city ?? ''}`.toLocaleLowerCase('en-GB');

  const buttons = FILTERS.map(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter';
    button.textContent = label;
    button.addEventListener('click', () => {
      filter = id;
      apply();
    });
    return button;
  });
  filterGroup.replaceChildren(...buttons);

  function apply() {
    FILTERS.forEach(([id], i) => buttons[i].setAttribute('aria-pressed', String(id === filter)));
    const query = search.value.trim().toLocaleLowerCase('en-GB');
    let shown = 0;
    for (const group of container.querySelectorAll<HTMLElement>('.example-group')) {
      let any = false;
      for (const button of group.querySelectorAll<HTMLButtonElement>('button.example')) {
        const photo = byId.get(button.dataset.id ?? '');
        const match =
          !!photo &&
          (filter === 'all' || kind(photo) === filter) &&
          (!query || haystack(photo).includes(query));
        button.hidden = !match;
        if (match) shown++;
        any ||= match;
      }
      group.hidden = !any;
    }
    count.textContent = shown === photos.length ? `${photos.length} photos` : `${shown} of ${photos.length}`;
  }

  search.addEventListener('input', apply);
  apply();
}

/** Fills the credit line with linked author, licence and source. */
export function renderCredit(element: HTMLElement, photo: ExamplePhoto): void {
  const link = (href: string, text: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.rel = 'noopener';
    return a;
  };
  element.replaceChildren(
    `${titleAndPlace(photo)}. ${photo.study ? 'Image' : 'Photo'}: `,
    link(photo.sourceUrl, photo.author),
    ', ',
    link(photo.licenceUrl, photo.licence),
    photo.sourceUrl.startsWith('https://commons.wikimedia.org/') ? ', via Wikimedia Commons. ' : '. ',
    `${photo.changes}.`,
  );
  if (photo.study) {
    element.append(
      ' The study’s own heat map of measured gaze (',
      `${photo.study.viewing}) is `,
      link(photo.study.heatmapUrl, `${photo.study.heatmapFigure} of ${photo.study.citation}`),
      '; it is linked, not used as a layer. Every map here is a prediction.',
    );
  }
}
