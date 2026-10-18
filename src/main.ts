import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';

import { decodeUpload, ImageInputError } from './image-input';
import { onImageChange, setImage } from './state';
import { showOnStage } from './stage';

const stage = document.querySelector<HTMLElement>('#stage')!;
const credit = document.querySelector<HTMLElement>('#credit')!;
const uploadButton = document.querySelector<HTMLButtonElement>('#upload-button')!;
const uploadInput = document.querySelector<HTMLInputElement>('#upload-input')!;
const uploadMessage = document.querySelector<HTMLElement>('#upload-message')!;

onImageChange((image) => {
  showOnStage(stage, image);
  if (image.source === 'upload') credit.textContent = 'Your photo (stays on this device)';
});

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
