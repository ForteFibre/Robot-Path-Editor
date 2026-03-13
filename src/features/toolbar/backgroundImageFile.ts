import type { BackgroundImage } from '../../domain/models';
import { AppErrorInstance } from '../../errors/appError';

export const MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_BACKGROUND_IMAGE_WIDTH_PX = 8_192;
export const MAX_BACKGROUND_IMAGE_HEIGHT_PX = 8_192;
export const MAX_BACKGROUND_IMAGE_TOTAL_PIXELS = 16_777_216;

const DEFAULT_BACKGROUND_IMAGE_POSITION = {
  x: 0,
  y: 0,
  scale: 1,
  alpha: 1,
} as const;

const createBackgroundImageError = (
  reason:
    | 'file-too-large'
    | 'image-too-large'
    | 'dimensions-too-large'
    | 'unsupported-type'
    | 'svg-disallowed'
    | 'read-failed'
    | 'invalid-dimensions'
    | 'invalid-format',
): AppErrorInstance => {
  return new AppErrorInstance({
    kind: 'background-image',
    reason,
  });
};

const validateBackgroundImageFile = (file: File): void => {
  const normalizedType = file.type.toLowerCase();

  if (file.size > MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES) {
    throw createBackgroundImageError('file-too-large');
  }

  if (normalizedType === 'image/svg+xml') {
    throw createBackgroundImageError('svg-disallowed');
  }

  if (normalizedType !== '' && !normalizedType.startsWith('image/')) {
    throw createBackgroundImageError('unsupported-type');
  }
};

const validateLoadedImageDimensions = (
  image: HTMLImageElement,
): { width: number; height: number } => {
  const { naturalWidth, naturalHeight } = image;

  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    throw createBackgroundImageError('invalid-dimensions');
  }

  if (
    naturalWidth > MAX_BACKGROUND_IMAGE_WIDTH_PX ||
    naturalHeight > MAX_BACKGROUND_IMAGE_HEIGHT_PX
  ) {
    throw createBackgroundImageError('dimensions-too-large');
  }

  const totalPixels = naturalWidth * naturalHeight;
  if (
    !Number.isFinite(totalPixels) ||
    totalPixels > MAX_BACKGROUND_IMAGE_TOTAL_PIXELS
  ) {
    throw createBackgroundImageError('image-too-large');
  }

  return {
    width: naturalWidth,
    height: naturalHeight,
  };
};

const readFileAsDataUrl = async (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(createBackgroundImageError('read-failed'));
    };

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(createBackgroundImageError('read-failed'));
        return;
      }

      resolve(result);
    };

    reader.readAsDataURL(file);
  });
};

const loadImageDimensions = async (
  dataUrl: string,
): Promise<{ width: number; height: number }> => {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new globalThis.Image();

    image.onerror = () => {
      reject(createBackgroundImageError('invalid-format'));
    };

    image.onload = () => {
      try {
        resolve(validateLoadedImageDimensions(image));
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : createBackgroundImageError('invalid-format'),
        );
      }
    };

    image.src = dataUrl;
  });
};

export const loadBackgroundImageFile = async (
  file: File,
): Promise<BackgroundImage> => {
  validateBackgroundImageFile(file);

  const dataUrl = await readFileAsDataUrl(file);
  const dimensions = await loadImageDimensions(dataUrl);

  return {
    url: dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    ...DEFAULT_BACKGROUND_IMAGE_POSITION,
  };
};
