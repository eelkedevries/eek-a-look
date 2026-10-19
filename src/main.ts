import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';

import { loadComparisons, loadExamples, mountLibraryFilter, renderCredit, renderPicker, showExample, type ExamplePhoto } from './examples';
import { decodeUpload, ImageInputError } from './image-input';
import { modelsFor, onResults } from './results';
import { onImageChange, setImage } from './state';
import { showOnStage } from './stage';
import { setViewState } from './view-state';
import { renderAbout } from './views/about';
import { mountAgreement } from './views/agreement';
import { mountAreas } from './views/areas';
import { contrastWith, mountContrast } from './views/contrast';
import { mountDisplaySettings } from './views/display-settings';
import { mountExample } from './views/example';
import './views/example.css';
import { mountInspector } from './views/inspector';
import { mountPanel } from './views/panel';
import { mountQualities } from './views/qualities';
import { mountUpClip } from './views/upclip';
import './views/qualities.css';
import { mountMethods } from './views/methods';
import { mountOverlay } from './views/overlay';
import { mountSideBySide } from './views/side-by-side';
import { mountTabs } from './views/tabs';

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const stage = $('#stage');
const credit = $('#credit');
const examples = $('#examples');
const uploadButton = document.querySelector<HTMLButtonElement>('#upload-button')!;
const uploadInput = document.querySelector<HTMLInputElement>('#upload-input')!;
const uploadMessage = $('#upload-message');
const photoTitle = $('#photo-title');
const photoPlace = $('#photo-place');
const statusLine = $('#status-line');

const panel = (id: string) => $(`#panel-${id}`);
const showTab = mountTabs(
  $('#view-tabs'),
  [
    { id: 'overlay', label: 'Single map', panel: panel('overlay') },
    { id: 'side', label: 'Side by side', panel: panel('side') },
    { id: 'contrast', label: 'Contrast', panel: panel('contrast') },
    { id: 'areas', label: 'Areas', panel: panel('areas') },
    { id: 'qualities', label: 'Qualities', panel: panel('qualities') },
  ],
  (view) => setViewState({ view }),
);
const contrastControls = mountInspector($('#inspector'), showTab);
mountOverlay(stage, $('#model-status'));
mountSideBySide(panel('side'), (a, b) => {
  contrastWith(a, b);
  showTab('contrast');
});
mountContrast(panel('contrast'), contrastControls);
mountDisplaySettings($('#view-settings') as HTMLDetailsElement);
mountAreas(panel('areas'));
mountAgreement($('#views'));
mountMethods($('#methods'));

const photosById = new Map<string, ExamplePhoto>();
let markSelected: (id: string | undefined) => void = () => {};

// The Qualities view (prompt 047) selects photos from its tables; the simulated panel lives there.
const pickById = (id: string) => {
  const photo = photosById.get(id);
  if (photo) void pick(photo);
};
mountUpClip(mountQualities(panel('qualities'), pickById, () => photosById), pickById, () => photosById);
mountPanel($('#qualities-panel'));

onImageChange((image) => {
  showOnStage(stage, image);
  markSelected(image.exampleId);
  const photo = image.exampleId ? photosById.get(image.exampleId) : undefined;
  if (photo) {
    renderCredit(credit, photo);
    photoTitle.textContent = photo.title;
    photoPlace.textContent = photo.measured
      ? `${photo.city} · measured eye tracking`
      : photo.study
        ? `${photo.city} · published study, predictions only`
        : photo.editOf
          ? `${photo.city} · edited for the Example section, predictions only`
          : `${photo.area} · ${photo.city}`;
  } else {
    credit.textContent = 'Your photo (stays on this device)';
    photoTitle.textContent = 'Your photo';
    photoPlace.textContent = 'Upload · stays on this device';
  }
});

onResults((results) => {
  const layers = modelsFor(results);
  const ready = layers.filter((m) => results.status.get(m.id)?.state === 'ready').length;
  const covered = layers.filter((m) => results.status.get(m.id)?.state !== 'unavailable').length;
  statusLine.textContent = `${ready} of ${covered} layers ready · ${results.image.width} × ${results.image.height} px`;
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

const about = $('#about');

/** The Example section (prompt 058); its edited images open in the workspace but stay out of the library. */
function mountComparisons(): void {
  loadComparisons()
    .then((manifest) => {
      for (const photo of manifest.images) photosById.set(photo.id, photo);
      mountExample($('#example'), manifest, (id) => photosById.get(id), (id) => {
        pickById(id);
        $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    })
    .catch(() => {
      $('#example').textContent = 'The examples could not be loaded.';
    });
}

loadExamples()
  .then((photos) => {
    for (const photo of photos) photosById.set(photo.id, photo);
    markSelected = renderPicker(examples, photos, pick);
    mountLibraryFilter(examples, photos, document.querySelector<HTMLInputElement>('#photo-search')!, $('#photo-filters'), $('#library-count'));
    renderAbout(about, photos);
    mountComparisons();
    if (photos.length) return pick(photos[0]);
  })
  .catch(() => {
    examples.textContent = 'The example photos could not be loaded. You can still use your own photo.';
    renderAbout(about, []);
  });
