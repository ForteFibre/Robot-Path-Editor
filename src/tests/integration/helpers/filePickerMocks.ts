import { vi } from 'vitest';
import { serializeWorkspace } from '../../../io/workspaceCodec';
import { createInitialDomainState } from '../../../store/slices/pathSlice';
import { createInitialUiState } from '../../../store/slices/uiSlice';

export type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

export type FilePickerWindow = Window & {
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

const createDefaultWorkspaceJson = (): string => {
  const domain = createInitialDomainState();
  const { backgroundImage, robotSettings } = createInitialUiState();

  return serializeWorkspace({
    domain,
    backgroundImage,
    robotSettings,
  });
};

export const setDirectoryPickerSupport = (
  picker: DirectoryPickerWindow['showDirectoryPicker'],
  isSecureContext = true,
): void => {
  Object.defineProperty(globalThis.window, 'showDirectoryPicker', {
    value: picker,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value: isSecureContext,
    configurable: true,
  });
};

export const createDirectoryExportMock = (directoryName = 'exports') => {
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
    name: directoryName,
    getFileHandle,
  } as unknown as FileSystemDirectoryHandle;
  const showDirectoryPicker = vi.fn(() => Promise.resolve(directoryHandle));

  setDirectoryPickerSupport(showDirectoryPicker);

  return {
    showDirectoryPicker,
    getFileHandle,
    write,
  };
};

export const createWorkspaceFileSaveMock = (
  fileName = 'workspace.json',
  initialText = createDefaultWorkspaceJson(),
) => {
  let currentText = initialText;
  let currentLastModified = 1_762_000_000_000;
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
  const queryPermission = vi.fn(() => Promise.resolve('granted'));
  const requestPermission = vi.fn(() => Promise.resolve('granted'));
  const getFile = vi.fn(() =>
    Promise.resolve(
      new File([currentText], fileName, {
        type: 'application/json',
        lastModified: currentLastModified,
      }),
    ),
  );
  const handle = {
    kind: 'file',
    name: fileName,
    createWritable,
    getFile,
    queryPermission,
    requestPermission,
  } as unknown as FileSystemFileHandle;
  const showSaveFilePicker = vi.fn(() => Promise.resolve(handle));

  Object.defineProperty(globalThis.window, 'showSaveFilePicker', {
    value: showSaveFilePicker,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis.window, 'showOpenFilePicker', {
    value: vi.fn(() => Promise.resolve([])),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value: true,
    configurable: true,
  });

  return {
    close,
    createWritable,
    getCurrentLastModified: () => currentLastModified,
    getCurrentText: () => currentText,
    getFile,
    handle,
    queryPermission,
    requestPermission,
    setExternalFile: (params: { text: string; lastModified?: number }) => {
      currentText = params.text;
      currentLastModified = params.lastModified ?? currentLastModified + 100;
    },
    showSaveFilePicker,
    write,
  };
};
