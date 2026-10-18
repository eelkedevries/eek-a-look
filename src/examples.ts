import { setImage } from './state';

export interface ExamplePhoto {
  id: string;
  area: 'Zuidas' | 'Weena' | 'Wilhelminapier' | 'Beatrixkwartier';
  city: 'Amsterdam' | 'Rotterdam' | 'The Hague';
  title: string;
  file: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  changes: string;
}

const EXAMPLES_URL = `${import.meta.env.BASE_URL}examples/`;

export async function loadExamples(): Promise<ExamplePhoto[]> {
  const response = await fetch(`${EXAMPLES_URL}examples.json`);
  if (!response.ok) throw new Error(`Could not load the example photos (HTTP ${response.status}).`);
  return response.json();
}

const thumbUrl = (photo: ExamplePhoto) => EXAMPLES_URL + photo.file.replace(/\.jpg$/, '-thumb.jpg');

export async function showExample(photo: ExamplePhoto): Promise<void> {
  const response = await fetch(EXAMPLES_URL + photo.file);
  const bitmap = await createImageBitmap(await response.blob());
  setImage({ bitmap, width: bitmap.width, height: bitmap.height, source: 'example', exampleId: photo.id });
}

/** Renders the thumbnails grouped by area; the current photo is marked with aria-pressed. */
export function renderPicker(
  container: HTMLElement,
  photos: ExamplePhoto[],
  onPick: (photo: ExamplePhoto) => void,
): (id: string | undefined) => void {
  const buttons = new Map<string, HTMLButtonElement>();
  const areas = [...new Set(photos.map((p) => p.area))];

  container.replaceChildren(
    ...areas.map((area) => {
      const group = document.createElement('div');
      group.className = 'example-group';
      const inArea = photos.filter((p) => p.area === area);

      const heading = document.createElement('h3');
      heading.className = 'example-area';
      const city = document.createElement('span');
      city.textContent = inArea[0].city;
      heading.append(`${area} `, city);

      const list = document.createElement('div');
      list.className = 'example-list';
      for (const photo of inArea) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'example';
        button.setAttribute('aria-pressed', 'false');
        const img = document.createElement('img');
        img.src = thumbUrl(photo);
        img.alt = `${photo.title}, ${photo.city}`;
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

  return (id) => {
    for (const [photoId, button] of buttons) button.setAttribute('aria-pressed', String(photoId === id));
  };
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
    `${photo.title}, ${photo.city}. Photo: `,
    link(photo.sourceUrl, photo.author),
    ', ',
    link(photo.licenceUrl, photo.licence),
    `, via Wikimedia Commons. ${photo.changes}.`,
  );
}
