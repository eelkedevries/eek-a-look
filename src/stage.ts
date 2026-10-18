import type { CurrentImage } from './state';

/** Draws the current photo on the stage and returns its frame, onto which layers can be stacked. */
export function showOnStage(stage: HTMLElement, image: CurrentImage): HTMLElement {
  let frame = stage.querySelector<HTMLElement>('.frame');
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'frame';
    const photo = document.createElement('canvas');
    photo.className = 'photo';
    photo.setAttribute('role', 'img');
    frame.append(photo);
    stage.replaceChildren(frame);
    // The pre-rendered placeholder size is no longer needed once a photo sets the height.
    stage.style.removeProperty('aspect-ratio');
  }
  const photo = frame.querySelector<HTMLCanvasElement>('canvas.photo')!;
  photo.width = image.width;
  photo.height = image.height;
  photo.setAttribute('aria-label', image.source === 'upload' ? 'Your photo' : 'Example street photo');
  photo.getContext('2d')!.drawImage(image.bitmap, 0, 0);
  return frame;
}
