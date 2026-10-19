import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';

import { loadExamples, renderCredit, renderPicker, showExample, type ExamplePhoto } from './examples';
import { decodeUpload, ImageInputError } from './image-input';
import { onImageChange, setImage } from './state';
import { showOnStage } from './stage';
import { renderAbout } from './views/about';
import { mountAgreement } from './views/agreement';
import { mountAreas } from './views/areas';
import { contrastWith, mountContrast } from './views/contrast';
import { mountPanel } from './views/panel';
import { mountMethods } from './views/methods';
import { mountOverlay } from './views/overlay';
import { mountSideBySide } from './views/side-by-side';
import { mountTabs } from './views/tabs';

const stage = document.querySelector<HTMLElement>('#stage')!;
const credit = document.querySelector<HTMLElement>('#credit')!;
const examples = document.querySelector<HTMLElement>('#examples')!;
const uploadButton = document.querySelector<HTMLButtonElement>('#upload-button')!;
const uploadInput = document.querySelector<HTMLInputElement>('#upload-input')!;
const uploadMessage = document.querySelector<HTMLElement>('#upload-message')!;

const panel = (id: string) => document.querySelector<HTMLElement>(`#panel-${id}`)!;
mountOverlay(document.querySelector<HTMLElement>('#overlay-controls')!, stage);
mountSideBySide(panel('side'), (a, b) => {
  contrastWith(a, b);
  showTab('contrast');
});
mountContrast(panel('contrast'));
mountAreas(panel('areas'));
mountPanel(document.querySelector<HTMLElement>('#areas-panel')!);
const showTab = mountTabs(document.querySelector<HTMLElement>('#view-tabs')!, [
  { id: 'overlay', label: 'Overlay', panel: panel('overlay') },
  { id: 'side', label: 'Side by side', panel: panel('side') },
  { id: 'contrast', label: 'Contrast', panel: panel('contrast') },
  { id: 'areas', label: 'Areas', panel: panel('areas') },
]);
mountAgreement(document.querySelector<HTMLElement>('#views')!);
mountMethods(document.querySelector<HTMLElement>('#methods')!);

const photosById = new Map<string, ExamplePhoto>();
let markSelected: (id: string | undefined) => void = () => {};

onImageChange((image) => {
  showOnStage(stage, image);
  markSelected(image.exampleId);
  const photo = image.exampleId ? photosById.get(image.exampleId) : undefined;
  if (photo) renderCredit(credit, photo);
  else credit.textContent = 'Your photo (stays on this device)';
});

async function pick(photo: ExamplePhoto): Promise<void> {
  uploadMessage.textContent = '';
  try {
    await showExample(photo);
  } catch {
    uploadMessage.textContent = 'That example photo could not be loaded.';
  }
}

uploadButton.addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', async () => {
  const file = uploadInput.files?.[0];
  uploadInput.value = '';
  if (!file) return;

  uploadMessage.textContent = 'Opening your photo…';
  try {
    const bitmap = await decodeUpload(file);
    setImage({ bitmap, width: bitmap.width, height: bitmap.height, source: 'upload' });
    uploadMessage.textContent = '';
  } catch (error) {
    uploadMessage.textContent =
      error instanceof ImageInputError ? error.message : 'Something went wrong opening that photo.';
  }
});

if (import.meta.env.DEV && new URLSearchParams(location.search).get('check') === 'unisal') {
  import('./dev/unisal-reference').then((m) => m.checkUnisalReference());
}

const about = document.querySelector<HTMLElement>('#about')!;

loadExamples()
  .then((photos) => {
    for (const photo of photos) photosById.set(photo.id, photo);
    markSelected = renderPicker(examples, photos, pick);
    renderAbout(about, photos);
    if (photos.length) return pick(photos[0]);
  })
  .catch(() => {
    examples.textContent = 'The example photos could not be loaded. You can still use your own photo.';
    renderAbout(about, []);
  });
