import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAppError } from '../../errors';
import {
  loadBackgroundImageFile,
  MAX_BACKGROUND_IMAGE_HEIGHT_PX,
  MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES,
  MAX_BACKGROUND_IMAGE_TOTAL_PIXELS,
  MAX_BACKGROUND_IMAGE_WIDTH_PX,
} from '../../features/toolbar/backgroundImageFile';

const stubFileReader = (options?: {
  result?: string;
  fail?: boolean;
}): void => {
  const { result = 'data:image/png;base64,dGVzdA==', fail = false } =
    options ?? {};

  class MockFileReader {
    public onerror: (() => void) | null = null;
    public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    public readAsDataURL(_file: Blob): void {
      if (fail) {
        this.onerror?.();
        return;
      }

      this.onload?.({
        target: {
          result,
        },
      } as ProgressEvent<FileReader>);
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);
};

const stubImage = (options?: {
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  fail?: boolean;
}): void => {
  const {
    width = 640,
    height = 360,
    naturalWidth = width,
    naturalHeight = height,
    fail = false,
  } = options ?? {};

  class MockImage {
    public onerror: (() => void) | null = null;
    public onload: (() => void) | null = null;
    public naturalWidth = naturalWidth;
    public naturalHeight = naturalHeight;
    public width = width;
    public height = height;

    set src(_value: string) {
      if (fail) {
        this.onerror?.();
        return;
      }

      this.onload?.();
    }
  }

  vi.stubGlobal('Image', MockImage);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadBackgroundImageFile', () => {
  it('loads a valid image file into background image state', async () => {
    stubFileReader();
    stubImage({ width: 320, height: 180 });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).resolves.toEqual({
      url: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1,
    });
  });

  it('rejects files larger than the configured limit', async () => {
    await expect(
      loadBackgroundImageFile(
        new File(
          [new Uint8Array(MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES + 1)],
          'field.png',
          { type: 'image/png' },
        ),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'file-too-large'
      );
    });
  });

  it('rejects files with a non-image MIME type', async () => {
    await expect(
      loadBackgroundImageFile(
        new File(['hello'], 'notes.txt', { type: 'text/plain' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'unsupported-type'
      );
    });
  });

  it('rejects SVG files explicitly', async () => {
    await expect(
      loadBackgroundImageFile(
        new File(['<svg></svg>'], 'field.svg', { type: 'image/svg+xml' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'svg-disallowed'
      );
    });
  });

  it('rejects when FileReader reports a read error', async () => {
    stubFileReader({ fail: true });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'read-failed'
      );
    });
  });

  it('rejects when the data cannot be decoded as an image', async () => {
    stubFileReader();
    stubImage({ fail: true });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'invalid-format'
      );
    });
  });

  it('rejects images with invalid natural dimensions', async () => {
    stubFileReader();
    stubImage({ width: 320, height: 180, naturalWidth: 0, naturalHeight: 0 });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'invalid-dimensions'
      );
    });
  });

  it('rejects images whose width exceeds the configured limit', async () => {
    stubFileReader();
    stubImage({ width: MAX_BACKGROUND_IMAGE_WIDTH_PX + 1, height: 180 });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'dimensions-too-large'
      );
    });
  });

  it('rejects images whose height exceeds the configured limit', async () => {
    stubFileReader();
    stubImage({ width: 320, height: MAX_BACKGROUND_IMAGE_HEIGHT_PX + 1 });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'dimensions-too-large'
      );
    });
  });

  it('rejects images whose total pixel count exceeds the configured limit', async () => {
    stubFileReader();
    stubImage({
      width: 4_097,
      height: Math.floor(MAX_BACKGROUND_IMAGE_TOTAL_PIXELS / 4_097) + 1,
    });

    await expect(
      loadBackgroundImageFile(
        new File(['fake-image'], 'field.png', { type: 'image/png' }),
      ),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        isAppError(error) &&
        error.appError.kind === 'background-image' &&
        error.appError.reason === 'image-too-large'
      );
    });
  });
});
