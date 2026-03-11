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

export type OpenedWorkspaceFile = {
  handle: FileSystemFileHandle;
  lastModified: number;
  text: string;
};

export type SavedWorkspaceFile = {
  handle: FileSystemFileHandle;
  lastModified: number;
};

type PermissionCapableFileHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<PermissionState>;
};

const WORKSPACE_FILE_TYPES: {
  accept: Record<string, string[]>;
  description: string;
}[] = [
  {
    description: 'Workspace JSON',
    accept: {
      'application/json': ['.json'],
    },
  },
];

const getBrowserWindow = (): FilePickerWindow | null => {
  const browserWindow = (
    globalThis as {
      window?: FilePickerWindow;
    }
  ).window;

  return browserWindow ?? null;
};

const getOpenFilePicker = (): NonNullable<
  FilePickerWindow['showOpenFilePicker']
> | null => {
  const browserWindow = getBrowserWindow();
  if (browserWindow === null) {
    return null;
  }

  const picker = browserWindow.showOpenFilePicker;
  return typeof picker === 'function' ? picker.bind(browserWindow) : null;
};

const getSaveFilePicker = (): NonNullable<
  FilePickerWindow['showSaveFilePicker']
> | null => {
  const browserWindow = getBrowserWindow();
  if (browserWindow === null) {
    return null;
  }

  const picker = browserWindow.showSaveFilePicker;
  return typeof picker === 'function' ? picker.bind(browserWindow) : null;
};

const writeJsonToHandle = async (
  handle: FileSystemFileHandle,
  json: string,
): Promise<void> => {
  const writable = await handle.createWritable();
  await writable.write(
    new Blob([json], {
      type: 'application/json',
    }),
  );
  await writable.close();
};

const readLastModified = async (
  handle: FileSystemFileHandle,
): Promise<number> => {
  const file = await handle.getFile();
  return file.lastModified;
};

const ensureWritePermission = async (
  handle: FileSystemFileHandle,
): Promise<void> => {
  const permissionHandle = handle as PermissionCapableFileHandle;
  const permissionDescriptor = {
    mode: 'readwrite',
  } as const;
  const queryPermission =
    permissionHandle.queryPermission?.bind(permissionHandle);
  const requestPermission =
    permissionHandle.requestPermission?.bind(permissionHandle);

  const currentPermission =
    queryPermission === undefined
      ? 'prompt'
      : await queryPermission(permissionDescriptor);

  if (currentPermission === 'granted') {
    return;
  }

  const nextPermission =
    requestPermission === undefined
      ? currentPermission
      : await requestPermission(permissionDescriptor);

  if (nextPermission !== 'granted') {
    throw new Error('ファイルへの書き込み権限がありません。');
  }
};

export const isFileSystemAccessSupported = (): boolean => {
  const browserWindow = getBrowserWindow();
  if (browserWindow?.isSecureContext !== true) {
    return false;
  }

  return getOpenFilePicker() !== null && getSaveFilePicker() !== null;
};

export const isFilePickerAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
};

export const openWorkspaceFile =
  async (): Promise<OpenedWorkspaceFile | null> => {
    const openFilePicker = getOpenFilePicker();
    if (openFilePicker === null || !isFileSystemAccessSupported()) {
      return null;
    }

    const handles = await openFilePicker({
      excludeAcceptAllOption: true,
      multiple: false,
      types: [...WORKSPACE_FILE_TYPES],
    });
    const handle = handles[0];

    if (handle === undefined) {
      return null;
    }

    const file = await handle.getFile();

    return {
      handle,
      lastModified: file.lastModified,
      text: await file.text(),
    };
  };

export const saveWorkspaceFileAs = async (
  json: string,
): Promise<SavedWorkspaceFile> => {
  const saveFilePicker = getSaveFilePicker();
  if (saveFilePicker === null || !isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }

  const handle = await saveFilePicker({
    excludeAcceptAllOption: true,
    suggestedName: 'workspace.json',
    types: [...WORKSPACE_FILE_TYPES],
  });

  await writeJsonToHandle(handle, json);

  return {
    handle,
    lastModified: await readLastModified(handle),
  };
};

export const overwriteWorkspaceFile = async (
  handle: FileSystemFileHandle,
  json: string,
): Promise<SavedWorkspaceFile> => {
  await ensureWritePermission(handle);
  await writeJsonToHandle(handle, json);

  return {
    handle,
    lastModified: await readLastModified(handle),
  };
};
