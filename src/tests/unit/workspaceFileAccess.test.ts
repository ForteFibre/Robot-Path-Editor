import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isFilePickerAbortError,
  isFileSystemAccessSupported,
  openWorkspaceFile,
  overwriteWorkspaceFile,
  saveWorkspaceFileAs,
} from '../../io/workspaceFileAccess';

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    types?: {
      accept: Record<string, string[]>;
      description?: string;
    }[];
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
    types?: {
      accept: Record<string, string[]>;
      description?: string;
    }[];
  }) => Promise<FileSystemFileHandle>;
};

const createFileHandleMock = (options?: {
  fileName?: string;
  fileText?: string;
  lastModified?: number;
  queryPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
}) => {
  const {
    fileName = 'workspace.json',
    fileText = '{"workspace":true}',
    lastModified = 1_762_000_000_000,
    queryPermission,
    requestPermission,
  } = options ?? {};
  let currentText = fileText;
  let currentLastModified = lastModified;
  const write = vi.fn(async (blob: Blob) => {
    currentText = await blob.text();
    currentLastModified += 1;
  });
  const close = vi.fn(() => Promise.resolve(undefined));
  const createWritable = vi.fn(() =>
    Promise.resolve({
      write,
      close,
    } as unknown as FileSystemWritableFileStream),
  );
  const getFile = vi.fn(() =>
    Promise.resolve(
      new File([currentText], fileName, {
        type: 'application/json',
        lastModified: currentLastModified,
      }),
    ),
  );

  return {
    close,
    createWritable,
    getFile,
    handle: {
      createWritable,
      getFile,
      kind: 'file',
      name: fileName,
      queryPermission,
      requestPermission,
    } as unknown as FileSystemFileHandle,
    write,
  };
};

const setSecureContext = (value: boolean): void => {
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value,
    configurable: true,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis.window as FilePickerWindow).showOpenFilePicker;
  delete (globalThis.window as FilePickerWindow).showSaveFilePicker;
  setSecureContext(true);
});

describe('workspaceFileAccess', () => {
  it('reports support only when secure open and save pickers exist', () => {
    Object.defineProperty(globalThis.window, 'showOpenFilePicker', {
      value: vi.fn(() => Promise.resolve([])),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'showSaveFilePicker', {
      value: vi.fn(() => Promise.reject(new Error('not used'))),
      configurable: true,
      writable: true,
    });

    setSecureContext(true);
    expect(isFileSystemAccessSupported()).toBe(true);

    delete (globalThis.window as FilePickerWindow).showSaveFilePicker;
    expect(isFileSystemAccessSupported()).toBe(false);

    Object.defineProperty(globalThis.window, 'showSaveFilePicker', {
      value: vi.fn(() => Promise.reject(new Error('not used'))),
      configurable: true,
      writable: true,
    });
    setSecureContext(false);
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('returns null when opening is unsupported', async () => {
    setSecureContext(false);

    await expect(openWorkspaceFile()).resolves.toBeNull();
  });

  it('opens a workspace json file and returns its text plus handle', async () => {
    const fileHandle = createFileHandleMock({
      lastModified: 1_762_000_000_123,
    });
    const showOpenFilePicker = vi.fn(() =>
      Promise.resolve([fileHandle.handle]),
    );

    Object.defineProperty(globalThis.window, 'showOpenFilePicker', {
      value: showOpenFilePicker,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'showSaveFilePicker', {
      value: vi.fn(() => Promise.reject(new Error('not used'))),
      configurable: true,
      writable: true,
    });
    setSecureContext(true);

    await expect(openWorkspaceFile()).resolves.toEqual({
      handle: fileHandle.handle,
      lastModified: 1_762_000_000_123,
      text: '{"workspace":true}',
    });
    expect(showOpenFilePicker).toHaveBeenCalledWith({
      excludeAcceptAllOption: true,
      multiple: false,
      types: [
        {
          accept: {
            'application/json': ['.json'],
          },
          description: 'Workspace JSON',
        },
      ],
    });
  });

  it('saves workspace json through the save file picker', async () => {
    const fileHandle = createFileHandleMock();
    const showSaveFilePicker = vi.fn(() => Promise.resolve(fileHandle.handle));

    Object.defineProperty(globalThis.window, 'showOpenFilePicker', {
      value: vi.fn(() => Promise.resolve([])),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'showSaveFilePicker', {
      value: showSaveFilePicker,
      configurable: true,
      writable: true,
    });
    setSecureContext(true);

    await expect(saveWorkspaceFileAs('{"workspace":true}')).resolves.toEqual({
      handle: fileHandle.handle,
      lastModified: 1_762_000_000_001,
    });
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      excludeAcceptAllOption: true,
      suggestedName: 'workspace.json',
      types: [
        {
          accept: {
            'application/json': ['.json'],
          },
          description: 'Workspace JSON',
        },
      ],
    });
    const writtenBlob = fileHandle.write.mock.calls[0]?.[0];

    expect(writtenBlob).toBeInstanceOf(Blob);

    if (!(writtenBlob instanceof Blob)) {
      throw new TypeError('expected saved json blob');
    }

    await expect(writtenBlob.text()).resolves.toBe('{"workspace":true}');
    expect(fileHandle.close).toHaveBeenCalledTimes(1);
  });

  it('requests permission before overwriting a linked file handle', async () => {
    const queryPermission = vi.fn<() => Promise<PermissionState>>(() =>
      Promise.resolve('prompt'),
    );
    const requestPermission = vi.fn<() => Promise<PermissionState>>(() =>
      Promise.resolve('granted'),
    );
    const fileHandle = createFileHandleMock({
      fileName: 'linked.json',
      lastModified: 1_762_000_000_200,
      queryPermission,
      requestPermission,
    });

    await expect(
      overwriteWorkspaceFile(fileHandle.handle, '{"workspace":true}'),
    ).resolves.toEqual({
      handle: fileHandle.handle,
      lastModified: 1_762_000_000_201,
    });

    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(fileHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(fileHandle.close).toHaveBeenCalledTimes(1);
  });

  it('recognizes AbortError from file pickers', () => {
    expect(
      isFilePickerAbortError(
        new DOMException('The user aborted a request.', 'AbortError'),
      ),
    ).toBe(true);
    expect(isFilePickerAbortError(new Error('boom'))).toBe(false);
  });
});
