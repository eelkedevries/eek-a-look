export const MAX_SIDE = 1600;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ImageInputError extends Error {}

/** Returns the bitmap itself if it already fits, otherwise a downscaled copy. */
export async function fitWithin(bitmap: ImageBitmap, maxSide = MAX_SIDE): Promise<ImageBitmap> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return bitmap;

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return createImageBitmap(canvas);
}

/** Decodes a user's file locally; nothing is sent over the network. */
export async function decodeUpload(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new ImageInputError('That file is not an image. Please choose a JPEG or PNG photo.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageInputError('That photo is larger than 25 MB. Please choose a smaller one.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageInputError('This browser cannot open that photo. Please try a JPEG or PNG.');
  }
  return fitWithin(bitmap);
}
