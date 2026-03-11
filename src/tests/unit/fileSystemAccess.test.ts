import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isDirectoryExportSupported,
  isDirectoryPickerAbortError,
  writeFilesToDirectory,
} from '../../io/fileSystemAccess';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

const setDirectoryPicker = (
  picker: DirectoryPickerWindow['showDirectoryPicker'],
): void => {
  Object.defineProperty(globalThis.window, 'showDirectoryPicker', {
    value: picker,
    configurable: true,
    writable: true,
  });
};

const setSecureContext = (value: boolean): void => {
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value,
    configurable: true,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis.window as DirectoryPickerWindow).showDirectoryPicker;
  setSecureContext(true);
});

describe('file system access', () => {
  it('returns true only when secure directory export is supported', () => {
    setSecureContext(true);
    setDirectoryPicker(vi.fn(() => Promise.reject(new Error('not used'))));
    expect(isDirectoryExportSupported()).toBe(true);

    delete (globalThis.window as DirectoryPickerWindow).showDirectoryPicker;
    expect(isDirectoryExportSupported()).toBe(false);

    setDirectoryPicker(vi.fn(() => Promise.reject(new Error('not used'))));
    setSecureContext(false);
    expect(isDirectoryExportSupported()).toBe(false);
  });

  it('writes each file to the selected directory', async () => {
    setSecureContext(true);
    const write = vi.fn((_blob: Blob) => Promise.resolve(undefined));
    const close = vi.fn(() => Promise.resolve(undefined));
    const createWritable = vi.fn(() =>
      Promise.resolve({
        write,
        close,
      } as unknown as FileSystemWritableFileStream),
    );
    const getFileHandle = vi.fn(() =>
      Promise.resolve({
        createWritable,
      } as unknown as FileSystemFileHandle),
    );
    const directoryHandle = {
      name: 'exports',
      getFileHandle,
    } as unknown as FileSystemDirectoryHandle;
    const showDirectoryPicker = vi.fn(() => Promise.resolve(directoryHandle));
    setDirectoryPicker(showDirectoryPicker);

    const result = await writeFilesToDirectory([
      {
        filename: 'path-1.csv',
        content: 'x,y,theta\n0,0,0\n',
        mimeType: 'text/csv;charset=utf-8',
      },
      {
        filename: 'path-2.csv',
        content: 'x,y,theta\n1,0,0\n',
        mimeType: 'text/csv;charset=utf-8',
      },
    ]);

    expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(getFileHandle).toHaveBeenNthCalledWith(1, 'path-1.csv', {
      create: true,
    });
    expect(getFileHandle).toHaveBeenNthCalledWith(2, 'path-2.csv', {
      create: true,
    });
    expect(createWritable).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(2);
    const firstWrittenBlob = write.mock.calls[0]?.[0];
    const secondWrittenBlob = write.mock.calls[1]?.[0];

    expect(firstWrittenBlob).toBeInstanceOf(Blob);
    expect(secondWrittenBlob).toBeInstanceOf(Blob);

    if (
      !(firstWrittenBlob instanceof Blob) ||
      !(secondWrittenBlob instanceof Blob)
    ) {
      throw new TypeError('expected written blobs');
    }

    expect(await firstWrittenBlob.text()).toBe('x,y,theta\n0,0,0\n');
    expect(await secondWrittenBlob.text()).toBe('x,y,theta\n1,0,0\n');
    expect(result).toEqual({
      writtenCount: 2,
      filenames: ['path-1.csv', 'path-2.csv'],
      directoryName: 'exports',
    });
  });

  it('recognizes AbortError so callers can ignore cancelled directory picks', () => {
    expect(
      isDirectoryPickerAbortError(
        new DOMException('The user aborted a request.', 'AbortError'),
      ),
    ).toBe(true);
    expect(isDirectoryPickerAbortError(new Error('boom'))).toBe(false);
  });
});
