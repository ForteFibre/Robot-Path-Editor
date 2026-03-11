type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

type DirectoryPicker = NonNullable<
  DirectoryPickerWindow['showDirectoryPicker']
>;

export type FileToWrite = {
  filename: string;
  content: string;
  mimeType: string;
};

export type WriteResult = {
  writtenCount: number;
  filenames: string[];
  directoryName: string;
};

const getDirectoryPicker = (): DirectoryPicker | null => {
  const browserWindow = (
    globalThis as {
      window?: DirectoryPickerWindow;
    }
  ).window;
  if (browserWindow === undefined) {
    return null;
  }

  const picker = browserWindow.showDirectoryPicker;
  return typeof picker === 'function' ? picker.bind(browserWindow) : null;
};

export const isDirectoryExportSupported = (): boolean => {
  return getDirectoryPicker() !== null && globalThis.window.isSecureContext;
};

export const pickWritableDirectory =
  async (): Promise<FileSystemDirectoryHandle> => {
    const directoryPicker = getDirectoryPicker();
    if (directoryPicker === null) {
      throw new Error('Directory export is not supported in this browser.');
    }

    return await directoryPicker({ mode: 'readwrite' });
  };

export const isDirectoryPickerAbortError = (error: unknown): boolean => {
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

export const writeFilesToDirectory = async (
  files: FileToWrite[],
  directoryHandle?: FileSystemDirectoryHandle,
): Promise<WriteResult> => {
  const targetDirectory = directoryHandle ?? (await pickWritableDirectory());

  for (const file of files) {
    const fileHandle = await targetDirectory.getFileHandle(file.filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([file.content], { type: file.mimeType }));
    await writable.close();
  }

  return {
    writtenCount: files.length,
    filenames: files.map((file) => file.filename),
    directoryName: targetDirectory.name,
  };
};
